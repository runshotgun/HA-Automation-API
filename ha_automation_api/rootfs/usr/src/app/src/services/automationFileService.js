const fs = require("fs/promises");
const yaml = require("js-yaml");
const { ApiError } = require("../errors");
const { createBackup, rotateBackups, restoreBackup } = require("./backupService");

function normalizeAutomationId(automation) {
  if (!automation || typeof automation !== "object" || automation.id === undefined || automation.id === null) {
    return null;
  }
  return String(automation.id);
}

function parseYamlContent(fileContent) {
  try {
    const parsed = yaml.load(fileContent);
    if (!Array.isArray(parsed)) {
      throw new ApiError(422, "Automations YAML must be a list.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(422, "Invalid YAML content.", error.message);
  }
}

function createAutomationFileService(options, reloadService) {
  const automationsFile = options.automations_file;
  const backupKeep = options.backup_keep;

  async function readAutomations() {
    try {
      const content = await fs.readFile(automationsFile, "utf8");
      return parseYamlContent(content);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to read automations file.", error.message);
    }
  }

  async function readAutomationById(id) {
    const automations = await readAutomations();
    const normalizedId = String(id);
    const automation = automations.find((item) => normalizeAutomationId(item) === normalizedId);

    if (!automation) {
      throw new ApiError(404, `Automation '${normalizedId}' was not found.`);
    }

    return automation;
  }

  async function writeWithSwapAndReload(newAutomations, token) {
    const tempPath = `${automationsFile}.new`;
    const yamlOutput = yaml.dump(newAutomations, {
      lineWidth: 0,
      noRefs: true,
      sortKeys: false,
    });

    // Validate generated YAML before touching disk.
    parseYamlContent(yamlOutput);

    let backupPath = null;
    let swapped = false;
    let oldDeleted = false;

    try {
      await fs.writeFile(tempPath, yamlOutput, "utf8");

      // Validate on-disk temp file before replacing the live file.
      const tempContent = await fs.readFile(tempPath, "utf8");
      parseYamlContent(tempContent);

      backupPath = await createBackup(automationsFile);

      await fs.unlink(automationsFile);
      oldDeleted = true;
      await fs.rename(tempPath, automationsFile);
      swapped = true;

      await reloadService.reloadAutomations(token);
      await rotateBackups(automationsFile, backupKeep);
    } catch (error) {
      const shouldRestore = Boolean(backupPath) && (swapped || oldDeleted);
      if (shouldRestore) {
        try {
          await restoreBackup(backupPath, automationsFile);
        } catch (restoreError) {
          throw new ApiError(500, "Write failed and backup restore also failed.", restoreError.details || restoreError.message);
        }
      }

      if (!swapped) {
        try {
          await fs.unlink(tempPath);
        } catch (_unlinkError) {
          // No-op: temp file may not exist.
        }
      }

      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to update automations file.", error.message);
    }
  }

  async function updateAutomation(id, incomingAutomation, token) {
    if (!incomingAutomation || typeof incomingAutomation !== "object" || Array.isArray(incomingAutomation)) {
      throw new ApiError(422, "Request body must be a JSON object.");
    }

    const normalizedId = String(id);
    const automations = await readAutomations();
    const index = automations.findIndex((item) => normalizeAutomationId(item) === normalizedId);

    if (index < 0) {
      throw new ApiError(404, `Automation '${normalizedId}' was not found.`);
    }

    const merged = {
      ...automations[index],
      ...incomingAutomation,
      id: normalizedId,
    };

    const updatedAutomations = [...automations];
    updatedAutomations[index] = merged;

    await writeWithSwapAndReload(updatedAutomations, token);

    return merged;
  }

  async function deleteAutomation(id, token) {
    const normalizedId = String(id);
    const automations = await readAutomations();
    const index = automations.findIndex((item) => normalizeAutomationId(item) === normalizedId);

    if (index < 0) {
      throw new ApiError(404, `Automation '${normalizedId}' was not found.`);
    }

    const removed = automations[index];
    const updatedAutomations = automations.filter((_item, idx) => idx !== index);

    await writeWithSwapAndReload(updatedAutomations, token);

    return removed;
  }

  return {
    readAutomations,
    readAutomationById,
    updateAutomation,
    deleteAutomation,
  };
}

module.exports = {
  createAutomationFileService,
};
