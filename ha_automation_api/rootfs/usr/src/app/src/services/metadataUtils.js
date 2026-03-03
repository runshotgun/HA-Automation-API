const { ApiError } = require("../errors");

function normalizeSearchText(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeSearchText(item))
      .filter(Boolean)
      .join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value)
      .map((item) => normalizeSearchText(item))
      .filter(Boolean)
      .join(" ");
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

function resolveVisible(entity) {
  const explicitVisible = parseBooleanValue(entity.visible);
  if (explicitVisible !== null) {
    return explicitVisible;
  }
  const hidden = parseBooleanValue(entity.hidden);
  if (hidden !== null) {
    return !hidden;
  }
  return true;
}

function resolveEnabled(entity) {
  const explicitEnabled = parseBooleanValue(entity.enabled);
  if (explicitEnabled !== null) {
    return explicitEnabled;
  }
  const initialState = parseBooleanValue(entity.initial_state);
  if (initialState !== null) {
    return initialState;
  }
  return true;
}

function metadataMatchesFilters(metadata, filters, textFields = []) {
  for (const field of textFields) {
    const rawFilter = filters[field];
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

module.exports = {
  normalizeSearchText,
  parseBooleanValue,
  resolveVisible,
  resolveEnabled,
  metadataMatchesFilters,
};
