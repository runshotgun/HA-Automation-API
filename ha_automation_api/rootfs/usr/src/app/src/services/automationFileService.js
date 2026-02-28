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

function normalizeSearchText(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeSearchText(item)).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value).map((item) => normalizeSearchText(item)).filter(Boolean).join(" ");
  }
  return String(value);
}

function parseBooleanValue(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

function resolveVisible(automation) {
  const explicitVisible = parseBooleanValue(automation.visible);
  if (explicitVisible !== null) {
    return explicitVisible;
  }
  const hidden = parseBooleanValue(automation.hidden);
  if (hidden !== null) {
    return !hidden;
  }
  return true;
}

function resolveEnabled(automation) {
  const explicitEnabled = parseBooleanValue(automation.enabled);
  if (explicitEnabled !== null) {
    return explicitEnabled;
  }
  const initialState = parseBooleanValue(automation.initial_state);
  if (initialState !== null) {
    return initialState;
  }
  return true;
}

const EXCLUDED_AUTOMATION_CONTENT_FIELDS = new Set([
  "trigger",
  "condition",
  "action",
  "triggers",
  "conditions",
  "actions",
  "sequence",
]);

function toAutomationMetadata(automation) {
  const item = automation && typeof automation === "object" ? automation : {};
  const metadata = { ...item };

  for (const field of EXCLUDED_AUTOMATION_CONTENT_FIELDS) {
    delete metadata[field];
  }

  metadata.id = normalizeAutomationId(item);
  metadata.name = metadata.name ?? item.alias ?? null;
  metadata.visible = resolveVisible(item);
  metadata.enabled = resolveEnabled(item);

  return metadata;
}

function metadataMatchesFilters(metadata, filters) {
  const textFilters = {
    name: filters.name,
    area: filters.area,
    floor: filters.floor,
    label: filters.label,
    entity_id: filters.entity_id,
    icon: filters.icon,
    id: filters.id,
  };

  for (const [field, rawFilter] of Object.entries(textFilters)) {
    if (rawFilter === undefined || rawFilter === null || rawFilter === "") {
      continue;
    }
    const normalizedFilter = String(rawFilter).trim().toLowerCase();
    if (!normalizeSearchText(metadata[field]).toLowerCase().includes(normalizedFilter)) {
      return false;
    }
  }

  if (filters.visible !== undefined) {
    const visibleFilter = parseBooleanValue(filters.visible);
    if (visibleFilter === null) {
      throw new ApiError(422, "Invalid 'visible' query value. Expected true/false.");
    }
    if (metadata.visible !== visibleFilter) {
      return false;
    }
  }

  if (filters.enabled !== undefined) {
    const enabledFilter = parseBooleanValue(filters.enabled);
    if (enabledFilter === null) {
      throw new ApiError(422, "Invalid 'enabled' query value. Expected true/false.");
    }
    if (metadata.enabled !== enabledFilter) {
      return false;
    }
  }

  if (filters.q !== undefined && filters.q !== null && filters.q !== "") {
    const normalizedQuery = String(filters.q).trim().toLowerCase();
    const matchesQuery = normalizeSearchText(metadata).toLowerCase().includes(normalizedQuery);
    if (!matchesQuery) {
      return false;
    }
  }

  return true;
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

  async function searchAutomationMetadata(filters = {}) {
    const automations = await readAutomations();
    return automations.map((automation) => toAutomationMetadata(automation)).filter((metadata) => metadataMatchesFilters(metadata, filters));
  }

  return {
    readAutomations,
    readAutomationById,
    updateAutomation,
    deleteAutomation,
    searchAutomationMetadata,
  };
}

module.exports = {
  createAutomationFileService,
};
