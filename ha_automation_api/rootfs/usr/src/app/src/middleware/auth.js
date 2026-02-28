const fetch = require("node-fetch");
const { ApiError } = require("../errors");

const VALIDATION_TIMEOUT_MS = 7000;

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

function createAuthMiddleware(options) {
  const baseUrl = String(options.home_assistant_url || "").replace(/\/$/, "");

  return async function authMiddleware(req, _res, next) {
    try {
      const token = getBearerToken(req);
      if (!token) {
        throw new ApiError(401, "Missing or invalid Authorization header.");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

      let response;
      try {
        response = await fetch(`${baseUrl}/api/`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new ApiError(401, "Token validation failed.");
      }

      req.haToken = token;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  createAuthMiddleware,
};
