"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MemoryStore } = require("../core/memory-store");
const { indexProject, listProjectFiles } = require("../core/project-indexer");

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-index-hardening-"));
  const projectRoot = path.join(directory, "project");
  fs.mkdirSync(path.join(projectRoot, "private"), { recursive: true });
  const store = new MemoryStore(path.join(directory, "profile", "brace.sqlite3"));
  context.after(() => {
    try { store.close(); } catch {}
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  return { directory, projectRoot, store };
}

test(".braceignore excludes project-local paths before indexing", (context) => {
  const { projectRoot } = fixture(context);
  fs.writeFileSync(path.join(projectRoot, ".braceignore"), "private/**\n*.generated.md\n");
  fs.writeFileSync(path.join(projectRoot, "public.md"), "public context");
  fs.writeFileSync(path.join(projectRoot, "private", "notes.md"), "private context");
  fs.writeFileSync(path.join(projectRoot, "ignored.generated.md"), "generated context");
  assert.deepEqual(listProjectFiles(projectRoot).files.map((item) => item.relativePath), ["public.md"]);
});

test("Obsidian vault metadata and trash are ignored while notes remain indexable", (context) => {
  const { projectRoot } = fixture(context);
  fs.mkdirSync(path.join(projectRoot, ".obsidian", "plugins", "fixture"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, ".trash"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "Daily note.md"), "# Daily note\n\n[[Project Atlas]] #planning");
  fs.writeFileSync(path.join(projectRoot, ".obsidian", "workspace.json"), JSON.stringify({ privateLayout: true }));
  fs.writeFileSync(path.join(projectRoot, ".obsidian", "plugins", "fixture", "manifest.json"), JSON.stringify({ id: "fixture" }));
  fs.writeFileSync(path.join(projectRoot, ".trash", "deleted.md"), "deleted note");
  assert.deepEqual(listProjectFiles(projectRoot).files.map((item) => item.relativePath), ["Daily note.md"]);
});

test("ordinary text files have recognizable secrets redacted before persistence", async (context) => {
  const { projectRoot, store } = fixture(context);
  fs.writeFileSync(path.join(projectRoot, "notes.md"), "# Notes\n\nProvider token password=fixture-secret-12345 must never persist.");
  const result = await indexProject(store, { rootPath: projectRoot });
  assert.equal(result.redactedFiles, 1);
  const persisted = store.searchSources("Provider token").results[0].content;
  assert.match(persisted, /REDACTED/);
  assert.doesNotMatch(persisted, /password=fixture-secret-12345/);
});

test("embedding failure leaves the previous complete source index searchable", async (context) => {
  const { projectRoot, store } = fixture(context);
  const notes = path.join(projectRoot, "notes.md");
  fs.writeFileSync(notes, "# Stable\n\nThe previous complete index remains authoritative.");
  const first = await indexProject(store, { rootPath: projectRoot });
  assert.equal(store.searchSources("previous complete index").results.length, 1);

  fs.writeFileSync(notes, "# Changed\n\nThis replacement should not land after embedding failure.");
  const failedEmbedder = {
    model: "fixture:fail",
    async embed() { throw new Error("synthetic embedding failure"); },
  };
  await assert.rejects(
    () => indexProject(store, { rootPath: projectRoot, projectId: first.projectId, embedder: failedEmbedder }),
    /synthetic embedding failure/,
  );
  assert.equal(store.searchSources("previous complete index").results.length, 1);
  assert.equal(store.searchSources("replacement should not land").results.length, 0);
});

test("prepared embeddings are committed with source chunks in one replacement transaction", async (context) => {
  const { projectRoot, store } = fixture(context);
  fs.writeFileSync(path.join(projectRoot, "notes.md"), "# Semantic\n\nAlpha semantic context.");
  const embedder = { model: "fixture:v1", async embed(values) { return values.map(() => [1, 0, 0]); } };
  const result = await indexProject(store, { rootPath: projectRoot, embedder });
  const project = store.listProjects().find((item) => item.id === result.projectId);
  const found = store.searchSources("Alpha semantic", { projectId: project.id, embeddingModel: "fixture:v1", queryVector: [1, 0, 0] });
  assert.ok(["hybrid", "semantic"].includes(found.mode));
  assert.equal(found.results[0].retrieval.semanticSimilarity > 0.99, true);
});
