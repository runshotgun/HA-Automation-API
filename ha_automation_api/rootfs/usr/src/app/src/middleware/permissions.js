const { ApiError } = require("../errors");

function createPermissionMiddleware(options) {
  const permissions = {
    list: Boolean(options.allow_list),
    read: Boolean(options.allow_read),
    edit: Boolean(options.allow_edit),
    delete: Boolean(options.allow_delete),
  };

  return function requirePermission(permissionName) {
    return function permissionMiddleware(_req, _res, next) {
      if (!permissions[permissionName]) {
        return next(new ApiError(403, `Permission '${permissionName}' is disabled.`));
      }

      return next();
    };
  };
}

module.exports = {
  createPermissionMiddleware,
};
