"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (relative) => fs.readFileSync(path.resolve(__dirname, "..", relative), "utf8");

test("Ask BRACE prepares an exact short-lived context before provider send", () => {
  const service = read("electron/memory-service.ts");
  const preload = read("electron/preload.ts");
  const store = read("src/lib/brace/store.ts");
  const app = read("src/components/brace/brace-app.tsx");

  assert.match(service, /prepareAssistantContext/);
  assert.match(service, /assistantContexts\.get\(contextId/);
  assert.match(service, /assistantContexts\.consume\(contextId/);
  assert.match(service, /providerPrompt = redactSecrets\(prompt\)\.value/);
  assert.match(preload, /prepareBraceAssistantContext/);
  assert.match(store, /Preview the exact context capsule/);
  assert.match(app, /EXACT CONTEXT CAPSULE/);
  assert.match(app, /Preview context/);
  assert.match(app, /changing the question or client invalidates it/i);
});

test("provider send uses the consumed prepared capsule instead of re-searching", () => {
  const service = read("electron/memory-service.ts");
  const start = service.indexOf("async runAssistant(input: any)");
  const end = service.indexOf("async clearAssistantHistory", start);
  assert.ok(start >= 0 && end > start);
  const method = service.slice(start, end);
  assert.doesNotMatch(method, /await this\.search/);
  assert.match(method, /capsule\.providerPrompt/);
  assert.match(method, /capsule\.memories/);
  assert.match(method, /capsule\.sources/);
});
