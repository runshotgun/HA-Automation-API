const express = require("express");
const { loadOptions } = require("./config");
const { ApiError } = require("./errors");
const { createAuthMiddleware } = require("./middleware/auth");
const { createIpWhitelistMiddleware } = require("./middleware/ipWhitelist");
const { createPermissionMiddleware } = require("./middleware/permissions");
const { createWriteLockMiddleware } = require("./middleware/writeLock");
const { createReloadService } = require("./services/reloadService");
const { createAutomationFileService } = require("./services/automationFileService");
const { createAutomationsRouter } = require("./routes/automations");

const options = loadOptions();
const app = express();
const port = Number(process.env.PORT || 8099);

const reloadService = createReloadService(options);
const fileService = createAutomationFileService(options, reloadService);
const requirePermission = createPermissionMiddleware(options);
const writeLock = createWriteLockMiddleware();
const ipWhitelist = createIpWhitelistMiddleware(options);
const auth = createAuthMiddleware(options);

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ha-automation-api",
  });
});

app.use(ipWhitelist);
app.use(auth);
app.use(
  "/automations",
  createAutomationsRouter({
    fileService,
    requirePermission,
    writeLock,
  })
);

app.use((error, _req, res, _next) => {
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const body = {
    error: error.message || "Internal Server Error",
  };

  if (error.details) {
    body.details = error.details;
  }

  if (!(error instanceof ApiError)) {
    console.error("Unhandled error:", error);
  }

  res.status(statusCode).json(body);
});

app.listen(port, () => {
  console.log(`HA Automation API listening on port ${port}`);
});
