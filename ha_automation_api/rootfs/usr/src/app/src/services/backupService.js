const fs = require("fs/promises");
const path = require("path");
const { ApiError } = require("../errors");

function createBackupFilePath(targetPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${targetPath}.bak.${timestamp}`;
}

async function createBackup(targetPath) {
  const backupPath = createBackupFilePath(targetPath);
  await fs.copyFile(targetPath, backupPath);
  return backupPath;
}

async function rotateBackups(targetPath, keepCount) {
  const directory = path.dirname(targetPath);
  const fileName = path.basename(targetPath);
  const prefix = `${fileName}.bak.`;
  const entries = await fs.readdir(directory, { withFileTypes: true });

  const backups = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
    .map((entry) => path.join(directory, entry.name));

  if (backups.length <= keepCount) {
    return;
  }

  const sorted = await Promise.all(
    backups.map(async (backupPath) => {
      const stat = await fs.stat(backupPath);
      return { backupPath, mtimeMs: stat.mtimeMs };
    })
  );

  sorted.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const toDelete = sorted.slice(keepCount).map((item) => item.backupPath);

  await Promise.all(toDelete.map((backupPath) => fs.unlink(backupPath)));
}

async function restoreBackup(backupPath, targetPath) {
  try {
    await fs.copyFile(backupPath, targetPath);
  } catch (error) {
    throw new ApiError(500, "Failed to restore backup after write failure.", error.message);
  }
}

module.exports = {
  createBackup,
  rotateBackups,
  restoreBackup,
};
