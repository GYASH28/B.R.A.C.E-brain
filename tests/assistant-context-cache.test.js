"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { AssistantContextCache } = require("../core/assistant-context-cache");

test("assistant context capsule is exact, expiring, and one-use", () => {
  const cache = new AssistantContextCache({ ttlMs: 60_000 });
  const now = Date.parse("2026-09-04T06:20:00.000Z");
  const preview = cache.prepare({
    client: "codex",
    prompt: "What did we decide?",
    mode: "hybrid",
    embeddingModel: "synthetic-embed",
    memories: [{ title: "Decision", kind: "decision", summary: "Use SQLite", sourceUri: "brace://memory/1" }],
    sources: [{ title: "ADR", uri: "brace-project://fixture/ADR.md", excerpt: "SQLite remains local." }],
  }, now);

  assert.equal(preview.client, "codex");
  assert.equal(preview.prompt, "What did we decide?");
  assert.equal(preview.memories[0].summary, "Use SQLite");
  const consumed = cache.consume(preview.id, { client: "codex", prompt: "What did we decide?" }, now + 1_000);
  assert.equal(consumed.sources[0].uri, "brace-project://fixture/ADR.md");
  assert.throws(() => cache.consume(preview.id, { client: "codex", prompt: "What did we decide?" }, now + 2_000), /expired/i);
});

test("assistant context refuses changed prompt, changed client, and expired preview", () => {
  const cache = new AssistantContextCache({ ttlMs: 30_000 });
  const now = Date.parse("2026-09-04T06:20:00.000Z");
  const preview = cache.prepare({ client: "claude", prompt: "Original", memories: [], sources: [] }, now);
  assert.throws(() => cache.get(preview.id, { client: "codex", prompt: "Original" }, now + 1), /client changed/i);
  assert.throws(() => cache.get(preview.id, { client: "claude", prompt: "Edited" }, now + 1), /question changed/i);
  assert.throws(() => cache.get(preview.id, { client: "claude", prompt: "Original" }, now + 31_000), /expired/i);
});

test("previews return cloned context rather than mutable cache references", () => {
  const cache = new AssistantContextCache();
  const preview = cache.prepare({
    client: "codex",
    prompt: "Fixture",
    memories: [{ title: "Original" }],
    sources: [],
  });
  preview.memories[0].title = "Mutated outside cache";
  const internal = cache.get(preview.id, { client: "codex", prompt: "Fixture" });
  assert.equal(internal.memories[0].title, "Original");
});
