"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { AutomationEngine } = require("../core/automation-engine");
const { MemoryStore } = require("../core/memory-store");

function makeDirectory(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-automation-recovery-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  return directory;
}

test("startup converts stale running automation runs into explicit interrupted failures", (context) => {
  const directory = makeDirectory(context);
  const databasePath = path.join(directory, "brace.sqlite3");
  let store = new MemoryStore(databasePath);
  let engine = new AutomationEngine(store);
  const automation = engine.create({
    name: "Crash-safe scheduled scan",
    enabled: true,
    trigger: { type: "schedule.interval", config: { intervalMinutes: 15 } },
    actions: [{ type: "memory.quality_scan", config: {} }],
  });
  store.updateAutomation(automation.id, { nextRunAt: "2026-09-04T06:00:00.000Z" });
  const run = store.createAutomationRun({
    automationId: automation.id,
    automationName: automation.name,
    triggerType: "schedule.interval",
    triggerPayload: { scheduledAt: "2026-09-04T06:00:00.000Z" },
    automationSnapshot: automation,
  });
  store.updateAutomationRunSteps(run.id, [
    { type: "conditions", status: "success" },
    { index: 0, type: "memory.quality_scan", status: "running", input: {}, startedAt: "2026-09-04T06:00:01.000Z" },
  ]);
  store.close();

  store = new MemoryStore(databasePath);
  engine = new AutomationEngine(store);
  const recovered = store.getAutomationRun(run.id);
  assert.equal(recovered.status, "failed");
  assert.match(recovered.error, /closed before this automation run completed/i);
  assert.equal(recovered.steps[1].status, "failed");
  assert.equal(recovered.steps.at(-1).type, "recovery");
  assert.match(recovered.steps.at(-1).detail, /not retried automatically/i);
  assert.equal(store.stats().memories, 0, "recovery must not replay side effects");
  const refreshed = store.getAutomation(automation.id);
  assert.ok(new Date(refreshed.nextRunAt) > new Date(recovered.finishedAt));
  store.close();
});

test("startup recovery leaves already finished runs unchanged", (context) => {
  const directory = makeDirectory(context);
  const databasePath = path.join(directory, "brace.sqlite3");
  let store = new MemoryStore(databasePath);
  let engine = new AutomationEngine(store);
  const automation = engine.create({
    name: "Completed run fixture",
    trigger: { type: "manual", config: {} },
    actions: [{ type: "memory.quality_scan", config: {} }],
  });
  const completed = store.createAutomationRun({
    automationId: automation.id,
    automationName: automation.name,
    triggerType: "manual",
    triggerPayload: {},
    automationSnapshot: automation,
  });
  const finished = store.finishAutomationRun(completed.id, {
    status: "success",
    steps: [{ type: "conditions", status: "success" }, { index: 0, type: "memory.quality_scan", status: "success" }],
  });
  store.close();

  store = new MemoryStore(databasePath);
  engine = new AutomationEngine(store);
  const afterRestart = store.getAutomationRun(finished.id);
  assert.equal(afterRestart.status, "success");
  assert.equal(afterRestart.steps.some((step) => step.type === "recovery"), false);
  store.close();
});
