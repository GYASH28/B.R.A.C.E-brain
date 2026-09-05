"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { MemoryStore } = require("../core/memory-store");

const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "retrieval-evaluation.json"), "utf8"));

function reciprocalRank(results, expectedId) {
  if (!expectedId) return results.length === 0 ? 1 : 0;
  const index = results.findIndex((result) => result.id === expectedId);
  return index < 0 ? 0 : 1 / (index + 1);
}

test("deterministic retrieval evaluation meets recall and isolation gates", () => {
  const store = new MemoryStore(":memory:");
  const create = (input) => store.createMemory(input).memory;
  create({ id: "memory-canonical", kind: "decision", scope: "project:northstar", title: "Keep imported files canonical", content: "Imported project files remain canonical and BRACE only indexes them." });
  create({ id: "memory-conflict", kind: "warning", scope: "project:northstar", title: "Never auto merge conflicts", content: "Near duplicates require human review because similar records may disagree." });
  create({ id: "memory-other-scope", kind: "fact", scope: "project:elsewhere", title: "Canonical elsewhere", content: "This canonical record belongs to another project scope." });
  const superseded = create({ id: "memory-old", kind: "decision", scope: "project:northstar", title: "Current release constraint old", content: "An obsolete release constraint." });
  const current = create({ id: "memory-current", kind: "decision", scope: "project:northstar", title: "Current release constraint", content: "The current release constraint requires a verified local backup." });
  store.updateMemory(superseded.id, { status: "superseded", supersededBy: current.id });

  let recalled = 0;
  let reciprocalTotal = 0;
  for (const item of dataset.cases) {
    const results = store.search(item.query, { scope: item.scope, since: item.since, limit: 3 }).results;
    if (item.expectedMemoryId ? results.some((result) => result.id === item.expectedMemoryId) : results.length === 0) recalled += 1;
    reciprocalTotal += reciprocalRank(results, item.expectedMemoryId);
    assert.equal(results.some((result) => result.id === "memory-other-scope"), false, `${item.id} leaked another scope`);
    assert.equal(results.some((result) => result.id === "memory-old"), false, `${item.id} leaked superseded memory`);
  }
  const recallAt3 = recalled / dataset.cases.length;
  const meanReciprocalRank = reciprocalTotal / dataset.cases.length;
  assert.equal(recallAt3, 1);
  assert.ok(meanReciprocalRank >= 0.875, `MRR ${meanReciprocalRank} missed the deterministic gate`);

  store.upsertEmbedding("memory-canonical", "synthetic-v1", [1, 0, 0]);
  const semantic = store.search("canonical preserve source ownership", {
    scope: "project:northstar",
    queryVector: [1, 0, 0],
    embeddingModel: "synthetic-v1",
    limit: 3,
  });
  assert.equal(semantic.mode, "hybrid");
  assert.equal(semantic.results[0].id, "memory-canonical");
  store.close();
});

test("source evidence remains classified separately from durable memory", () => {
  const store = new MemoryStore(":memory:");
  const project = store.upsertProject({ id: "project-fixture", name: "Synthetic", rootPath: path.join(process.cwd(), "examples", "demo-workspace") });
  const source = store.upsertSource({ id: "source-fixture", projectId: project.id, uri: "brace-project://project-fixture/source.md", title: "Source", mediaType: "text/markdown", contentHash: "synthetic" });
  store.replaceSourceChunks(source.id, [{ heading: "Measured result", content: "The synthetic benchmark measured seventeen indexed passages." }]);
  const sourceResults = store.searchSources("seventeen indexed passages", { projectId: project.id }).results;
  const memoryResults = store.search("seventeen indexed passages").results;
  assert.equal(sourceResults.length, 1);
  assert.equal(memoryResults.length, 0);
  store.close();
});
