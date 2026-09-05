"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MemoryStore } = require("../core/memory-store");
const { indexProject } = require("../core/project-indexer");

test("project indexing emits bounded file progress", async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-progress-"));
  const project = path.join(directory, "project");
  fs.mkdirSync(project, { recursive: true });
  for (let index = 0; index < 12; index += 1) fs.writeFileSync(path.join(project, `file-${index}.md`), `# File ${index}\nprogress fixture`);
  const store = new MemoryStore(path.join(directory, "brace.sqlite3"));
  context.after(() => { try { store.close(); } catch {} fs.rmSync(directory, { recursive: true, force: true }); });
  const progress = [];
  const result = await indexProject(store, { rootPath: project, onProgress: (item) => progress.push(item) });
  assert.equal(result.filesSeen, 12);
  assert.equal(progress[0].phase, "scanning");
  assert.ok(progress.some((item) => item.phase === "reading" && item.total === 12));
  assert.equal(progress.at(-1).phase, "complete");
  assert.equal(progress.at(-1).completed, 12);
  assert.equal(progress.at(-1).total, 12);
});

test("desktop bridge exposes progress subscription and cancellation without raw IPC", () => {
  const preload = fs.readFileSync(path.join(__dirname, "..", "electron", "preload.ts"), "utf8");
  assert.match(preload, /cancelBraceTask/);
  assert.match(preload, /onBraceTaskProgress/);
  assert.match(preload, /removeListener/);
});
