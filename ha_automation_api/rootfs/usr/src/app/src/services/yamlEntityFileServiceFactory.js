const fs = require("fs/promises");
const yaml = require("js-yaml");
const { ApiError } = require("../errors");
const { createBackup, rotateBackups, restoreBackup } = require("./backupService");

function createYamlEntityFileService(options) {
  const {
    entityName,
    entitiesName,
    entitiesFilePath,
    backupKeep,
    reloadEntities,
    parseRoot,
    adapter,
    metadataAdapter,
  } = options;

  function parseYamlContent(fileContent) {
    try {
      const parsed = yaml.load(fileContent);
      return parseRoot(parsed);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(422, "Invalid YAML content.", error.message);
    }
  }

  async function readRoot() {
    try {
      const content = await fs.readFile(entitiesFilePath, "utf8");
      return parseYamlContent(content);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to read ${entitiesName} file.`, error.message);
    }
  }

  async function writeWithSwapAndReload(nextRoot, token) {
    const tempPath = `${entitiesFilePath}.new`;
    const yamlOutput = yaml.dump(nextRoot, {
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

      backupPath = await createBackup(entitiesFilePath);

      await fs.unlink(entitiesFilePath);
      oldDeleted = true;
      await fs.rename(tempPath, entitiesFilePath);
      swapped = true;

      await reloadEntities(token);
      await rotateBackups(entitiesFilePath, backupKeep);
    } catch (error) {
      const shouldRestore = Boolean(backupPath) && (swapped || oldDeleted);
      if (shouldRestore) {
        try {
          await restoreBackup(backupPath, entitiesFilePath);
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
      throw new ApiError(500, `Failed to update ${entitiesName} file.`, error.message);
    }
  }

  function validateIncomingEntity(incomingEntity) {
    if (!incomingEntity || typeof incomingEntity !== "object" || Array.isArray(incomingEntity)) {
      throw new ApiError(422, "Request body must be a JSON object.");
    }
  }

  async function readEntityById(id) {
    const normalizedId = String(id);
    const root = await readRoot();
    const entity = adapter.getById(root, normalizedId);
    if (!entity) {
      throw new ApiError(404, `${entityName} '${normalizedId}' was not found.`);
    }
    return entity;
  }

  async function updateEntity(id, incomingEntity, token) {
    validateIncomingEntity(incomingEntity);

    const normalizedId = String(id);
    const root = await readRoot();
    const currentEntity = adapter.getById(root, normalizedId);
    if (!currentEntity) {
      throw new ApiError(404, `${entityName} '${normalizedId}' was not found.`);
    }

    const { nextRoot, entity } = adapter.put(root, normalizedId, incomingEntity, currentEntity);
    await writeWithSwapAndReload(nextRoot, token);
    return entity;
  }

  async function patchEntity(id, incomingEntity, token) {
    validateIncomingEntity(incomingEntity);

    const normalizedId = String(id);
    const root = await readRoot();
    const currentEntity = adapter.getById(root, normalizedId);
    if (!currentEntity) {
      throw new ApiError(404, `${entityName} '${normalizedId}' was not found.`);
    }

    const { nextRoot, entity } = adapter.patch(root, normalizedId, incomingEntity, currentEntity);
    await writeWithSwapAndReload(nextRoot, token);
    return entity;
  }

  async function deleteEntity(id, token) {
    const normalizedId = String(id);
    const root = await readRoot();
    const currentEntity = adapter.getById(root, normalizedId);
    if (!currentEntity) {
      throw new ApiError(404, `${entityName} '${normalizedId}' was not found.`);
    }

    const { nextRoot, entity } = adapter.remove(root, normalizedId, currentEntity);
    await writeWithSwapAndReload(nextRoot, token);
    return entity;
  }

  async function searchEntityMetadata(filters = {}) {
    const root = await readRoot();
    return adapter
      .list(root)
      .map((entity) => metadataAdapter.toMetadata(entity))
      .filter((metadata) => metadataAdapter.matchesFilters(metadata, filters));
  }

  return {
    readRoot,
    readEntityById,
    updateEntity,
    patchEntity,
    deleteEntity,
    searchEntityMetadata,
  };
}

module.exports = {
  createYamlEntityFileService,
};
