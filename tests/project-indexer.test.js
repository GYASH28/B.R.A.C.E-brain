"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MemoryStore } = require("../core/memory-store");
const {
  chunkText,
  indexProject,
  listProjectFiles,
} = require("../core/project-indexer");

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-project-"));
  const projectRoot = path.join(directory, "synthetic-northstar");
  fs.mkdirSync(path.join(projectRoot, "docs"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "node_modules", "ignored"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "README.md"), [
    "# Northstar",
    "",
    "Northstar is a fictional privacy-first research workspace. #product",
    "",
    "See [[Offline architecture]] for the storage decision.",
  ].join("\n"));
  fs.writeFileSync(path.join(projectRoot, "docs", "Offline architecture.md"), [
    "# Offline architecture",
    "",
    "## Decision",
    "",
    "All durable records live in a local SQLite database.",
    "",
    "## Recovery",
    "",
    "Backups are copied to a user-selected directory and validated after restart.",
  ].join("\n"));
  fs.writeFileSync(path.join(projectRoot, ".env"), "API_KEY=do-not-index\n");
  fs.writeFileSync(path.join(projectRoot, "node_modules", "ignored", "secret.md"), "Ignored dependency content");
  const outside = path.join(directory, "outside.md");
  fs.writeFileSync(outside, "This file is outside the selected project.");
  fs.symlinkSync(outside, path.join(projectRoot, "outside-link.md"));

  const store = new MemoryStore(path.join(directory, "profile", "brace.sqlite3"));
  context.after(() => {
    try { store.close(); } catch {}
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  return { directory, projectRoot, store };
}

test("project discovery excludes credentials, dependencies, databases, and symlinks", (context) => {
  const { projectRoot } = fixture(context);
  const scan = listProjectFiles(projectRoot);
  assert.deepEqual(scan.files.map((item) => item.relativePath).sort(), [
    "README.md",
    "docs/Offline architecture.md",
  ]);
});

test("project indexing stores searchable chunks with private-path-free provenance", async (context) => {
  const { projectRoot, store } = fixture(context);
  const first = await indexProject(store, { rootPath: projectRoot, name: "Northstar" });
  assert.equal(first.indexed, 2);
  assert.equal(first.unchanged, 0);
  assert.equal(store.stats().sources, 2);
  assert.ok(store.stats().sourceChunks >= 3);

  const search = store.searchSources("validated restart", { projectId: first.projectId });
  assert.equal(search.mode, "lexical");
  assert.match(search.results[0].content, /validated after restart/i);
  assert.match(search.results[0].sourceUri, /^brace-project:\/\//);
  assert.doesNotMatch(search.results[0].sourceUri, new RegExp(projectRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const graph = store.graph();
  assert.ok(graph.nodes.some((node) => node.type === "source"));
  assert.ok(graph.nodes.some((node) => node.type === "entity" && node.label === "product"));
  assert.ok(graph.edges.some((edge) => edge.relation === "references"));

  const second = await indexProject(store, { rootPath: projectRoot, name: "Northstar" });
  assert.equal(second.indexed, 0);
  assert.equal(second.unchanged, 2);
});

test("incremental indexing replaces changed chunks and removes missing sources", async (context) => {
  const { projectRoot, store } = fixture(context);
  const first = await indexProject(store, { rootPath: projectRoot });
  fs.writeFileSync(path.join(projectRoot, "README.md"), "# Northstar\n\nThe synthetic roadmap now prioritizes offline retrieval.\n");
  fs.rmSync(path.join(projectRoot, "docs", "Offline architecture.md"));
  const second = await indexProject(store, { rootPath: projectRoot, projectId: first.projectId });
  assert.equal(second.indexed, 1);
  assert.equal(second.removed, 1);
  assert.equal(store.stats().sources, 1);
  assert.equal(store.searchSources("offline retrieval").results.length, 1);
  assert.equal(store.searchSources("validated restart").results.length, 0);
});

test("chunking preserves Markdown heading provenance and bounded chunks", () => {
  const chunks = chunkText([
    "# Overview",
    "",
    "A".repeat(900),
    "",
    "## Decision",
    "",
    "B".repeat(900),
  ].join("\n"), { maxCharacters: 500, overlapCharacters: 50 });
  assert.ok(chunks.length >= 4);
  assert.equal(chunks[0].heading, "Overview");
  assert.ok(chunks.some((chunk) => chunk.heading === "Decision"));
  assert.ok(chunks.every((chunk) => chunk.content.length <= 550));
});
