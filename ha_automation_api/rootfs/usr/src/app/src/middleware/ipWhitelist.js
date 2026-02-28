const { ApiError } = require("../errors");

function normalizeIp(ip) {
  if (!ip || typeof ip !== "string") {
    return "";
  }

  const trimmed = ip.trim();
  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice(7);
  }
  if (trimmed === "::1") {
    return "127.0.0.1";
  }

  return trimmed;
}

function extractClientIp(req) {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string" && xForwardedFor.trim().length > 0) {
    const firstIp = xForwardedFor.split(",")[0];
    const normalized = normalizeIp(firstIp);
    if (normalized) {
      return normalized;
    }
  }

  const xRealIp = req.headers["x-real-ip"];
  if (typeof xRealIp === "string" && xRealIp.trim().length > 0) {
    const normalized = normalizeIp(xRealIp);
    if (normalized) {
      return normalized;
    }
  }

  return normalizeIp(req.ip || req.socket?.remoteAddress || "");
}

function createIpWhitelistMiddleware(options) {
  const allowedIps = Array.isArray(options.allowed_ips) ? options.allowed_ips.map(normalizeIp).filter(Boolean) : [];
  const allowedSet = new Set(allowedIps);

  return function ipWhitelistMiddleware(req, _res, next) {
    const sourceIp = extractClientIp(req);
    if (allowedSet.has(sourceIp)) {
      return next();
    }

    return next(
      new ApiError(
        403,
        `Access denied: source IP '${sourceIp || "unknown"}' is not in the configured allowed_ips whitelist.`,
        {
          source_ip: sourceIp || null,
          configured_allowed_ips: allowedIps,
        }
      )
    );
  };
}

module.exports = {
  createIpWhitelistMiddleware,
};
