const express = require("express");

function createAutomationsRouter(deps) {
  const { fileService, requirePermission, writeLock } = deps;
  const router = express.Router();
  const parseAutomationPayload = (body) => (body && typeof body === "object" && body.automation ? body.automation : body);

  router.get("/", requirePermission("list"), async (req, res, next) => {
    try {
      const automations = await fileService.searchAutomationMetadata(req.query || {});
      return res.status(200).json({ count: automations.length, automations });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/search", requirePermission("search"), async (req, res, next) => {
    try {
      const automations = await fileService.searchAutomationMetadata(req.query || {});
      return res.status(200).json({ count: automations.length, automations });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id", requirePermission("read"), async (req, res, next) => {
    try {
      const automation = await fileService.readAutomationById(req.params.id);
      return res.status(200).json({ automation });
    } catch (error) {
      return next(error);
    }
  });

  router.put("/:id", requirePermission("edit"), writeLock, async (req, res, next) => {
    try {
      const payload = parseAutomationPayload(req.body);
      const automation = await fileService.updateAutomation(req.params.id, payload, req.haToken);
      return res.status(200).json({ automation });
    } catch (error) {
      return next(error);
    } finally {
      if (typeof req.releaseWriteLock === "function") {
        req.releaseWriteLock();
      }
    }
  });

  router.patch("/:id", requirePermission("edit"), writeLock, async (req, res, next) => {
    try {
      const payload = parseAutomationPayload(req.body);
      const automation = await fileService.patchAutomation(req.params.id, payload, req.haToken);
      return res.status(200).json({ automation });
    } catch (error) {
      return next(error);
    } finally {
      if (typeof req.releaseWriteLock === "function") {
        req.releaseWriteLock();
      }
    }
  });

  router.delete("/:id", requirePermission("delete"), writeLock, async (req, res, next) => {
    try {
      const removed = await fileService.deleteAutomation(req.params.id, req.haToken);
      return res.status(200).json({ deleted: true, automation: removed });
    } catch (error) {
      return next(error);
    } finally {
      if (typeof req.releaseWriteLock === "function") {
        req.releaseWriteLock();
      }
    }
  });

  return router;
}

module.exports = {
  createAutomationsRouter,
};
