"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { PublicationPreviewCache } = require("../core/publication-preview-cache");

function binding(overrides = {}) {
  return {
    actorSubjectId: "human-owner",
    memoryId: "memory-personal",
    workspaceId: "workspace-team",
    ownershipScope: "team",
    sourceFingerprint: "fingerprint-1",
    currentRevision: 0,
    ...overrides,
  };
}

test("publication previews are bounded, deterministic, expiring, and single-use", () => {
  let now = Date.parse("2026-01-01T00:00:00.000Z");
  let sequence = 0;
  const cache = new PublicationPreviewCache({
    ttlMs: 1_000,
    maxEntries: 2,
    clock: () => now,
    idFactory: () => `preview-${++sequence}`,
  });

  const first = cache.create(binding());
  assert.equal(first.id, "preview-1");
  assert.equal(first.expiresAt, "2026-01-01T00:00:01.000Z");
  assert.equal(cache.inspect(first.id).state, "active");
  assert.equal(cache.consume(first.id).state, "consumed");
  assert.equal(cache.consume(first.id).state, "consumed");

  const second = cache.create(binding({ memoryId: "memory-2" }));
  now += 1_001;
  assert.equal(cache.inspect(second.id).state, "expired");
  const third = cache.create(binding({ memoryId: "memory-3" }));
  assert.equal(cache.inspect(first.id), null);
  assert.equal(cache.inspect(third.id).state, "active");
});

