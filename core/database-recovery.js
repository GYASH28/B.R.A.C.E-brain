"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const PENDING_NAME = "restore-pending.sqlite3";
const MANIFEST_NAME = "restore-pending.json";

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function verifyDatabaseFile(filePath, options = {}) {
  const resolved = path.resolve(String(filePath || ""));
  if (!filePath || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error("Choose an existing SQLite backup file.");
  }
  const db = new DatabaseSync(resolved, { readOnly: true });
  try {
    const rows = db.prepare("PRAGMA quick_check").all();
    const messages = rows.map((row) => String(row.quick_check || Object.values(row)[0] || ""));
    if (messages.length !== 1 || messages[0].toLowerCase() !== "ok") {
      throw new Error(`SQLite integrity check failed: ${messages.join("; ") || "unknown result"}`);
    }
    const schemaVersion = Number(db.prepare("PRAGMA user_version").get().user_version || 0);
    if (options.maximumSchemaVersion !== undefined && schemaVersion > options.maximumSchemaVersion) {
      throw new Error(
        `Backup schema ${schemaVersion} is newer than this BRACE build supports (${options.maximumSchemaVersion}).`,
      );
    }
    return {
      path: resolved,
      bytes: fs.statSync(resolved).size,
      schemaVersion,
      quickCheck: "ok",
    };
  } finally {
    db.close();
  }
}

function pendingPaths(dataDirectory) {
  const root = path.resolve(dataDirectory);
  return {
    staged: path.join(root, PENDING_NAME),
    manifest: path.join(root, MANIFEST_NAME),
  };
}

function stageRestore(dataDirectory, sourcePath, options = {}) {
  const root = path.resolve(dataDirectory);
  fs.mkdirSync(root, { recursive: true });
  const candidate = verifyDatabaseFile(sourcePath, {
    maximumSchemaVersion: options.maximumSchemaVersion,
  });
  const { staged, manifest } = pendingPaths(root);
  const temporary = `${staged}.tmp-${process.pid}-${Date.now()}`;
  fs.copyFileSync(candidate.path, temporary);
  try { fs.chmodSync(temporary, 0o600); } catch {}
  const stagedVerification = verifyDatabaseFile(temporary, {
    maximumSchemaVersion: options.maximumSchemaVersion,
  });
  fs.renameSync(temporary, staged);
  const metadata = {
    requestedAt: new Date().toISOString(),
    sourceBytes: candidate.bytes,
    sourceSchemaVersion: candidate.schemaVersion,
    stagedBytes: stagedVerification.bytes,
  };
  fs.writeFileSync(manifest, `${JSON.stringify(metadata, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return { ...metadata, staged };
}

function applyPendingRestore(dataDirectory, databasePath, options = {}) {
  const root = path.resolve(dataDirectory);
  const destination = path.resolve(databasePath);
  const { staged, manifest } = pendingPaths(root);
  if (!fs.existsSync(staged) || !fs.existsSync(manifest)) return null;

  const stagedVerification = verifyDatabaseFile(staged, {
    maximumSchemaVersion: options.maximumSchemaVersion,
  });
  const backupDirectory = path.join(root, "backups");
  fs.mkdirSync(backupDirectory, { recursive: true });
  const displaced = path.join(
    backupDirectory,
    `brace-before-restore-${safeTimestamp()}.sqlite3`,
  );

  if (fs.existsSync(destination)) fs.renameSync(destination, displaced);
  for (const sidecar of [`${destination}-wal`, `${destination}-shm`]) {
    try { fs.rmSync(sidecar, { force: true }); } catch {}
  }

  try {
    fs.renameSync(staged, destination);
    try { fs.chmodSync(destination, 0o600); } catch {}
    const restored = verifyDatabaseFile(destination, {
      maximumSchemaVersion: options.maximumSchemaVersion,
    });
    fs.rmSync(manifest, { force: true });
    return {
      restored: true,
      restoredAt: new Date().toISOString(),
      schemaVersion: restored.schemaVersion,
      bytes: restored.bytes,
      displacedBackup: fs.existsSync(displaced) ? displaced : null,
      stagedSchemaVersion: stagedVerification.schemaVersion,
    };
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

module.exports = {
  MANIFEST_NAME,
  PENDING_NAME,
  applyPendingRestore,
  cancelPendingRestore,
  pendingPaths,
  stageRestore,
  verifyDatabaseFile,
};
