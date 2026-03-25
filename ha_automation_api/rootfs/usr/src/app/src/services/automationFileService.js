const { ApiError } = require("../errors");
const { createYamlEntityFileService } = require("./yamlEntityFileServiceFactory");
const {
  resolveVisible,
  resolveEnabled,
  metadataMatchesFilters: metadataMatchesFiltersCommon,
} = require("./metadataUtils");

function normalizeAutomationId(automation) {
  if (!automation || typeof automation !== "object" || automation.id === undefined || automation.id === null) {
    return null;
  }
  return String(automation.id);
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

function automationMetadataMatchesFilters(metadata, filters) {
  return metadataMatchesFiltersCommon(metadata, filters, ["name", "area", "floor", "label", "entity_id", "icon", "id"]);
}

function createAutomationFileService(options, reloadService) {
  function parseAutomationsRoot(parsed) {
    if (!Array.isArray(parsed)) {
      throw new ApiError(422, "Automations YAML must be a list.");
    }
    return parsed;
  }

  function findAutomationIndex(automations, normalizedId) {
    return automations.findIndex((item) => normalizeAutomationId(item) === normalizedId);
  }

  const entityService = createYamlEntityFileService({
    entityName: "Automation",
    entitiesName: "automations",
    entitiesFilePath: options.automations_file,
    backupKeep: options.backup_keep,
    reloadEntities: (authContext) => reloadService.reloadAutomations(authContext),
    parseRoot: parseAutomationsRoot,
    adapter: {
      getById(automations, normalizedId) {
        return automations.find((item) => normalizeAutomationId(item) === normalizedId) || null;
      },
      put(automations, normalizedId, incomingAutomation) {
        const index = findAutomationIndex(automations, normalizedId);
        const replaced = {
          ...incomingAutomation,
          id: normalizedId,
        };

        const nextRoot = [...automations];
        nextRoot[index] = replaced;
        return { nextRoot, entity: replaced };
      },
      patch(automations, normalizedId, incomingAutomation) {
        const index = findAutomationIndex(automations, normalizedId);
        const merged = {
          ...automations[index],
          ...incomingAutomation,
          id: normalizedId,
        };

        const nextRoot = [...automations];
        nextRoot[index] = merged;
        return { nextRoot, entity: merged };
      },
      remove(automations, normalizedId) {
        const index = findAutomationIndex(automations, normalizedId);
        const removed = automations[index];
        const nextRoot = automations.filter((_item, idx) => idx !== index);
        return { nextRoot, entity: removed };
      },
      list(automations) {
        return automations;
      },
    },
    metadataAdapter: {
      toMetadata: toAutomationMetadata,
      matchesFilters: automationMetadataMatchesFilters,
    },
  });

  async function readAutomations() {
    return entityService.readRoot();
  }

  async function readAutomationById(id) {
    return entityService.readEntityById(id);
  }

  async function updateAutomation(id, incomingAutomation, authContext) {
    return entityService.updateEntity(id, incomingAutomation, authContext);
  }

  async function patchAutomation(id, incomingAutomation, authContext) {
    return entityService.patchEntity(id, incomingAutomation, authContext);
  }

  async function deleteAutomation(id, authContext) {
    return entityService.deleteEntity(id, authContext);
  }

  async function searchAutomationMetadata(filters = {}) {
    return entityService.searchEntityMetadata(filters);
  }

  return {
    readAutomations,
    readAutomationById,
    updateAutomation,
    patchAutomation,
    deleteAutomation,
    searchAutomationMetadata,
  };
}

module.exports = {
  createAutomationFileService,
};
