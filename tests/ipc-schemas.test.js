import assert from "node:assert/strict";
import test from "node:test";
import { parseIpcArguments } from "../src/shared/ipc/schemas.ts";

test("IPC contracts reject malformed and oversized renderer payloads", () => {
  assert.throws(() => parseIpcArguments("brace:get-memory", [""]));
  assert.throws(() => parseIpcArguments("brace:run-assistant", [{ client: "codex", prompt: "x".repeat(12_001) }]));
  assert.throws(() => parseIpcArguments("brace:search", [{ query: "memory", unexpected: true }]));
  assert.throws(() => parseIpcArguments("brace:create-memory", [{ title: "Title", content: "Body", injected: "field" }]));
});

test("IPC contracts preserve valid local-first operations", () => {
  assert.deepEqual(parseIpcArguments("brace:get-snapshot", []), []);
  assert.deepEqual(parseIpcArguments("brace:get-memory", ["memory-1"]), ["memory-1"]);
  const [memory] = parseIpcArguments("brace:create-memory", [{
    title: "A durable decision",
    content: "Keep source evidence attached.",
    kind: "decision",
    tags: ["architecture"],
  }]);
  assert.equal(memory.title, "A durable decision");
  assert.deepEqual(
    parseIpcArguments("brace:run-automation", ["automation-1", { dryRun: true, payload: { eventType: "manual" } }]),
    ["automation-1", { dryRun: true, payload: { eventType: "manual" } }],
  );
});
