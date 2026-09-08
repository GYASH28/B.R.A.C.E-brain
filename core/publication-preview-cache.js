"use strict";

const { randomUUID } = require("node:crypto");

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function cloneEntry(entry, now) {
  if (!entry) return null;
  return Object.freeze({
    id: entry.id,
    actorSubjectId: entry.actorSubjectId,
    memoryId: entry.memoryId,
    workspaceId: entry.workspaceId,
    ownershipScope: entry.ownershipScope,
    sourceFingerprint: entry.sourceFingerprint,
    currentRevision: entry.currentRevision,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
    state: entry.consumed ? "consumed" : now >= entry.expiresAtMs ? "expired" : "active",
  });
}

/**
 * Process-memory-only capability cache for publication previews. Entries retain
 * their binding after expiry/consumption so callers can authorize the actor and
 * destination before returning a lifecycle-specific error.
 */
class PublicationPreviewCache {
  constructor(options = {}) {
    this.ttlMs = positiveInteger(options.ttlMs, 5 * 60_000, 60 * 60_000);
    this.maxEntries = positiveInteger(options.maxEntries, 256, 10_000);
    this.clock = typeof options.clock === "function" ? options.clock : Date.now;
    this.idFactory = typeof options.idFactory === "function" ? options.idFactory : randomUUID;
    this.entries = new Map();
  }

  create(binding = {}) {
    const now = Number(this.clock());
    if (!Number.isFinite(now)) throw new Error("The publication preview clock returned an invalid time.");
    const required = ["actorSubjectId", "memoryId", "workspaceId", "ownershipScope", "sourceFingerprint"];
    if (required.some((key) => typeof binding[key] !== "string" || !binding[key])) {
      throw new Error("A publication preview requires a complete authorization binding.");
    }
    const currentRevision = Number(binding.currentRevision);
    if (!Number.isSafeInteger(currentRevision) || currentRevision < 0) {
      throw new Error("A publication preview requires a valid current revision.");
    }
    while (this.entries.size >= this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
    const id = String(this.idFactory());
    const entry = {
      id,
      actorSubjectId: binding.actorSubjectId,
      memoryId: binding.memoryId,
      workspaceId: binding.workspaceId,
      ownershipScope: binding.ownershipScope,
      sourceFingerprint: binding.sourceFingerprint,
      currentRevision,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttlMs).toISOString(),
      expiresAtMs: now + this.ttlMs,
      consumed: false,
    };
    this.entries.set(id, entry);
    return cloneEntry(entry, now);
  }

  inspect(id) {
    return cloneEntry(this.entries.get(String(id || "")), Number(this.clock()));
  }

  consume(id) {
    const entry = this.entries.get(String(id || ""));
    if (!entry) return null;
    const now = Number(this.clock());
    if (entry.consumed || now >= entry.expiresAtMs) return cloneEntry(entry, now);
    entry.consumed = true;
    return cloneEntry(entry, now);
  }

  finalize(id) {
    const entry = this.entries.get(String(id || ""));
    if (!entry) return null;
    entry.consumed = true;
    return cloneEntry(entry, Number(this.clock()));
  }

  clear() {
    this.entries.clear();
  }
}

module.exports = { PublicationPreviewCache };
