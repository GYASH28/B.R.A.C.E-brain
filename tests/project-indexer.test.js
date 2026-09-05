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
  redactContentSecrets,
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

test(".braceignore excludes user-selected paths before content is read", (context) => {
  const { projectRoot } = fixture(context);
  fs.mkdirSync(path.join(projectRoot, "drafts"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "drafts", "private.md"), "not for the index");
  fs.writeFileSync(path.join(projectRoot, "notes.private.md"), "not for the index");
  fs.writeFileSync(path.join(projectRoot, ".braceignore"), "drafts/\n*.private.md\n");
  const scan = listProjectFiles(projectRoot);
  assert.equal(scan.ignoredByRule, 2);
  assert.doesNotMatch(scan.files.map((item) => item.relativePath).join("\n"), /drafts|private/);
});

test("ordinary source files receive best-effort content secret redaction", async (context) => {
  const { projectRoot, store } = fixture(context);
  const syntheticSecret = ["password", "=", "synthetic-only-value-123"].join("");
  fs.writeFileSync(path.join(projectRoot, "docs", "deployment.md"), `# Deployment\n\npassword=${syntheticSecret.slice("password=".length)}\nKeep the deployment local.`);
  const preview = redactContentSecrets(`password=${syntheticSecret.slice("password=".length)}`);
  assert.equal(preview.redacted, 1);
  assert.doesNotMatch(preview.value, /synthetic-only-value/);
  const result = await indexProject(store, { rootPath: projectRoot });
  assert.equal(result.redacted, 1);
  assert.equal(store.searchSources("synthetic-only-value").results.length, 0);
  assert.equal(store.searchSources("redacted generic-secret").results.length, 1);
});

test("failed embedding leaves the prior complete source index usable", async (context) => {
  const { projectRoot, store } = fixture(context);
  const first = await indexProject(store, { rootPath: projectRoot });
  fs.writeFileSync(path.join(projectRoot, "README.md"), "# Changed\n\nA replacement that must not commit.");
  await assert.rejects(indexProject(store, {
    rootPath: projectRoot,
    projectId: first.projectId,
    embedder: {
      model: "synthetic:failure",
      async embed() { throw new Error("Synthetic embedding failure"); },
    },
  }), /Synthetic embedding failure/);
  assert.equal(store.searchSources("fictional privacy-first").results.length, 1);
  assert.equal(store.searchSources("replacement that must not commit").results.length, 0);
  assert.equal(store.listProjects()[0].last_indexed_at, first.completedAt);
});

test("worker indexing is cancellable and reports bounded phase progress", async (context) => {
  const { projectRoot, store } = fixture(context);
  for (let index = 0; index < 80; index += 1) {
    fs.writeFileSync(path.join(projectRoot, `synthetic-${index}.md`), `# Fixture ${index}\n\nBounded worker document ${index}.`);
  }
  const controller = new AbortController();
  const phases = new Set();
  await assert.rejects(indexProject(store, {
    rootPath: projectRoot,
    signal: controller.signal,
    onProgress(progress) {
      phases.add(progress.phase);
      if (progress.phase === "reading" && progress.completed >= 3) controller.abort();
    },
  }), /cancelled/);
  assert.ok(phases.has("scanning"));
  assert.ok(phases.has("reading"));
  assert.equal(store.listProjects()[0].last_indexed_at, null);
});

test("unsupported encoding produces a partial result without deleting old evidence", async (context) => {
  const { projectRoot, store } = fixture(context);
  const first = await indexProject(store, { rootPath: projectRoot });
  fs.writeFileSync(path.join(projectRoot, "docs", "Offline architecture.md"), Buffer.from([0xc3, 0x28]));
  const result = await indexProject(store, { rootPath: projectRoot, projectId: first.projectId });
  assert.equal(result.status, "partial");
  assert.equal(result.skippedUnsupportedEncoding, 1);
  assert.equal(result.removed, 0);
  assert.equal(store.searchSources("validated restart").results.length, 1);
  assert.equal(store.listProjects()[0].last_indexed_at, first.completedAt);
});
