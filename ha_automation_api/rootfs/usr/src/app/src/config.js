const fs = require("fs");
const crypto = require("crypto");
const fetch = require("node-fetch");

const OPTIONS_PATH = "/data/options.json";
const DEFAULT_SUPERVISOR_URL = "http://supervisor";
const API_KEY_HEX_PATTERN = /^[a-f0-9]{64}$/i;

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

function isValidApiKey(value) {
  const normalizedValue = String(value || "").trim();
  return API_KEY_HEX_PATTERN.test(normalizedValue);
}

function persistOptions(nextOptions) {
  const persisted = persistOptionsFile(nextOptions);
  void persistOptionsSupervisor(nextOptions);
  return persisted;
}

function persistOptionsFile(nextOptions) {
  try {
    fs.writeFileSync(OPTIONS_PATH, JSON.stringify(nextOptions, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to persist generated API key to /data/options.json.", error.message);
    return false;
  }
}

async function persistOptionsSupervisor(nextOptions) {
  const supervisorToken = String(process.env.SUPERVISOR_TOKEN || "").trim();
  if (!supervisorToken) {
    return;
  }

  const supervisorBaseUrl = String(process.env.SUPERVISOR_URL || DEFAULT_SUPERVISOR_URL).replace(/\/$/, "");
  const endpoint = `${supervisorBaseUrl}/addons/self/options`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supervisorToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        options: nextOptions,
      }),
      timeout: 5000,
    });

    if (!response.ok) {
      console.warn(`Failed to sync generated API key to Supervisor options (HTTP ${response.status}).`);
    }
  } catch (error) {
    console.warn("Failed to sync generated API key to Supervisor options.", error.message);
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

    const shouldGenerateApiKey = !isValidApiKey(nextOptions.api_key);
    if (shouldGenerateApiKey) {
      const previousApiKeyState = nextOptions.api_key ? "invalid" : "empty";
      nextOptions.api_key = generateApiKey();

      const optionsToPersist = {
        ...fileOptions,
        ...nextOptions,
      };
      delete optionsToPersist.regenerate_api_key;
      const persisted = persistOptions(optionsToPersist);
      if (persisted) {
        console.warn(`API key was ${previousApiKeyState}. Generated and persisted a new API key.`);
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
