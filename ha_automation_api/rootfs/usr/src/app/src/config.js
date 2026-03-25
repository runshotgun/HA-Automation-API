const fs = require("fs");
const crypto = require("crypto");

const OPTIONS_PATH = "/data/options.json";

const DEFAULT_OPTIONS = {
  api_key: "",
  allow_list: true,
  allow_read: true,
  allow_search: true,
  allow_edit: false,
  allow_delete: false,
  allowed_ips: [],
  automations_file: "/config/automations.yaml",
  scripts_file: "/config/scripts.yaml",
  backup_keep: 10,
};

function generateApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

function persistOptions(nextOptions) {
  try {
    fs.writeFileSync(OPTIONS_PATH, JSON.stringify(nextOptions, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to persist generated API key to /data/options.json.", error.message);
    return false;
  }
}

function readOptionsFile() {
  try {
    if (fs.existsSync(OPTIONS_PATH)) {
      const raw = fs.readFileSync(OPTIONS_PATH, "utf8");
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error("Failed to parse /data/options.json, using defaults.", error.message);
  }
  return {};
}

function normalizeOptions(sourceOptions = {}) {
  const options = {
    ...DEFAULT_OPTIONS,
    ...sourceOptions,
  };

  options.api_key = String(options.api_key || "").trim();
  options.allow_list = Boolean(options.allow_list);
  options.allow_read = Boolean(options.allow_read);
  options.allow_search = Boolean(options.allow_search);
  options.allow_edit = Boolean(options.allow_edit);
  options.allow_delete = Boolean(options.allow_delete);

  options.backup_keep = Number(options.backup_keep) || DEFAULT_OPTIONS.backup_keep;
  if (options.backup_keep < 1) {
    options.backup_keep = 1;
  }

  if (!Array.isArray(options.allowed_ips)) {
    options.allowed_ips = [];
  }

  options.allowed_ips = options.allowed_ips
    .map((ip) => String(ip).trim())
    .filter((ip) => ip.length > 0);

  return options;
}

function readOptionsMtimeMs() {
  try {
    if (fs.existsSync(OPTIONS_PATH)) {
      return fs.statSync(OPTIONS_PATH).mtimeMs;
    }
  } catch (error) {
    console.error("Failed to read options file metadata.", error.message);
  }
  return null;
}

function createOptionsStore() {
  let currentOptions = normalizeOptions();
  let loaded = false;
  let lastMtimeMs = null;

  function refreshOptions(force = false) {
    const currentMtimeMs = readOptionsMtimeMs();
    if (!force && loaded && currentMtimeMs === lastMtimeMs) {
      return currentOptions;
    }

    const fileOptions = readOptionsFile();
    const nextOptions = normalizeOptions(fileOptions);

    const shouldGenerateApiKey = !nextOptions.api_key;
    if (shouldGenerateApiKey) {
      nextOptions.api_key = generateApiKey();

      const optionsToPersist = {
        ...fileOptions,
        ...nextOptions,
      };
      delete optionsToPersist.regenerate_api_key;
      const persisted = persistOptions(optionsToPersist);
      if (persisted) {
        console.log(`Generated API key: ${nextOptions.api_key}`);
      } else {
        console.warn("Using in-memory generated API key for this session only.");
      }
    }

    currentOptions = nextOptions;
    loaded = true;
    lastMtimeMs = readOptionsMtimeMs();
    return currentOptions;
  }

  refreshOptions(true);
  const pollTimer = setInterval(() => {
    refreshOptions(false);
  }, 2000);
  if (typeof pollTimer.unref === "function") {
    pollTimer.unref();
  }

  return {
    getOptions() {
      return refreshOptions(false);
    },
    refreshOptions() {
      return refreshOptions(true);
    },
  };
}

function loadOptions() {
  const optionsStore = createOptionsStore();
  return optionsStore.getOptions();
}

module.exports = {
  createOptionsStore,
  loadOptions,
};
