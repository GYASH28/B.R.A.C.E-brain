"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const COUNT_TABLES = [
  "projects",
  "sources",
  "source_chunks",
  "memories",
  "decisions",
  "events",
  "entities",
  "relations",
  "automations",
];

function assertRegularDatabase(filePath) {
  const resolved = path.resolve(String(filePath || ""));
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error("Choose a BRACE SQLite backup file.");
  if (stat.size < 512) throw new Error("The selected backup is too small to be a BRACE database.");
  return { resolved, bytes: stat.size };
}

function inspectSqliteDatabase(filePath) {
  const { resolved, bytes } = assertRegularDatabase(filePath);
  const database = new DatabaseSync(resolved, { readOnly: true });
  try {
    const check = database.prepare("PRAGMA quick_check").all().map((row) => String(row.quick_check));
    if (check.length !== 1 || check[0] !== "ok") {
      throw new Error(`SQLite integrity check failed: ${check.join(", ") || "unknown result"}`);
    }
    const schemaVersion = Number(database.prepare("PRAGMA user_version").get().user_version || 0);
    const available = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => String(row.name)));
    if (!available.has("memories") || !available.has("projects")) {
      throw new Error("The selected database does not contain a BRACE schema.");
    }
    const counts = {};
    for (const table of COUNT_TABLES) {
      counts[table] = available.has(table)
        ? Number(database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count || 0)
        : 0;
    }
    return { path: resolved, bytes, schemaVersion, integrity: "ok", counts };
  } finally {
    database.close();
  }
}

function restoreSqliteDatabase(input) {
  const currentPath = path.resolve(String(input.currentPath || ""));
  const backupPath = path.resolve(String(input.backupPath || ""));
  if (currentPath === backupPath) throw new Error("Choose a backup different from the active database.");
  const inspected = inspectSqliteDatabase(backupPath);
  const recoveryDirectory = path.resolve(String(input.recoveryDirectory || path.dirname(currentPath)));
  fs.mkdirSync(recoveryDirectory, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safetyPath = path.join(recoveryDirectory, `brace-pre-restore-${stamp}.sqlite3`);
  const temporaryPath = path.join(path.dirname(currentPath), `.brace-restore-${randomUUID()}.tmp`);
  fs.copyFileSync(backupPath, temporaryPath, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(temporaryPath, 0o600);
  inspectSqliteDatabase(temporaryPath);
  let displaced = false;
  try {
    fs.renameSync(currentPath, safetyPath);
    displaced = true;
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = `${currentPath}${suffix}`;
      if (fs.existsSync(sidecar)) fs.renameSync(sidecar, `${safetyPath}${suffix}`);
    }
    fs.renameSync(temporaryPath, currentPath);
    return { ...inspected, path: currentPath, safetyPath, restoredAt: new Date().toISOString() };
  } catch (error) {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
    if (displaced && !fs.existsSync(currentPath) && fs.existsSync(safetyPath)) {
      fs.renameSync(safetyPath, currentPath);
    }
    throw error;
  }
}

module.exports = {
  inspectSqliteDatabase,
  restoreSqliteDatabase,
};
