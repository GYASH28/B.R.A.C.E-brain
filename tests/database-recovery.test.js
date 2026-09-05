"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MemoryStore } = require("../core/memory-store");
const { inspectSqliteDatabase, restoreSqliteDatabase } = require("../core/database-recovery");

test("backup inspection and atomic restore preserve a recoverable current database", async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-restore-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const currentPath = path.join(directory, "current.sqlite3");
  const backupPath = path.join(directory, "candidate.sqlite3");
  const recoveryDirectory = path.join(directory, "recovery");
  const current = new MemoryStore(currentPath);
  current.createMemory({ title: "Current state", content: "Preserve me in the safety copy." });
  current.close();
  const candidate = new MemoryStore(backupPath);
  candidate.createMemory({ title: "Restored state", content: "This state should become active." });
  candidate.createMemory({ title: "Second restored memory", content: "Synthetic recovery fixture." });
  candidate.close();

  const preview = inspectSqliteDatabase(backupPath);
  assert.equal(preview.integrity, "ok");
  assert.equal(preview.counts.memories, 2);
  const result = restoreSqliteDatabase({ currentPath, backupPath, recoveryDirectory });
  assert.ok(fs.existsSync(result.safetyPath));
  const restored = new MemoryStore(currentPath);
  assert.equal(restored.stats().memories, 2);
  restored.close();
  const safety = new MemoryStore(result.safetyPath);
  assert.equal(safety.stats().memories, 1);
  safety.close();
});

test("backup inspection rejects non-BRACE files", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-restore-invalid-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const invalid = path.join(directory, "invalid.sqlite3");
  fs.writeFileSync(invalid, "not a database".repeat(100));
  assert.throws(() => inspectSqliteDatabase(invalid), /file is not a database|BRACE database|integrity/i);
});
