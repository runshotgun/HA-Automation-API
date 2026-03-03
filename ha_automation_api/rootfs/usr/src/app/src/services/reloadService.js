const fetch = require("node-fetch");
const { ApiError } = require("../errors");

const RELOAD_TIMEOUT_MS = 10000;

function createReloadService(options) {
  const baseUrl = String(options.home_assistant_url || "").replace(/\/$/, "");

  async function callReloadService(pathname, token, errorMessage) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RELOAD_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${pathname}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new ApiError(500, errorMessage, responseText);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, errorMessage, error.message);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function reloadAutomations(token) {
    return callReloadService("/api/services/automation/reload", token, "Automation reload failed.");
  }

  async function reloadScripts(token) {
    return callReloadService("/api/services/script/reload", token, "Script reload failed.");
  }

  return {
    reloadAutomations,
    reloadScripts,
  };
}

module.exports = {
  createReloadService,
};
