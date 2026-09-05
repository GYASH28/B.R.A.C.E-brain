"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { ProjectWatchService, relevantFile } = require("../core/project-watch-service");

test("project watcher excludes generated and temporary paths", () => {
  assert.equal(relevantFile("src/notes.md"), true);
  assert.equal(relevantFile("node_modules/pkg/index.js"), false);
  assert.equal(relevantFile("dist/bundle.js"), false);
  assert.equal(relevantFile("notes.md.swp"), false);
});

test("project watcher is opt-in, debounced, coalesced, and stoppable", async (context) => {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "brace-watch-"));
  fs.mkdirSync(path.join(rootPath, "src"));
  let changes = 0;
  const service = new ProjectWatchService({
    debounceMs: 1_000,
    onChange: async () => { changes += 1; },
  });
  context.after(() => {
    service.close();
    fs.rmSync(rootPath, { recursive: true, force: true });
  });
  assert.equal(service.status("fixture").enabled, false);
  service.enable({ id: "fixture", rootPath });
  fs.writeFileSync(path.join(rootPath, "src", "one.md"), "one");
  fs.writeFileSync(path.join(rootPath, "src", "two.md"), "two");
  await new Promise((resolve) => setTimeout(resolve, 1_250));
  assert.equal(changes, 1);
  service.disable("fixture");
  fs.writeFileSync(path.join(rootPath, "src", "three.md"), "three");
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  assert.equal(changes, 1);
});
