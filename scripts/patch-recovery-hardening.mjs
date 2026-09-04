#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, "core/memory-store.js");
let source = fs.readFileSync(target, "utf8");

function required(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Recovery patch could not locate ${label}`);
  source = source.replace(search, replacement);
}

if (!source.includes("function sqliteStringLiteral")) {
  required(
    'function ensureParent(filePath) {\n  if (filePath === ":memory:") return;\n  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });\n}\n',
    'function ensureParent(filePath) {\n' +
      '  if (filePath === ":memory:") return;\n' +
      '  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });\n' +
      '}\n\n' +
      'function sqliteStringLiteral(value) {\n' +
      '  return `\'${String(value).replaceAll("\'", "\'\'")}\'`;\n' +
      '}\n\n' +
      'function verifyDatabaseFile(filePath) {\n' +
      '  const resolved = path.resolve(filePath);\n' +
      '  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {\n' +
      '    throw new Error("BRACE recovery database is missing.");\n' +
      '  }\n' +
      '  const verification = new DatabaseSync(resolved, { readOnly: true });\n' +
      '  try {\n' +
      '    const rows = verification.prepare("PRAGMA quick_check").all();\n' +
      '    const messages = rows.map((row) => String(row.quick_check || Object.values(row)[0] || ""));\n' +
      '    if (messages.length !== 1 || messages[0].toLowerCase() !== "ok") {\n' +
      '      throw new Error(`SQLite quick_check failed: ${messages.join("; ") || "unknown result"}`);\n' +
      '    }\n' +
      '    return {\n' +
      '      path: resolved,\n' +
      '      bytes: fs.statSync(resolved).size,\n' +
      '      schemaVersion: Number(verification.prepare("PRAGMA user_version").get().user_version || 0),\n' +
      '    };\n' +
      '  } finally {\n' +
      '    verification.close();\n' +
      '  }\n' +
      '}\n',
    "database path helpers",
  );
}

if (!source.includes("createPreMigrationBackup(currentVersion)")) {
  required(
    '    if (databasePath !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL;");\n    this.migrate();\n',
    '    if (databasePath !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL;");\n' +
      '    const currentVersion = Number(this.db.prepare("PRAGMA user_version").get().user_version || 0);\n' +
      '    this.migrationBackup = currentVersion > 0 && currentVersion < SCHEMA_VERSION\n' +
      '      ? this.createPreMigrationBackup(currentVersion)\n' +
      '      : null;\n' +
      '    this.migrate();\n',
    "constructor migration call",
  );

  required(
    '  migrate() {\n',
    '  createPreMigrationBackup(currentVersion) {\n' +
      '    if (this.databasePath === ":memory:") return null;\n' +
      '    const backupDirectory = path.join(path.dirname(path.resolve(this.databasePath)), "backups");\n' +
      '    fs.mkdirSync(backupDirectory, { recursive: true });\n' +
      '    const timestamp = nowIso().replace(/[:.]/g, "-");\n' +
      '    const target = path.join(\n' +
      '      backupDirectory,\n' +
      '      `brace-pre-migration-v${currentVersion}-to-v${SCHEMA_VERSION}-${timestamp}.sqlite3`,\n' +
      '    );\n' +
      '    this.db.exec(`VACUUM INTO ${sqliteStringLiteral(target)}`);\n' +
      '    try { fs.chmodSync(target, 0o600); } catch {}\n' +
      '    const verified = verifyDatabaseFile(target);\n' +
      '    if (verified.schemaVersion !== currentVersion) {\n' +
      '      throw new Error("Pre-migration backup schema version does not match the source database.");\n' +
      '    }\n' +
      '    const previous = fs.readdirSync(backupDirectory)\n' +
      '      .filter((name) => /^brace-pre-migration-.*\\.sqlite3$/.test(name))\n' +
      '      .map((name) => ({ name, path: path.join(backupDirectory, name) }))\n' +
      '      .map((item) => ({ ...item, mtimeMs: fs.statSync(item.path).mtimeMs }))\n' +
      '      .sort((left, right) => right.mtimeMs - left.mtimeMs);\n' +
      '    for (const stale of previous.slice(5)) {\n' +
      '      try { fs.rmSync(stale.path, { force: true }); } catch {}\n' +
      '    }\n' +
      '    return { ...verified, createdAt: nowIso(), from: currentVersion, to: SCHEMA_VERSION };\n' +
      '  }\n\n' +
      '  quickCheck() {\n' +
      '    const rows = this.db.prepare("PRAGMA quick_check").all();\n' +
      '    const messages = rows.map((row) => String(row.quick_check || Object.values(row)[0] || ""));\n' +
      '    return { ok: messages.length === 1 && messages[0].toLowerCase() === "ok", messages };\n' +
      '  }\n\n' +
      '  migrate() {\n',
    "migration method",
  );
}

if (!source.includes("verifyDatabaseFile,")) {
  required(
    '  tokenJaccard,\n};\n',
    '  tokenJaccard,\n  verifyDatabaseFile,\n};\n',
    "module exports",
  );
}

fs.writeFileSync(target, source.replace(/\r\n/g, "\n"));

const testPath = path.join(root, "tests/memory-store-recovery.test.js");
if (!fs.existsSync(testPath)) {
  fs.writeFileSync(testPath, `"use strict";\n\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst os = require("node:os");\nconst path = require("node:path");\nconst test = require("node:test");\nconst { DatabaseSync } = require("node:sqlite");\nconst { MemoryStore, verifyDatabaseFile } = require("../core/memory-store");\n\ntest("BRACE creates and verifies a recovery snapshot before migrating a real database", (context) => {\n  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-recovery-"));\n  const databasePath = path.join(directory, "brace.sqlite3");\n  context.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));\n\n  const initial = new MemoryStore(databasePath);\n  const memory = initial.createMemory({\n    kind: "fact",\n    scope: "global",\n    title: "Recovery fixture",\n    content: "This durable record must survive a schema migration.",\n  }).memory;\n  initial.close();\n\n  const downgradeMarker = new DatabaseSync(databasePath);\n  downgradeMarker.exec("PRAGMA user_version = 4");\n  downgradeMarker.close();\n\n  const migrated = new MemoryStore(databasePath);\n  assert.equal(migrated.stats().schemaVersion, 5);\n  assert.equal(migrated.getMemory(memory.id).title, "Recovery fixture");\n  assert.ok(migrated.migrationBackup);\n  assert.equal(migrated.migrationBackup.from, 4);\n  assert.equal(migrated.migrationBackup.to, 5);\n  assert.equal(migrated.quickCheck().ok, true);\n\n  const backup = verifyDatabaseFile(migrated.migrationBackup.path);\n  assert.equal(backup.schemaVersion, 4);\n  const backupDb = new DatabaseSync(backup.path, { readOnly: true });\n  assert.equal(backupDb.prepare("SELECT title FROM memories WHERE id = ?").get(memory.id).title, "Recovery fixture");\n  backupDb.close();\n  migrated.close();\n});\n\ntest("database verification rejects a non-SQLite recovery candidate", (context) => {\n  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-recovery-invalid-"));\n  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));\n  const invalid = path.join(directory, "invalid.sqlite3");\n  fs.writeFileSync(invalid, "not a database");\n  assert.throws(() => verifyDatabaseFile(invalid));\n});\n`);
}

process.stdout.write("Applied BRACE migration recovery hardening.\n");
