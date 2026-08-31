"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MemoryStore } = require("../core/memory-store");

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-memory-"));
  const databasePath = path.join(directory, "brace.sqlite3");
  const store = new MemoryStore(databasePath);
  context.after(() => {
    try { store.close(); } catch {}
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  return { directory, databasePath, store };
}

test("structured memories survive restart with provenance and evidence", (context) => {
  const { databasePath, store } = fixture(context);
  const project = store.upsertProject({
    name: "Northstar",
    rootPath: path.join(path.dirname(databasePath), "northstar"),
  });
  const source = store.upsertSource({
    projectId: project.id,
    uri: "project://northstar/docs/architecture.md",
    title: "Architecture",
    mediaType: "text/markdown",
    contentHash: "fixture-hash",
  });
  const created = store.createMemory({
    kind: "decision",
    scope: `project:${project.id}`,
    title: "Keep synchronization local-first",
    summary: "Cloud synchronization remains optional.",
    content: "The local database is authoritative unless a user enables a sync adapter.",
    tags: ["architecture", "privacy"],
    sourceId: source.id,
    sourceUri: source.uri,
    sourceExcerpt: "Local-first by default.",
    confidence: 0.95,
  });
  store.addEvidence(created.memory.id, {
    outcome: "promoted",
    summary: "Architecture review accepted the data boundary.",
    reference: "docs/architecture/adr-001-local-data-boundary.md",
  });

  store.close();
  const reopened = new MemoryStore(databasePath);
  const memory = reopened.getMemory(created.memory.id, { includeEvidence: true });
  assert.equal(memory.title, "Keep synchronization local-first");
  assert.equal(memory.sourceId, source.id);
  assert.equal(memory.evidence.length, 1);
  assert.equal(memory.evidence[0].outcome, "promoted");
  assert.equal(reopened.stats().schemaVersion, 5);
  reopened.close();
});

test("pinned working context is durable, filterable, and ordered first", (context) => {
  const { databasePath, store } = fixture(context);
  const routine = store.createMemory({
    kind: "procedure",
    scope: "project:daily",
    title: "Daily release review",
    content: "Review the release evidence before starting a new build.",
    importance: 0.2,
  }).memory;
  store.createMemory({
    kind: "decision",
    scope: "project:daily",
    title: "Use local evidence",
    content: "Keep the evidence ledger inside the selected local workspace.",
    importance: 0.95,
  });

  const pinned = store.setMemoryPinned(routine.id, true);
  assert.equal(pinned.pinned, true);
  assert.equal(store.listMemories({ scope: "project:daily" })[0].id, routine.id);
  assert.deepEqual(store.listMemories({ scope: "project:daily", pinned: true }).map((memory) => memory.id), [routine.id]);
  assert.equal(store.stats().pinnedMemories, 1);

  store.close();
  const reopened = new MemoryStore(databasePath);
  assert.equal(reopened.getMemory(routine.id).pinned, true);
  assert.equal(reopened.setMemoryPinned(routine.id, false).pinned, false);
  assert.equal(reopened.stats().pinnedMemories, 0);
  reopened.close();
});

test("exact duplicates reuse the active record and near duplicates are reviewable", (context) => {
  const { store } = fixture(context);
  const input = {
    kind: "lesson",
    scope: "project:demo",
    title: "Verify migrations after restart",
    summary: "Restart testing catches migration mistakes.",
    content: "Run the storage migration, close the process, reopen it, and verify all records.",
  };
  const first = store.createMemory(input);
  const exact = store.createMemory(input);
  const near = store.createMemory({
    ...input,
    title: "Verify every migration after a restart",
    content: "Run the storage migration, close the process, reopen it, then verify every record.",
  });
  assert.equal(exact.duplicate, true);
  assert.equal(exact.memory.id, first.memory.id);
  assert.equal(near.duplicate, false);
  assert.equal(near.duplicateCandidate.id, first.memory.id);
  const unrelated = store.createMemory({
    kind: "lesson",
    scope: "project:demo",
    title: "Prefer narrow project imports",
    summary: "Specific roots keep provenance understandable.",
    content: "Import one specific project root rather than an entire drive or home directory.",
  }).memory;
  const candidate = store.listMemoryReviewCandidates({ scope: "project:demo" })[0];
  assert.equal(candidate.left.id === first.memory.id || candidate.right.id === first.memory.id, true);
  assert.equal(candidate.signal, "captured-overlap");
  assert.equal(store.memoryQuality().pendingReview, 1);
  assert.throws(() => store.resolveMemoryReview({
    leftId: first.memory.id,
    rightId: unrelated.id,
    outcome: "keep-left",
  }), /not in the active memory review queue/);
  const result = store.resolveMemoryReview({
    leftId: candidate.left.id,
    rightId: candidate.right.id,
    outcome: "distinct",
  });
  assert.equal(result.outcome, "distinct");
  assert.deepEqual(store.listMemoryReviewCandidates({ scope: "project:demo" }), []);
  assert.ok(store.listTimeline().some((event) => event.eventType === "memory.reviewed"));
  store.updateMemory(near.memory.id, { summary: `${near.memory.summary} Refined after review.` });
  assert.equal(store.listMemoryReviewCandidates({ scope: "project:demo" }).length, 1);
});

test("review resolution keeps one canonical memory without deleting the other", (context) => {
  const { store } = fixture(context);
  const first = store.createMemory({
    kind: "procedure",
    scope: "project:review",
    title: "Verify the release checksum",
    summary: "Check the published checksum before installation.",
    content: "Compare every release artifact with its published SHA-256 checksum before installing it.",
  }).memory;
  store.createMemory({
    kind: "procedure",
    scope: "project:review",
    title: "Verify each release checksum",
    summary: "Check every published checksum before installation.",
    content: "Compare each release artifact against the published SHA-256 checksum before installing it.",
  });
  const candidate = store.listMemoryReviewCandidates({ scope: "project:review" })[0];
  const canonical = candidate.left.id === first.id ? candidate.left : candidate.right;
  const superseded = candidate.left.id === canonical.id ? candidate.right : candidate.left;
  const outcome = candidate.left.id === canonical.id ? "keep-left" : "keep-right";
  const result = store.resolveMemoryReview({
    leftId: candidate.left.id,
    rightId: candidate.right.id,
    outcome,
  });
  assert.equal(result.canonicalMemoryId, canonical.id);
  assert.equal(store.getMemory(canonical.id).status, "active");
  assert.equal(store.getMemory(superseded.id).status, "superseded");
  assert.equal(store.getMemory(superseded.id).supersededBy, canonical.id);
  assert.equal(store.getMemory(superseded.id).content.length > 0, true);
  assert.deepEqual(store.listMemoryReviewCandidates({ scope: "project:review" }), []);
});

test("search reports lexical mode unless real model vectors are supplied", (context) => {
  const { store } = fixture(context);
  const alpha = store.createMemory({
    kind: "fact",
    scope: "project:demo",
    title: "Offline indexing",
    summary: "Files are indexed without a cloud service.",
    content: "BRACE builds a local full text index for Markdown files.",
  }).memory;
  const beta = store.createMemory({
    kind: "fact",
    scope: "project:demo",
    title: "Provider routing",
    summary: "Model providers expose explicit capabilities.",
    content: "Embedding and chat providers are selected independently.",
  }).memory;

  const lexical = store.search("local markdown index", { scope: "project:demo" });
  assert.equal(lexical.mode, "lexical");
  assert.equal(lexical.results[0].id, alpha.id);

  store.upsertEmbedding(alpha.id, "fixture-embedding-v1", [1, 0, 0]);
  store.upsertEmbedding(beta.id, "fixture-embedding-v1", [0, 1, 0]);
  const hybrid = store.search("provider index", {
    scope: "project:demo",
    embeddingModel: "fixture-embedding-v1",
    queryVector: [0, 1, 0],
  });
  assert.equal(hybrid.mode, "hybrid");
  assert.ok(hybrid.results.some((result) => result.id === beta.id));
  assert.ok(hybrid.results.find((result) => result.id === beta.id).retrieval.semanticSimilarity > 0.99);
});

test("search time scopes filter memory and source evidence by their own update time", (context) => {
  const { databasePath, store } = fixture(context);
  const project = store.upsertProject({
    name: "Time scope fixture",
    rootPath: path.join(path.dirname(databasePath), "time-scope"),
  });
  const source = store.upsertSource({
    projectId: project.id,
    uri: "project://time-scope/notes.md",
    title: "Indexed notes",
  });
  const [oldChunk, freshChunk] = store.replaceSourceChunks(source.id, [
    { heading: "Old context", content: "Orbit release context from an earlier cycle." },
    { heading: "Fresh context", content: "Orbit release context captured today." },
  ]);
  const oldMemory = store.createMemory({
    kind: "fact",
    title: "Old orbit note",
    content: "Orbit release context from an earlier cycle.",
  }).memory;
  const freshMemory = store.createMemory({
    kind: "fact",
    title: "Fresh orbit note",
    content: "Orbit release context captured today.",
  }).memory;
  const oldTimestamp = "2024-01-01T00:00:00.000Z";
  store.db.prepare("UPDATE memories SET updated_at = ? WHERE id = ?").run(oldTimestamp, oldMemory.id);
  store.db.prepare("UPDATE source_chunks SET updated_at = ? WHERE id = ?").run(oldTimestamp, oldChunk.id);

  const since = new Date(Date.now() - (24 * 60 * 60 * 1_000)).toISOString();
  const memories = store.search("orbit release context", { since });
  const sources = store.searchSources("orbit release context", { since });
  assert.deepEqual(memories.results.map((memory) => memory.id), [freshMemory.id]);
  assert.deepEqual(sources.results.map((chunk) => chunk.id), [freshChunk.id]);
  assert.throws(() => store.search("orbit", { since: "not-a-date" }), /valid ISO dates/);
});

test("decisions create real timeline entries and graph relations", (context) => {
  const { databasePath, store } = fixture(context);
  const project = store.upsertProject({
    name: "Northstar",
    rootPath: path.join(path.dirname(databasePath), "northstar-graph"),
  });
  const decision = store.createDecision({
    projectId: project.id,
    title: "Use SQLite",
    context: "BRACE needs local transactions and full-text search.",
    decision: "Use the SQLite runtime bundled with Node and Electron.",
    rationale: "It keeps user data local and supports migrations.",
    alternatives: ["JSON journal", "remote database"],
  });
  const entity = store.upsertEntity({ name: "SQLite", entityType: "technology" });
  store.relate({
    fromType: "decision",
    fromId: decision.id,
    toType: "entity",
    toId: entity.id,
    relation: "selects",
  });

  const timeline = store.listTimeline({ projectId: project.id });
  assert.equal(timeline[0].eventType, "decision.recorded");
  assert.equal(timeline[0].decisionId, decision.id);
  const graph = store.graph();
  assert.ok(graph.nodes.some((node) => node.id === decision.id && node.type === "decision"));
  assert.ok(graph.edges.some((edge) => edge.from === decision.id && edge.to === entity.id));
});

test("secret-like values are redacted before durable storage", (context) => {
  const { store } = fixture(context);
  const syntheticToken = ["gh", "p_", "1234567890", "abcdefghijklmnop"].join("");
  const created = store.createMemory({
    kind: "warning",
    title: "Rotate the exposed token",
    content: `The old access_token=${syntheticToken} must never be retained.`,
  }).memory;
  assert.equal(created.redacted, true);
  assert.doesNotMatch(created.content, /ghp_/);
  assert.match(created.content, /REDACTED/);
});

test("forget removes content, evidence, and vectors while retaining a non-sensitive tombstone", (context) => {
  const { store } = fixture(context);
  const memory = store.createMemory({
    kind: "preference",
    title: "Temporary preference",
    content: "This preference should be forgotten.",
  }).memory;
  store.upsertEmbedding(memory.id, "fixture", [1, 0]);
  store.addEvidence(memory.id, {
    summary: "User asked to retain it temporarily.",
    reference: "fixture://consent",
  });
  assert.equal(store.forgetMemory(memory.id), true);
  const forgotten = store.getMemory(memory.id, { includeEvidence: true });
  assert.equal(forgotten.status, "forgotten");
  assert.equal(forgotten.content, "");
  assert.equal(forgotten.embeddingModel, null);
  assert.deepEqual(forgotten.evidence, []);
  assert.ok(store.listTimeline().some((event) => event.eventType === "memory.forgotten"));
});

test("backup and privacy-safe export preserve the memory database", async (context) => {
  const { directory, store } = fixture(context);
  store.createMemory({
    kind: "fact",
    title: "Synthetic fixture",
    content: "This record exists only inside an isolated test profile.",
  });
  const exported = store.exportData();
  assert.equal(exported.memories.length, 1);
  assert.equal(Object.hasOwn(exported, "settings"), false);
  assert.equal(exported.projects.every((project) => !Object.hasOwn(project, "root_path")), true);
  const target = path.join(directory, "backups", "brace-backup.sqlite3");
  const result = await store.backup(target);
  assert.ok(result.bytes > 0);
  const restored = new MemoryStore(target);
  assert.equal(restored.stats().memories, 1);
  restored.close();
});

test("deleteAll removes user content without invalidating the schema", (context) => {
  const { databasePath, store } = fixture(context);
  const project = store.upsertProject({
    name: "Delete fixture",
    rootPath: path.join(path.dirname(databasePath), "delete-fixture"),
  });
  store.createMemory({ kind: "fact", title: "Delete me", content: "Synthetic data", projectId: project.id });
  store.deleteAll();
  assert.deepEqual(store.stats(), {
    schemaVersion: 5,
    projects: 0,
    sources: 0,
    sourceChunks: 0,
    memories: 0,
    pinnedMemories: 0,
    forgotten: 0,
    decisions: 0,
    events: 0,
    entities: 0,
    relations: 0,
    skills: 0,
    automations: 0,
    enabledAutomations: 0,
    automationRuns: 0,
  });
});

test("version-one databases migrate source chunks without losing memories", (context) => {
  const { databasePath, store } = fixture(context);
  const memory = store.createMemory({
    kind: "fact",
    title: "Migration fixture",
    content: "This memory must survive a schema upgrade.",
  }).memory;
  store.db.exec(`
    DROP TRIGGER source_chunks_au;
    DROP TRIGGER source_chunks_ad;
    DROP TRIGGER source_chunks_ai;
    DROP TABLE source_chunks_fts;
    DROP TABLE source_chunks;
    PRAGMA user_version = 1;
  `);
  store.close();
  const migrated = new MemoryStore(databasePath);
  assert.equal(migrated.stats().schemaVersion, 5);
  assert.deepEqual(migrated.listMemoryReviewCandidates(), []);
  assert.equal(migrated.getMemory(memory.id).title, "Migration fixture");
  assert.deepEqual(migrated.searchSources("anything").results, []);
  migrated.close();
});

test("version-three desktop profiles migrate to automation storage without losing memory", (context) => {
  const { databasePath, store } = fixture(context);
  const memory = store.createMemory({
    kind: "decision",
    title: "Existing 0.5 profile memory",
    content: "This synthetic record represents a schema-three desktop profile.",
  }).memory;
  store.db.exec(`
    DROP TABLE automation_runs;
    DROP TABLE automations;
    PRAGMA user_version = 3;
  `);
  store.close();
  const migrated = new MemoryStore(databasePath);
  assert.equal(migrated.stats().schemaVersion, 5);
  assert.equal(migrated.getMemory(memory.id).title, "Existing 0.5 profile memory");
  assert.deepEqual(migrated.listAutomations(), []);
  assert.deepEqual(migrated.listAutomationRuns(), []);
  migrated.close();
});
