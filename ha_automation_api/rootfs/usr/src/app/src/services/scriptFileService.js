const { ApiError } = require("../errors");
const { createYamlEntityFileService } = require("./yamlEntityFileServiceFactory");
const {
  resolveVisible,
  resolveEnabled,
  metadataMatchesFilters,
} = require("./metadataUtils");

const EXCLUDED_SCRIPT_CONTENT_FIELDS = new Set([
  "sequence",
]);

function normalizeScriptId(id) {
  if (id === undefined || id === null) {
    return null;
  }
  return String(id);
}

function normalizeScriptBody(scriptId, scriptBody) {
  if (!scriptBody || typeof scriptBody !== "object" || Array.isArray(scriptBody)) {
    throw new ApiError(422, `Script '${scriptId}' must be a YAML object.`);
  }
  return scriptBody;
}

function toScriptResponse(scriptId, scriptBody) {
  const normalizedId = normalizeScriptId(scriptId);
  const normalizedBody = normalizeScriptBody(normalizedId, scriptBody);
  return {
    ...normalizedBody,
    id: normalizedId,
  };
}

function toScriptMetadata(script) {
  const item = script && typeof script === "object" ? script : {};
  const metadata = { ...item };

  for (const field of EXCLUDED_SCRIPT_CONTENT_FIELDS) {
    delete metadata[field];
  }

  metadata.id = normalizeScriptId(item.id);
  metadata.name = metadata.name ?? item.alias ?? null;
  metadata.visible = resolveVisible(item);
  metadata.enabled = resolveEnabled(item);

  return metadata;
}

function scriptMetadataMatchesFilters(metadata, filters) {
  return metadataMatchesFilters(metadata, filters, ["name", "area", "floor", "label", "entity_id", "icon", "id"]);
}

function createScriptFileService(options, reloadService) {
  function parseScriptsRoot(parsed) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ApiError(422, "Scripts YAML must be an object mapping.");
    }
    return parsed;
  }

  function stripScriptId(input) {
    const next = { ...input };
    delete next.id;
    return next;
  }

  const entityService = createYamlEntityFileService({
    entityName: "Script",
    entitiesName: "scripts",
    entitiesFilePath: options.scripts_file,
    backupKeep: options.backup_keep,
    reloadEntities: (token) => reloadService.reloadScripts(token),
    parseRoot: parseScriptsRoot,
    adapter: {
      getById(scriptsRoot, normalizedId) {
        if (!Object.prototype.hasOwnProperty.call(scriptsRoot, normalizedId)) {
          return null;
        }
        return toScriptResponse(normalizedId, scriptsRoot[normalizedId]);
      },
      put(scriptsRoot, normalizedId, incomingScript) {
        const persistedScript = stripScriptId(incomingScript);
        const nextRoot = {
          ...scriptsRoot,
          [normalizedId]: persistedScript,
        };
        return { nextRoot, entity: toScriptResponse(normalizedId, persistedScript) };
      },
      patch(scriptsRoot, normalizedId, incomingScript) {
        const persistedIncomingScript = stripScriptId(incomingScript);
        const existingScriptBody = normalizeScriptBody(normalizedId, scriptsRoot[normalizedId]);
        const mergedScript = {
          ...existingScriptBody,
          ...persistedIncomingScript,
        };
        const nextRoot = {
          ...scriptsRoot,
          [normalizedId]: mergedScript,
        };
        return { nextRoot, entity: toScriptResponse(normalizedId, mergedScript) };
      },
      remove(scriptsRoot, normalizedId) {
        const removed = toScriptResponse(normalizedId, scriptsRoot[normalizedId]);
        const nextRoot = { ...scriptsRoot };
        delete nextRoot[normalizedId];
        return { nextRoot, entity: removed };
      },
      list(scriptsRoot) {
        return Object.entries(scriptsRoot).map(([scriptId, scriptBody]) => toScriptResponse(scriptId, scriptBody));
      },
    },
    metadataAdapter: {
      toMetadata: toScriptMetadata,
      matchesFilters: scriptMetadataMatchesFilters,
    },
  });

  async function readScripts() {
    return entityService.readRoot();
  }

  async function readScriptById(id) {
    return entityService.readEntityById(id);
  }

  async function updateScript(id, incomingScript, token) {
    return entityService.updateEntity(id, incomingScript, token);
  }

  async function patchScript(id, incomingScript, token) {
    return entityService.patchEntity(id, incomingScript, token);
  }

  async function deleteScript(id, token) {
    return entityService.deleteEntity(id, token);
  }

  async function searchScriptMetadata(filters = {}) {
    return entityService.searchEntityMetadata(filters);
  }

  return {
    readScripts,
    readScriptById,
    updateScript,
    patchScript,
    deleteScript,
    searchScriptMetadata,
  };
}

module.exports = {
  createScriptFileService,
};
