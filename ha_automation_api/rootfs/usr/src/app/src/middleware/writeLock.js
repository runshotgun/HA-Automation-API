const { ApiError } = require("../errors");

function createWriteLockMiddleware() {
  let isLocked = false;

  return async function writeLockMiddleware(req, _res, next) {
    if (isLocked) {
      return next(new ApiError(429, "A write request is already in progress."));
    }

    isLocked = true;
    req.releaseWriteLock = () => {
      isLocked = false;
    };

    return next();
  };
}

module.exports = {
  createWriteLockMiddleware,
};
