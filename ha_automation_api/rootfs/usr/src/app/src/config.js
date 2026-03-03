const fs = require("fs");

const DEFAULT_OPTIONS = {
  allow_list: true,
  allow_read: true,
  allow_search: true,
  allow_edit: false,
  allow_delete: false,
  allowed_ips: [],
  automations_file: "/config/automations.yaml",
  scripts_file: "/config/scripts.yaml",
  backup_keep: 10,
  home_assistant_url: "http://homeassistant:8123",
};

function loadOptions() {
  const optionsPath = "/data/options.json";
  let fileOptions = {};

  try {
    if (fs.existsSync(optionsPath)) {
      const raw = fs.readFileSync(optionsPath, "utf8");
      fileOptions = JSON.parse(raw);
    }
  } catch (error) {
    console.error("Failed to parse /data/options.json, using defaults.", error.message);
  }

  const options = {
    ...DEFAULT_OPTIONS,
    ...fileOptions,
  };

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
