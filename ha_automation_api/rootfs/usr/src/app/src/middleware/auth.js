const crypto = require("crypto");
const { ApiError } = require("../errors");

const DEFAULT_SUPERVISOR_CORE_URL = "http://supervisor/core";

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

function getApiKey(req) {
  const directApiKey = req.headers["x-api-key"];
  if (typeof directApiKey === "string" && directApiKey.trim().length > 0) {
    return directApiKey.trim();
  }
  return getBearerToken(req);
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function resolveOptions(optionsSource) {
  if (optionsSource && typeof optionsSource.getOptions === "function") {
    return optionsSource.getOptions();
  }
  return optionsSource || {};
}

function createApiKeyManagedAuthMiddleware(optionsSource) {
  const supervisorToken = String(process.env.SUPERVISOR_TOKEN || "").trim();
  const supervisorCoreUrl = String(process.env.SUPERVISOR_CORE_URL || DEFAULT_SUPERVISOR_CORE_URL).replace(/\/$/, "");

  return function apiKeyManagedAuthMiddleware(req, _res, next) {
    try {
      const options = resolveOptions(optionsSource);
      const configuredApiKey = String(options.api_key || "").trim();

      if (!configuredApiKey) {
        throw new ApiError(500, "Add-on misconfiguration: api_key is required.");
      }

      if (!supervisorToken) {
        throw new ApiError(500, "Add-on misconfiguration: SUPERVISOR_TOKEN is not available.");
      }

      const providedApiKey = getApiKey(req);
      if (!providedApiKey) {
        throw new ApiError(
          401,
          "Missing API key. Provide it using X-API-Key or Authorization: Bearer <api_key>. Find the current key in Home Assistant > Settings > Apps > HA Automation REST API > Configuration > API key."
        );
      }

      if (!timingSafeEqual(providedApiKey, configuredApiKey)) {
        throw new ApiError(401, "Invalid API key.");
      }

      req.haAuth = {
        token: supervisorToken,
        baseUrl: supervisorCoreUrl,
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function createAuthMiddleware(optionsSource) {
  return createApiKeyManagedAuthMiddleware(optionsSource);
}

module.exports = {
  createAuthMiddleware,
};
