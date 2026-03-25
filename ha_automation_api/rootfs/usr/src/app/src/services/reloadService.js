const fetch = require("node-fetch");
const { ApiError } = require("../errors");

const RELOAD_TIMEOUT_MS = 10000;

function createReloadService() {
  async function callReloadService(pathname, authContext, errorMessage) {
    const token = authContext?.token;
    const baseUrl = String(authContext?.baseUrl || "").replace(/\/$/, "");
    if (!token) {
      throw new ApiError(500, "Reload auth token is not available.");
    }
    if (!baseUrl) {
      throw new ApiError(500, "Reload base URL is not available.");
    }

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

  async function reloadAutomations(authContext) {
    return callReloadService("/api/services/automation/reload", authContext, "Automation reload failed.");
  }

  async function reloadScripts(authContext) {
    return callReloadService("/api/services/script/reload", authContext, "Script reload failed.");
  }

  return {
    reloadAutomations,
    reloadScripts,
  };
}

module.exports = {
  createReloadService,
};
