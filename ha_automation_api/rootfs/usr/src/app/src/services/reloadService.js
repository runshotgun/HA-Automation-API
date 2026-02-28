const fetch = require("node-fetch");
const { ApiError } = require("../errors");

const RELOAD_TIMEOUT_MS = 10000;

function createReloadService(options) {
  const baseUrl = String(options.home_assistant_url || "").replace(/\/$/, "");

  async function reloadAutomations(token) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RELOAD_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}/api/services/automation/reload`, {
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
        throw new ApiError(500, "Automation reload failed.", responseText);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Automation reload failed.", error.message);
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    reloadAutomations,
  };
}

module.exports = {
  createReloadService,
};
