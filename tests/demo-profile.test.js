const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MemoryStore } = require("../core/memory-store");
const { initializeDemoProfile } = require("../core/demo-profile");

test("synthetic demo initialization is idempotent and contains no user material", async (context) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "brace-demo-test-"));
  context.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const store = new MemoryStore(path.join(temporary, "brace.sqlite3"));
  context.after(() => store.close());
  const options = {
    sourceRoot: path.resolve(__dirname, "../examples/demo-workspace"),
    profileRoot: path.join(temporary, "profile"),
  };

  await initializeDemoProfile(store, options);
  await initializeDemoProfile(store, options);

  const stats = store.stats();
  assert.equal(stats.projects, 1);
  assert.equal(stats.memories, 3);
  assert.equal(stats.decisions, 1);
  assert.equal(stats.sources, 3);
  assert.equal(stats.sourceChunks, 11);
  assert.match(store.listProjects()[0].name, /synthetic demo/i);
  assert.doesNotMatch(JSON.stringify(store.exportData()), /C:\\\\Users\\|\/home\//);
});
