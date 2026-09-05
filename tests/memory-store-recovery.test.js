"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { MemoryStore, SCHEMA_VERSION } = require("../core/memory-store");
const { verifyDatabaseFile } = require("../core/database-recovery");

test("BRACE creates and verifies a recovery snapshot before migrating a real database", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-recovery-"));
  const databasePath = path.join(directory, "brace.sqlite3");
  context.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));

  const initial = new MemoryStore(databasePath);
  const memory = initial.createMemory({
    kind: "fact",
    scope: "global",
    title: "Recovery fixture",
    content: "This durable record must survive a schema migration.",
  }).memory;
  initial.close();

  const downgradeMarker = new DatabaseSync(databasePath);
  downgradeMarker.exec("PRAGMA user_version = 4");
  downgradeMarker.close();

  const migrated = new MemoryStore(databasePath);
  assert.equal(migrated.stats().schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated.getMemory(memory.id).title, "Recovery fixture");
  assert.ok(migrated.migrationBackup);
  assert.equal(migrated.migrationBackup.from, 4);
  assert.equal(migrated.migrationBackup.to, SCHEMA_VERSION);
  assert.equal(migrated.quickCheck().ok, true);

  const backup = verifyDatabaseFile(migrated.migrationBackup.path);
  assert.equal(backup.schemaVersion, 4);
  const backupDb = new DatabaseSync(backup.path, { readOnly: true });
  assert.equal(backupDb.prepare("SELECT title FROM memories WHERE id = ?").get(memory.id).title, "Recovery fixture");
  backupDb.close();
  migrated.close();
});

test("database verification rejects a non-SQLite recovery candidate", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-recovery-invalid-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const invalid = path.join(directory, "invalid.sqlite3");
  fs.writeFileSync(invalid, "not a database");
  assert.throws(() => verifyDatabaseFile(invalid));
});
