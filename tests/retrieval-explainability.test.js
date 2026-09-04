"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { explainRetrieval, similarityPercent } = require("../src/lib/brace/retrieval-explain");
const { MemoryStore } = require("../core/memory-store");

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-retrieval-explain-"));
  const store = new MemoryStore(path.join(directory, "brace.sqlite3"));
  context.after(() => {
    try { store.close(); } catch {}
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { directory, store };
}

test("retrieval explanations are deterministic and human-readable", () => {
  assert.deepEqual(
    explainRetrieval({ lexicalRank: 2, semanticRank: 1, semanticSimilarity: 0.873 }),
    {
      mode: "hybrid",
      label: "Hybrid · lexical #2 + semantic #1",
      detail: "lexical #2 · semantic #1 · 87% semantic similarity",
      lexicalRank: 2,
      semanticRank: 1,
      semanticSimilarity: 87,
    },
  );
  assert.equal(explainRetrieval({ lexicalRank: 1, semanticRank: null, semanticSimilarity: null }).label, "Lexical · rank #1");
  assert.equal(explainRetrieval({ lexicalRank: null, semanticRank: 3, semanticSimilarity: 0.456 }).label, "Semantic · 46% similar");
  assert.equal(similarityPercent(2.4), 100);
  assert.equal(similarityPercent(-1), null);
});

test("lexical memory and source evidence keep separate rank explanations", (context) => {
  const { directory, store } = fixture(context);
  const project = store.upsertProject({ name: "Northstar", rootPath: path.join(directory, "northstar") });
  const source = store.upsertSource({
    projectId: project.id,
    uri: "brace-project://northstar/architecture.md",
    title: "Architecture",
    contentHash: "fixture-source",
  });
  store.replaceSourceChunks(source.id, [{ heading: "Storage", content: "The authoritative database stays local." }]);
  store.createMemory({
    kind: "decision",
    scope: `project:${project.id}`,
    title: "Keep the authoritative database local",
    summary: "Local storage remains authoritative.",
    content: "The authoritative database stays local unless the user explicitly exports it.",
  });

  const memory = store.search("authoritative database local", { scope: `project:${project.id}` }).results[0];
  const evidence = store.searchSources("authoritative database local", { projectId: project.id }).results[0];
  assert.equal(explainRetrieval(memory.retrieval).label, "Lexical · rank #1");
  assert.equal(explainRetrieval(evidence.retrieval).label, "Lexical · rank #1");
  assert.notEqual(memory.id, evidence.id);
  assert.equal(evidence.sourceId, source.id);
});

test("semantic explanation reports provider similarity without inventing lexical evidence", (context) => {
  const { store } = fixture(context);
  const first = store.createMemory({
    kind: "fact",
    scope: "global",
    title: "Local graph",
    content: "The graph is built from local relations.",
  }).memory;
  const second = store.createMemory({
    kind: "fact",
    scope: "global",
    title: "Provider routing",
    content: "Providers expose explicit capabilities.",
  }).memory;
  store.upsertEmbedding(first.id, "fixture-model", [1, 0]);
  store.upsertEmbedding(second.id, "fixture-model", [0, 1]);
  const result = store.search("unmatched lexical phrase", {
    embeddingModel: "fixture-model",
    queryVector: [0, 1],
  });
  const semantic = result.results.find((item) => item.id === second.id);
  assert.ok(semantic);
  const explanation = explainRetrieval(semantic.retrieval, result.mode);
  assert.equal(explanation.semanticRank, 1);
  assert.equal(explanation.semanticSimilarity, 100);
  assert.match(explanation.label, /Semantic|Hybrid/);
});
