"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PENDING_NAME = "restore-pending.sqlite3";
const MANIFEST_NAME = "restore-pending.json";
const COUNT_TABLES = ["projects", "sources", "source_chunks", "memories", "decisions", "events", "entities", "relations", "automations"];

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function assertRegularDatabase(filePath) {
  const resolved = path.resolve(String(filePath || ""));
  if (!filePath || !fs.existsSync(resolved)) throw new Error("Choose an existing SQLite backup file.");
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error("Choose a BRACE SQLite backup file.");
  if (stat.size < 512) throw new Error("The selected backup is too small to be a BRACE database.");
  return { resolved, bytes: stat.size };
}

function verifyDatabaseFile(filePath, options = {}) {
  const { resolved, bytes } = assertRegularDatabase(filePath);
  const database = new DatabaseSync(resolved, { readOnly: true });
  try {
    const messages = database.prepare("PRAGMA quick_check").all().map((row) => String(row.quick_check || Object.values(row)[0] || ""));
    if (messages.length !== 1 || messages[0].toLowerCase() !== "ok") {
      throw new Error(`SQLite integrity check failed: ${messages.join("; ") || "unknown result"}`);
    }
    const schemaVersion = Number(database.prepare("PRAGMA user_version").get().user_version || 0);
    if (options.maximumSchemaVersion !== undefined && schemaVersion > options.maximumSchemaVersion) {
      throw new Error(`Backup schema ${schemaVersion} is newer than this BRACE build supports (${options.maximumSchemaVersion}).`);
    }
    return { path: resolved, bytes, schemaVersion, quickCheck: "ok" };
  } finally {
    database.close();
  }
}

function inspectSqliteDatabase(filePath, options = {}) {
  const verified = verifyDatabaseFile(filePath, options);
  const database = new DatabaseSync(verified.path, { readOnly: true });
  try {
    const available = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => String(row.name)));
    if (!available.has("memories") || !available.has("projects")) throw new Error("The selected database does not contain a BRACE schema.");
    const counts = {};
    for (const table of COUNT_TABLES) {
      counts[table] = available.has(table) ? Number(database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count || 0) : 0;
    }
    return { ...verified, integrity: "ok", counts };
  } finally {
    database.close();
  }
}

function pendingPaths(dataDirectory) {
  const root = path.resolve(String(dataDirectory || ""));
  return { staged: path.join(root, PENDING_NAME), manifest: path.join(root, MANIFEST_NAME) };
}

function stageRestore(dataDirectory, sourcePath, options = {}) {
  const root = path.resolve(String(dataDirectory || ""));
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const candidate = inspectSqliteDatabase(sourcePath, options);
  const { staged, manifest } = pendingPaths(root);
  const temporary = `${staged}.tmp-${process.pid}-${randomUUID()}`;
  fs.copyFileSync(candidate.path, temporary, fs.constants.COPYFILE_EXCL);
  try { fs.chmodSync(temporary, 0o600); } catch {}
  try {
    const stagedVerification = inspectSqliteDatabase(temporary, options);
    fs.renameSync(temporary, staged);
    const metadata = { requestedAt: new Date().toISOString(), sourceBytes: candidate.bytes, sourceSchemaVersion: candidate.schemaVersion, stagedBytes: stagedVerification.bytes };
    fs.writeFileSync(manifest, `${JSON.stringify(metadata, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    return { ...metadata, staged };
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }); } catch {}
    throw error;
  }
}

function applyPendingRestore(dataDirectory, databasePath, options = {}) {
  const root = path.resolve(String(dataDirectory || ""));
  const destination = path.resolve(String(databasePath || ""));
  const { staged, manifest } = pendingPaths(root);
  if (!fs.existsSync(staged) || !fs.existsSync(manifest)) return null;
  const stagedVerification = inspectSqliteDatabase(staged, options);
  const recoveryDirectory = path.join(root, "recovery");
  fs.mkdirSync(recoveryDirectory, { recursive: true, mode: 0o700 });
  const displaced = path.join(recoveryDirectory, `brace-before-restore-${safeTimestamp()}.sqlite3`);
  if (fs.existsSync(destination)) fs.renameSync(destination, displaced);
  for (const sidecar of [`${destination}-wal`, `${destination}-shm`]) {
    try { fs.rmSync(sidecar, { force: true }); } catch {}
  }
  try {
    fs.renameSync(staged, destination);
    try { fs.chmodSync(destination, 0o600); } catch {}
    const restored = inspectSqliteDatabase(destination, options);
    fs.rmSync(manifest, { force: true });
    return { restored: true, restoredAt: new Date().toISOString(), schemaVersion: restored.schemaVersion, bytes: restored.bytes, safetyPath: fs.existsSync(displaced) ? displaced : null, stagedSchemaVersion: stagedVerification.schemaVersion };
  } catch (error) {
    try { fs.rmSync(destination, { force: true }); } catch {}
    if (fs.existsSync(displaced)) fs.renameSync(displaced, destination);
    throw error;
  }
}

function cancelPendingRestore(dataDirectory) {
  const { staged, manifest } = pendingPaths(dataDirectory);
  let removed = false;
  for (const item of [staged, manifest]) {
    if (!fs.existsSync(item)) continue;
    fs.rmSync(item, { force: true });
    removed = true;
  }
  return removed;
}

// Compatibility seam for recovery tooling. The desktop runtime uses the safer
// stage/apply lifecycle and never swaps an active SQLite file while it is open.
function restoreSqliteDatabase(input) {
  const currentPath = path.resolve(String(input.currentPath || ""));
  const dataDirectory = path.dirname(currentPath);
  stageRestore(dataDirectory, input.backupPath, input);
  return applyPendingRestore(dataDirectory, currentPath, input);
}

module.exports = { MANIFEST_NAME, PENDING_NAME, applyPendingRestore, cancelPendingRestore, inspectSqliteDatabase, pendingPaths, restoreSqliteDatabase, stageRestore, verifyDatabaseFile };
