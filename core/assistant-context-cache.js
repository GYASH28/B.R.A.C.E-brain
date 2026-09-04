"use strict";

const { randomUUID } = require("node:crypto");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class AssistantContextCache {
  constructor(options = {}) {
    this.ttlMs = Math.min(30 * 60_000, Math.max(30_000, Number(options.ttlMs) || 5 * 60_000));
    this.maximum = Math.min(50, Math.max(1, Number(options.maximum) || 12));
    this.entries = new Map();
  }

  prune(now = Date.now()) {
    for (const [id, entry] of this.entries) {
      if (entry.expiresAtMs <= now) this.entries.delete(id);
    }
    while (this.entries.size > this.maximum) {
      const oldest = this.entries.keys().next().value;
      if (!oldest) break;
      this.entries.delete(oldest);
    }
  }

  prepare(input, now = Date.now()) {
    this.prune(now);
    const client = String(input?.client || "");
    const prompt = String(input?.prompt || "");
    if (!client || !prompt) throw new Error("Assistant context requires a client and prompt.");
    const id = randomUUID();
    const providerPrompt = String(input?.providerPrompt ?? prompt);
    const entry = {
      id,
      client,
      prompt,
      providerPrompt,
      promptRedacted: providerPrompt !== prompt,
      mode: input.mode || "lexical",
      embeddingModel: input.embeddingModel || null,
      warning: input.warning || null,
      memories: clone(Array.isArray(input.memories) ? input.memories : []),
      sources: clone(Array.isArray(input.sources) ? input.sources : []),
      preparedAtMs: now,
      expiresAtMs: now + this.ttlMs,
    };
    this.entries.set(id, entry);
    this.prune(now);
    return this.preview(entry);
  }

  preview(entry) {
    return {
      id: entry.id,
      client: entry.client,
      prompt: entry.prompt,
      promptRedacted: entry.promptRedacted,
      mode: entry.mode,
      embeddingModel: entry.embeddingModel,
      warning: entry.warning,
      memories: clone(entry.memories),
      sources: clone(entry.sources),
      preparedAt: new Date(entry.preparedAtMs).toISOString(),
      expiresAt: new Date(entry.expiresAtMs).toISOString(),
    };
  }

  get(id, expected = {}, now = Date.now()) {
    this.prune(now);
    const entry = this.entries.get(String(id || ""));
    if (!entry) throw new Error("This BRACE context preview expired. Prepare it again before sending.");
    if (expected.client !== undefined && entry.client !== String(expected.client)) {
      throw new Error("The selected AI client changed after this context preview was prepared.");
    }
    if (expected.prompt !== undefined && entry.prompt !== String(expected.prompt)) {
      throw new Error("The question changed after this context preview was prepared.");
    }
    return entry;
  }

  consume(id, expected = {}, now = Date.now()) {
    const entry = this.get(id, expected, now);
    this.entries.delete(entry.id);
    return clone(entry);
  }

  remove(id) {
    return this.entries.delete(String(id || ""));
  }

  clear() {
    this.entries.clear();
  }
}

module.exports = { AssistantContextCache };
