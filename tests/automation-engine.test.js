"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { AutomationEngine, nextRunAt, renderTemplate } = require("../core/automation-engine");
const { MemoryStore } = require("../core/memory-store");

function fixture(context, adapters = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-automation-"));
  const databasePath = path.join(directory, "brace.sqlite3");
  const store = new MemoryStore(databasePath);
  const engine = new AutomationEngine(store, adapters);
  context.after(() => {
    try { store.close(); } catch {}
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  return { directory, databasePath, store, engine };
}

test("automation definitions persist with derived permissions and immutable run snapshots", async (context) => {
  const { databasePath, store, engine } = fixture(context);
  const automation = engine.create({
    name: "Decision follow-up",
    description: "Retain the operational consequence of a decision.",
    enabled: true,
    trigger: { type: "decision.created", config: {} },
    conditionLogic: "and",
    conditions: [{ field: "title", operator: "contains", value: "SQLite" }],
    actions: [{
      type: "memory.create",
      config: {
        kind: "procedure",
        title: "Follow up: {{trigger.title}}",
        content: "Implement {{trigger.decision}}",
        tags: ["automation"],
      },
    }],
  });
  assert.deepEqual(automation.permissions, ["memory:write"]);
  const [run] = await engine.dispatch("decision.created", {
    title: "Use SQLite",
    decision: "the local migration",
    scope: "project:fixture",
  });
  assert.equal(run.status, "success");
  assert.equal(run.automationSnapshot.version, 1);
  assert.equal(store.listMemories()[0].title, "Follow up: Use SQLite");
  assert.match(store.listMemories()[0].sourceUri, /^brace-automation:\/\//);

  store.close();
  const reopened = new MemoryStore(databasePath);
  assert.equal(reopened.stats().schemaVersion, 6);
  assert.equal(reopened.listAutomations()[0].name, "Decision follow-up");
  assert.equal(reopened.listAutomationRuns()[0].status, "success");
  reopened.close();
});

test("dry runs render typed actions without mutating memory", async (context) => {
  const { store, engine } = fixture(context);
  const automation = engine.create({
    name: "Preview keeper",
    trigger: { type: "manual", config: {} },
    actions: [{
      type: "memory.create",
      config: { kind: "summary", title: "{{trigger.title}}", content: "{{trigger.summary}}" },
    }],
  });
  const run = await engine.run(automation.id, {
    dryRun: true,
    payload: { title: "Synthetic preview", summary: "Nothing should be stored." },
  });
  assert.equal(run.status, "preview");
  assert.equal(run.steps[1].input.title, "Synthetic preview");
  assert.equal(store.stats().memories, 0);
});

test("conditions skip safely and failed runs remain retryable", async (context) => {
  let shouldFail = true;
  const { store, engine } = fixture(context, {
    reindexProject: async () => {
      if (shouldFail) throw new Error("Synthetic index failure");
      return { indexed: true };
    },
  });
  const skippedAutomation = engine.create({
    name: "Warnings only",
    enabled: true,
    trigger: { type: "memory.created", config: {} },
    conditionLogic: "and",
    conditions: [{ field: "kind", operator: "equals", value: "warning" }],
    actions: [{ type: "memory.quality_scan", config: {} }],
  });
  const [skipped] = await engine.dispatch("memory.created", { kind: "lesson", title: "Fixture" });
  assert.equal(skipped.status, "skipped");
  assert.equal(skippedAutomation.enabled, true);

  const failing = engine.create({
    name: "Refresh fixture project",
    trigger: { type: "manual", config: {} },
    actions: [{ type: "project.reindex", config: { projectId: "project-fixture" } }],
  });
  const failed = await engine.run(failing.id);
  assert.equal(failed.status, "failed");
  assert.match(failed.error, /Synthetic index failure/);
  engine.update(failing.id, {
    name: "Edited after failure",
    actions: [{ type: "memory.quality_scan", config: {} }],
  });
  shouldFail = false;
  const retried = await engine.retry(failed.id);
  assert.equal(retried.status, "success");
  assert.equal(retried.retryOf, failed.id);
  assert.equal(retried.automationSnapshot.name, "Refresh fixture project");
  assert.equal(retried.steps[1].type, "project.reindex");
  assert.equal(store.listAutomationRuns({ automationId: failing.id }).length, 2);
});

test("failed scheduled runs advance their cursor instead of hammering every tick", async (context) => {
  const { store, engine } = fixture(context, {
    reindexProject: async () => { throw new Error("Synthetic scheduled failure"); },
  });
  const automation = engine.create({
    name: "Scheduled refresh",
    enabled: true,
    trigger: { type: "schedule.interval", config: { intervalMinutes: 15 } },
    actions: [{ type: "project.reindex", config: { projectId: "fixture-project" } }],
  });
  store.updateAutomation(automation.id, { nextRunAt: "2026-08-29T08:15:00.000Z" });
  const [failed] = await engine.tick(new Date("2026-08-29T08:15:00.000Z"));
  assert.equal(failed.status, "failed");
  const nextRun = store.getAutomation(automation.id).nextRunAt;
  assert.ok(new Date(nextRun) > new Date(failed.finishedAt));
  assert.deepEqual(await engine.tick(new Date(failed.finishedAt)), []);
});

test("scheduled runs are calculated locally, pause globally, and never run early", async (context) => {
  const { store, engine } = fixture(context);
  const start = new Date("2026-08-29T08:00:00.000Z");
  assert.equal(
    nextRunAt({ type: "schedule.interval", config: { intervalMinutes: 15 } }, start),
    "2026-08-29T08:15:00.000Z",
  );
  const automation = engine.create({
    name: "Health scan",
    enabled: true,
    trigger: { type: "schedule.interval", config: { intervalMinutes: 15 } },
    actions: [{ type: "memory.quality_scan", config: {} }],
  });
  store.updateAutomation(automation.id, { nextRunAt: "2026-08-29T08:15:00.000Z" });
  assert.deepEqual(await engine.tick(new Date("2026-08-29T08:14:59.000Z")), []);
  store.setSetting("automation.paused", true);
  assert.deepEqual(await engine.tick(new Date("2026-08-29T08:15:00.000Z")), []);
  store.setSetting("automation.paused", false);
  const runs = await engine.tick(new Date("2026-08-29T08:15:00.000Z"));
  assert.equal(runs[0].status, "success");
  assert.ok(new Date(store.getAutomation(automation.id).nextRunAt) > new Date("2026-08-29T08:15:00.000Z"));
});

test("event idempotency prevents duplicate durable actions across retries and restart-like dispatch", async (context) => {
  const { store, engine } = fixture(context);
  engine.create({
    name: "One event, one memory",
    enabled: true,
    trigger: { type: "memory.created", config: { debounceSeconds: 60 } },
    actions: [{ type: "memory.create", config: { title: "Derived {{trigger.title}}", content: "One durable result." } }],
  });
  const payload = { id: "memory-event-fixture", title: "Signal" };
  const [first] = await engine.dispatch("memory.created", payload);
  const [duplicate] = await engine.dispatch("memory.created", payload);
  assert.equal(first.id, duplicate.id);
  assert.equal(store.listMemories().length, 1);
  assert.equal(store.listAutomationRuns().length, 1);
});

test("missed schedule policy can skip stale runs without executing actions", async (context) => {
  const { store, engine } = fixture(context);
  const automation = engine.create({
    name: "Skip stale brief",
    enabled: true,
    trigger: {
      type: "schedule.interval",
      config: { intervalMinutes: 15, missedRunPolicy: "skip" },
    },
    actions: [{ type: "memory.create", config: { title: "Should not exist", content: "Skipped." } }],
  });
  store.updateAutomation(automation.id, { nextRunAt: "2026-08-29T08:00:00.000Z" });
  const [run] = await engine.tick(new Date("2026-08-29T10:00:00.000Z"));
  assert.equal(run.status, "skipped");
  assert.match(run.steps[0].detail, /asleep or closed/);
  assert.equal(store.listMemories().length, 0);
  assert.ok(new Date(store.getAutomation(automation.id).nextRunAt) > new Date("2026-08-29T10:00:00.000Z"));
});

test("templates cannot evaluate code and secret-like values are redacted", () => {
  const rendered = renderTemplate(
    "{{trigger.title}} {{constructor.constructor}} password=synthetic-super-secret",
    { trigger: { title: "Safe title" } },
  );
  assert.match(rendered, /^Safe title/);
  assert.doesNotMatch(rendered, /native code|Function/);
  assert.doesNotMatch(rendered, /synthetic-super-secret/);
  assert.match(rendered, /REDACTED/);
});

test("automation input rejects unsafe, unbounded, and incomplete recipes", (context) => {
  const { engine } = fixture(context);
  assert.throws(() => engine.create({
    name: "Unsafe shell",
    trigger: { type: "manual", config: {} },
    actions: [{ type: "shell.exec", config: { command: "echo nope" } }],
  }), /supported automation action/);
  assert.throws(() => engine.create({
    name: "Too frequent",
    trigger: { type: "schedule.interval", config: { intervalMinutes: 1 } },
    actions: [{ type: "memory.quality_scan", config: {} }],
  }), /between 5 minutes and one year/);
  assert.throws(() => engine.create({
    name: "No action",
    trigger: { type: "manual", config: {} },
    actions: [],
  }), /at least one automation action/);
});
