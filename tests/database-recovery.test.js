"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const {
  applyPendingRestore,
  cancelPendingRestore,
  pendingPaths,
  stageRestore,
  verifyDatabaseFile,
} = require("../core/database-recovery");

function makeDatabase(filePath, schemaVersion, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec("CREATE TABLE fixture(value TEXT NOT NULL)");
  db.prepare("INSERT INTO fixture(value) VALUES (?)").run(value);
  db.exec(`PRAGMA user_version = ${schemaVersion}`);
  db.close();
}

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-restore-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  return {
    directory,
    dataDirectory: path.join(directory, "data"),
    live: path.join(directory, "data", "brace.sqlite3"),
    candidate: path.join(directory, "candidate.sqlite3"),
  };
}

test("restore staging verifies and copies the candidate without touching the live database", (context) => {
  const { dataDirectory, live, candidate } = fixture(context);
  makeDatabase(live, 5, "live");
  makeDatabase(candidate, 5, "candidate");

  const staged = stageRestore(dataDirectory, candidate, { maximumSchemaVersion: 5 });
  assert.equal(staged.sourceSchemaVersion, 5);
  assert.equal(verifyDatabaseFile(live).schemaVersion, 5);
  const liveDb = new DatabaseSync(live, { readOnly: true });
  assert.equal(liveDb.prepare("SELECT value FROM fixture").get().value, "live");
  liveDb.close();
  const pending = pendingPaths(dataDirectory);
  assert.equal(fs.existsSync(pending.staged), true);
  assert.equal(fs.existsSync(pending.manifest), true);
});

test("pending restore swaps only after startup application and keeps displaced database", (context) => {
  const { dataDirectory, live, candidate } = fixture(context);
  makeDatabase(live, 5, "live");
  makeDatabase(candidate, 4, "restored");
  stageRestore(dataDirectory, candidate, { maximumSchemaVersion: 5 });

  const result = applyPendingRestore(dataDirectory, live, { maximumSchemaVersion: 5 });
  assert.equal(result.restored, true);
  assert.equal(result.schemaVersion, 4);
  assert.ok(result.displacedBackup);
  assert.equal(fs.existsSync(result.displacedBackup), true);
  const restored = new DatabaseSync(live, { readOnly: true });
  assert.equal(restored.prepare("SELECT value FROM fixture").get().value, "restored");
  restored.close();
  assert.equal(fs.existsSync(pendingPaths(dataDirectory).manifest), false);
});

test("newer-schema restore candidates are rejected", (context) => {
  const { dataDirectory, candidate } = fixture(context);
  makeDatabase(candidate, 99, "future");
  assert.throws(
    () => stageRestore(dataDirectory, candidate, { maximumSchemaVersion: 5 }),
    /newer than this BRACE build supports/,
  );
});

test("pending restore can be cancelled without changing live data", (context) => {
  const { dataDirectory, live, candidate } = fixture(context);
  makeDatabase(live, 5, "live");
  makeDatabase(candidate, 5, "candidate");
  stageRestore(dataDirectory, candidate, { maximumSchemaVersion: 5 });
  assert.equal(cancelPendingRestore(dataDirectory), true);
  assert.equal(cancelPendingRestore(dataDirectory), false);
  const liveDb = new DatabaseSync(live, { readOnly: true });
  assert.equal(liveDb.prepare("SELECT value FROM fixture").get().value, "live");
  liveDb.close();
});
