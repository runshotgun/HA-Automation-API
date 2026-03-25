const { ApiError } = require("../errors");

const PERMISSION_OPTION_MAP = {
  list: "allow_list",
  read: "allow_read",
  search: "allow_search",
  edit: "allow_edit",
  delete: "allow_delete",
};

function resolveOptions(optionsSource) {
  if (optionsSource && typeof optionsSource.getOptions === "function") {
    return optionsSource.getOptions();
  }
  return optionsSource || {};
}

function createPermissionMiddleware(optionsSource) {
  return function requirePermission(permissionName) {
    return function permissionMiddleware(_req, _res, next) {
      const optionName = PERMISSION_OPTION_MAP[permissionName];
      const options = resolveOptions(optionsSource);
      const allowed = optionName ? Boolean(options[optionName]) : false;

      if (!allowed) {
        return next(new ApiError(403, `Permission '${permissionName}' is disabled.`));
      }

      return next();
    };
  };
}

module.exports = {
  createPermissionMiddleware,
};
