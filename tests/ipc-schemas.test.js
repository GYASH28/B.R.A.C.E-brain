import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseIpcArguments } from "../src/shared/ipc/schemas.ts";

test("IPC contracts reject malformed and oversized renderer payloads", () => {
  assert.throws(() => parseIpcArguments("brace:get-memory", [""]));
  assert.throws(() => parseIpcArguments("brace:run-assistant", [{ client: "codex", prompt: "x".repeat(12_001), contextId: "context-1" }]));
  assert.throws(() => parseIpcArguments("brace:search", [{ query: "memory", unexpected: true }]));
  assert.throws(() => parseIpcArguments("brace:create-memory", [{ title: "Title", content: "Body", injected: "field" }]));
  assert.throws(() => parseIpcArguments("brace:upsert-workspace-member", [{ workspaceId: "workspace-1", displayName: "Alex", role: "member", actorLabel: "forged" }]));
  assert.throws(() => parseIpcArguments("brace:upsert-workspace-member", [{ workspaceId: "workspace-1", displayName: "Alex", role: "member", subjectId: "forged" }]));
  assert.throws(() => parseIpcArguments("brace:upsert-workspace-member", [{ workspaceId: "workspace-1", displayName: "Alex", role: "member", capabilities: ["workspace.members.manage"] }]));
});

test("IPC contracts preserve valid local-first operations", () => {
  assert.deepEqual(parseIpcArguments("brace:get-snapshot", []), []);
  assert.deepEqual(parseIpcArguments("brace:get-memory", ["memory-1"]), ["memory-1"]);
  assert.deepEqual(parseIpcArguments("brace:export-governance-audit", ["workspace-1"]), ["workspace-1"]);
  assert.deepEqual(
    parseIpcArguments("brace:prepare-assistant-context", [{ client: "codex", prompt: "What changed?" }]),
    [{ client: "codex", prompt: "What changed?" }],
  );
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

test("shared publication IPC accepts only bounded operation facts", () => {
  assert.deepEqual(
    parseIpcArguments("brace:preview-shared-publication", [{ memoryId: "memory-1", workspaceId: "workspace-1", ownershipScope: "team" }]),
    [{ memoryId: "memory-1", workspaceId: "workspace-1", ownershipScope: "team" }],
  );
  assert.deepEqual(parseIpcArguments("brace:commit-shared-publication", [{ previewId: "preview-1" }]), [{ previewId: "preview-1" }]);
  assert.throws(() => parseIpcArguments("brace:preview-shared-publication", [{ memoryId: "memory-1", workspaceId: "workspace-1", ownershipScope: "team", actorId: "forged" }]));
  assert.throws(() => parseIpcArguments("brace:export-governance-audit", [""]));
  assert.throws(() => parseIpcArguments("brace:commit-shared-publication", [{ previewId: "preview-1", actor: "forged" }]));
  assert.throws(() => parseIpcArguments("brace:revoke-shared-publication", [{ publicationId: "publication-1", expectedRevision: 1, role: "owner" }]));
  assert.throws(() => parseIpcArguments("brace:search-shared-memories", ["query", { workspaceId: "workspace-1", content: "forged" }]));
  assert.throws(() => parseIpcArguments("brace:preview-shared-context", [{ workspaceId: "workspace-1", sourceUri: "forged" }]));
});

test("preload exposes the named shared operations but never fixture owner binding", () => {
  const preload = fs.readFileSync(path.join(process.cwd(), "electron", "preload.ts"), "utf8");
  const service = fs.readFileSync(path.join(process.cwd(), "electron", "memory-service.ts"), "utf8");
  for (const method of ["previewBraceSharedPublication", "commitBraceSharedPublication", "revokeBraceSharedPublication", "getBraceSharedMemory", "listBraceSharedMemories", "searchBraceSharedMemories", "getBraceSharedMemoryGraph", "exportBraceSharedProjection", "exportBraceGovernanceAudit", "previewBraceSharedContext"]) assert.match(preload, new RegExp(`\\b${method}\\b`));
  assert.doesNotMatch(preload, /bindMemoryOwnerForFixture/);
  assert.doesNotMatch(service, /bindMemoryOwnerForFixture/);
});
