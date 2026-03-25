const express = require("express");

function createScriptsRouter(deps) {
  const { fileService, requirePermission, writeLock } = deps;
  const router = express.Router();
  const parseScriptPayload = (body) => (body && typeof body === "object" && body.script ? body.script : body);

  router.get("/", requirePermission("list"), async (req, res, next) => {
    try {
      const scripts = await fileService.searchScriptMetadata(req.query || {});
      return res.status(200).json({ count: scripts.length, scripts });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/search", requirePermission("search"), async (req, res, next) => {
    try {
      const scripts = await fileService.searchScriptMetadata(req.query || {});
      return res.status(200).json({ count: scripts.length, scripts });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id", requirePermission("read"), async (req, res, next) => {
    try {
      const script = await fileService.readScriptById(req.params.id);
      return res.status(200).json({ script });
    } catch (error) {
      return next(error);
    }
  });

  router.put("/:id", requirePermission("edit"), writeLock, async (req, res, next) => {
    try {
      const payload = parseScriptPayload(req.body);
      const script = await fileService.updateScript(req.params.id, payload, req.haAuth);
      return res.status(200).json({ script });
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
      const payload = parseScriptPayload(req.body);
      const script = await fileService.patchScript(req.params.id, payload, req.haAuth);
      return res.status(200).json({ script });
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
      const removed = await fileService.deleteScript(req.params.id, req.haAuth);
      return res.status(200).json({ deleted: true, script: removed });
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
  createScriptsRouter,
};
