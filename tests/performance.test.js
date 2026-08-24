const assert = require("node:assert/strict");
const test = require("node:test");
const { performance } = require("node:perf_hooks");
const { MemoryStore } = require("../core/memory-store");

test("local memory search remains responsive with a practical corpus", () => {
  const store = new MemoryStore(":memory:");
  const started = performance.now();
  for (let index = 0; index < 1_500; index += 1) {
    store.createMemory({
      kind: index % 5 === 0 ? "decision" : "fact",
      scope: `project:${index % 12}`,
      title: `Synthetic architecture record ${index}`,
      summary: `Bounded context for fictional module ${index % 73}`,
      content: `Synthetic memory ${index} keeps canonical source provenance and local retrieval evidence.`,
      tags: ["synthetic", `module-${index % 73}`],
    });
  }
  const insertedMs = performance.now() - started;
  const searchStarted = performance.now();
  const result = store.search("canonical source provenance", { limit: 20 });
  const searchMs = performance.now() - searchStarted;
  store.close();

  assert.equal(result.mode, "lexical");
  assert.equal(result.results.length, 20);
  assert.ok(insertedMs < 20_000, `fixture insert took ${insertedMs.toFixed(0)}ms`);
  assert.ok(searchMs < 1_000, `search took ${searchMs.toFixed(0)}ms`);
});
