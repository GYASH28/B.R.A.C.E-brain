"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MemoryStore } = require("../core/memory-store");
const { indexProject } = require("../core/project-indexer");
const {
  installSkill,
  runSkillAction,
  validateManifest,
} = require("../core/skill-runtime");

const root = path.resolve(__dirname, "..");

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-skills-"));
  const store = new MemoryStore(path.join(directory, "profile", "brace.sqlite3"));
  context.after(() => {
    try { store.close(); } catch {}
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  return { directory, store };
}

test("skill manifests reject undeclared or arbitrary operations", () => {
  assert.throws(() => validateManifest({
    schemaVersion: 1,
    name: "unsafe-skill",
    version: "1.0.0",
    description: "Attempts arbitrary execution.",
    license: "private",
    permissions: [],
    actions: [{ id: "run-shell", steps: [{ use: "shell.exec", with: { command: "whoami" } }] }],
  }), /Unsupported skill operation/);

  assert.throws(() => validateManifest({
    schemaVersion: 1,
    name: "under-scoped",
    version: "1.0.0",
    description: "Writes without permission.",
    license: "MIT",
    permissions: [],
    actions: [{ id: "remember", steps: [{ use: "memory.create", with: {} }] }],
  }), /without requesting memory:write/);
});

test("installation requires exact permission approval and starts disabled", (context) => {
  const { directory, store } = fixture(context);
  const manifestPath = path.join(root, "examples", "skills", "decision-journal", "brace-skill.json");
  assert.throws(() => installSkill(store, manifestPath, {
    installRoot: path.join(directory, "installed"),
    approvedPermissions: ["timeline:read"],
  }), /decision:write/);
  const installed = installSkill(store, manifestPath, {
    installRoot: path.join(directory, "installed"),
    approvedPermissions: ["decision:write", "timeline:read"],
  });
  assert.equal(installed.enabled, false);
  assert.deepEqual(installed.permissions, ["decision:write", "timeline:read"]);
  assert.throws(() => runSkillAction(store, installed.name, "capture-decision", {}), /disabled/);
});

test("enabled declarative skills run only approved memory operations", (context) => {
  const { directory, store } = fixture(context);
  const project = store.upsertProject({
    name: "Northstar",
    rootPath: path.join(directory, "northstar"),
  });
  const installed = installSkill(
    store,
    path.join(root, "examples", "skills", "decision-journal", "brace-skill.json"),
    {
      installRoot: path.join(directory, "installed"),
      approvedPermissions: ["decision:write", "timeline:read"],
      enabled: true,
    },
  );
  const result = runSkillAction(store, installed.name, "capture-decision", {
    projectId: project.id,
    title: "Keep the demo synthetic",
    context: "Public artifacts require non-personal examples.",
    decision: "Use the fictional Northstar workspace everywhere public.",
    rationale: "It makes privacy verifiable.",
    alternatives: ["redact real screenshots"],
  });
  assert.equal(result.results[0].use, "decision.create");
  assert.equal(result.results[1].result[0].eventType, "decision.recorded");
  assert.ok(store.listTimeline().some((event) => event.eventType === "skill.ran"));
});

test("memory-aware recall keeps durable memories and sources as separate evidence", async (context) => {
  const { directory, store } = fixture(context);
  const projectRoot = path.join(directory, "northstar");
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "README.md"), "# Northstar\n\nOffline search is the first milestone.\n");
  const indexed = await indexProject(store, { rootPath: projectRoot, name: "Northstar" });
  store.createMemory({
    kind: "decision",
    scope: `project:${indexed.projectId}`,
    title: "Offline search milestone",
    content: "Ship lexical retrieval before optional local embeddings.",
  });
  const installed = installSkill(
    store,
    path.join(root, "examples", "skills", "project-recall", "brace-skill.json"),
    {
      installRoot: path.join(directory, "installed"),
      approvedPermissions: ["memory:read", "source:read"],
      enabled: true,
    },
  );
  const result = runSkillAction(store, installed.name, "recall", {
    scope: `project:${indexed.projectId}`,
    projectId: indexed.projectId,
    query: "offline search",
  });
  assert.equal(result.results[0].result.results.length, 1);
  assert.equal(result.results[1].result.results.length, 1);
});

test("runtime detects installed-manifest tampering before execution", (context) => {
  const { directory, store } = fixture(context);
  const installed = installSkill(
    store,
    path.join(root, "examples", "skills", "project-recall", "brace-skill.json"),
    {
      installRoot: path.join(directory, "installed"),
      approvedPermissions: ["memory:read", "source:read"],
      enabled: true,
    },
  );
  fs.appendFileSync(path.join(installed.installPath, "brace-skill.json"), "\n");
  assert.throws(() => runSkillAction(store, installed.name, "recall", {}), /changed on disk/);
});
