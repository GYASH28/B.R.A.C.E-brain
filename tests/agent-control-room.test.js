const assert = require("node:assert/strict");
const test = require("node:test");
const { classifyAutomationAgent } = require("../src/lib/brace/agent-control-room");

const automation = { id: "agent-1", enabled: true };

test("local agent states stay deterministic and honest", () => {
  assert.equal(classifyAutomationAgent({ automation: { ...automation, enabled: false } }).id, "assigned");
  assert.equal(classifyAutomationAgent({ automation, runtimePaused: true }).detail, "The local agent team is paused.");
  assert.equal(classifyAutomationAgent({ automation, lastRun: { status: "running" } }).id, "running");
  assert.equal(classifyAutomationAgent({ automation, lastRun: { status: "failed" } }).id, "attention");
  assert.equal(classifyAutomationAgent({ automation, lastRun: { status: "success" } }).id, "completed");
  assert.equal(classifyAutomationAgent({ automation, lastRun: { status: "preview" } }).label, "Previewed");
  assert.equal(classifyAutomationAgent({ automation, lastRun: { status: "skipped" } }).label, "Waiting");
});

test("a missing definition never appears active", () => {
  assert.deepEqual(classifyAutomationAgent(), {
    id: "unassigned",
    label: "Unassigned",
    detail: "No local agent definition is selected.",
    tone: "idle",
  });
});
