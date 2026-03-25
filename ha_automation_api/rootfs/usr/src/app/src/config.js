const fs = require("fs");
const crypto = require("crypto");

const OPTIONS_PATH = "/data/options.json";

const DEFAULT_OPTIONS = {
  api_key: "",
  regenerate_api_key: false,
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

function loadOptions() {
  let fileOptions = {};

  try {
    if (fs.existsSync(OPTIONS_PATH)) {
      const raw = fs.readFileSync(OPTIONS_PATH, "utf8");
      fileOptions = JSON.parse(raw);
    }
  } catch (error) {
    console.error("Failed to parse /data/options.json, using defaults.", error.message);
  }

  const options = {
    ...DEFAULT_OPTIONS,
    ...fileOptions,
  };

  options.api_key = String(options.api_key || "").trim();
  options.regenerate_api_key = Boolean(options.regenerate_api_key);

  const shouldGenerateApiKey = options.regenerate_api_key || !options.api_key;
  if (shouldGenerateApiKey) {
    options.api_key = generateApiKey();
    options.regenerate_api_key = false;

    const optionsToPersist = {
      ...fileOptions,
      ...options,
    };
    const persisted = persistOptions(optionsToPersist);
    if (persisted) {
      console.log(`Generated API key: ${options.api_key}`);
    } else {
      console.warn("Using in-memory generated API key for this session only.");
    }
  }

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

module.exports = {
  loadOptions,
};
