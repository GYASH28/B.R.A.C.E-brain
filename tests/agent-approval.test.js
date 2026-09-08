"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MemoryStore, SCHEMA_VERSION } = require("../core/memory-store");

const START = Date.parse("2026-09-08T12:00:00.000Z");

function expectCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code);
}

function createFixture(context) {
  let now = START;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-approvals-"));
  const store = new MemoryStore(path.join(directory, "brace.sqlite3"), { clock: () => now });
  context.after(() => { try { store.close(); } catch {}; fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  const organizationId = "approval-org";
  const workspaceId = "approval-workspace";
  store.createOrganization({ id: organizationId, name: "Synthetic Approval Org" });
  store.createWorkspace({ id: workspaceId, organizationId, name: "Agent Operations", kind: "project", visibility: "team" });
  const owner = store.createAuthorizationSubjectForFixture({ id: "human-owner", issuer: "fixture", verified: true });
  const manager = store.createAuthorizationSubjectForFixture({ id: "human-manager", issuer: "fixture", verified: true });
  const member = store.createAuthorizationSubjectForFixture({ id: "human-member", issuer: "fixture", verified: true });
  const service = store.createAuthorizationSubjectForFixture({ id: "service-agent", issuer: "fixture", kind: "service", verified: true });
  for (const [subject, role, capabilities] of [
    [owner, "owner", []], [manager, "manager", []], [member, "member", []],
    [service, "member", ["approval.request", "approval.consume"]],
  ]) {
    store.upsertWorkspaceMemberForFixture({ workspaceId, subjectId: subject.id, displayName: subject.id, email: `${subject.id}@example.invalid`, role, capabilities });
  }
  const plan = {
    action: "connector.send",
    target: { type: "message-thread", id: "thread-42", label: "Synthetic customer update" },
    summary: "Send the reviewed project-status update to one approved destination.",
    payloadPreview: "Subject: Project status\nBody: Approved summary only",
    dataLeaving: ["The approved project-status summary"],
    credentialRefs: ["keychain://connector/slack/workspace-a"],
    rollback: { available: false, summary: "A follow-up correction is available, but the sent message cannot be unsent." },
    budgets: { maxCostCents: 0, maxRuntimeSeconds: 120, maxExternalCalls: 1 },
  };
  return { store, organizationId, workspaceId, owner, manager, member, service, plan, advance(ms) { now += ms; } };
}

function request(fixture, overrides = {}) {
  return fixture.store.requestAgentApproval({
    workspaceId: fixture.workspaceId,
    plan: fixture.plan,
    riskLevel: "high",
    correlationId: "agent-run-42",
    expiresAt: new Date(START + 3_600_000).toISOString(),
    ...overrides,
  }, fixture.service.id);
}

test("a service can request one immutable plan which a human can approve and consume exactly once", (context) => {
  const fixture = createFixture(context);
  const pending = request(fixture);
  assert.equal(pending.status, "pending");
  assert.equal(pending.plan.credentialRefs[0], "keychain://connector/slack/workspace-a");
  assert.equal(fixture.store.stats().pendingAgentApprovals, 1);
  const approved = fixture.store.approveAgentPlan({ approvalId: pending.id, planHash: pending.planHash, note: "Checked the destination and data boundary." }, fixture.manager.id);
  assert.equal(approved.status, "approved");
  const grant = fixture.store.consumeAgentApproval({ approvalId: pending.id, planHash: pending.planHash }, fixture.service.id);
  assert.equal(grant.approvalId, pending.id);
  assert.equal(fixture.store.stats().pendingAgentApprovals, 0);
  expectCode(() => fixture.store.consumeAgentApproval({ approvalId: pending.id, planHash: pending.planHash }, fixture.service.id), "APPROVAL_NOT_APPROVED");
  const chain = fixture.store.verifyGovernanceAuditChain(fixture.organizationId, fixture.owner.id);
  assert.equal(chain.ok, true);
  assert.equal(chain.checked, 3);
  const evidence = fixture.store.exportWorkspaceGovernanceAudit(fixture.workspaceId, fixture.owner.id);
  assert.equal(evidence.format, "brace-governance-audit-v1");
  assert.equal(evidence.integrity.verified, true);
  assert.equal(evidence.events.length, 3);
  assert.equal(JSON.stringify(evidence).includes("Approved summary only"), false);
  expectCode(() => fixture.store.exportWorkspaceGovernanceAudit(fixture.workspaceId, fixture.member.id), "AUTHORIZATION_DENIED");
});

test("approval policy denies ungranted actors, self-service decisions, altered plans, expiry, and revoked services", (context) => {
  const fixture = createFixture(context);
  expectCode(() => fixture.store.requestAgentApproval({ workspaceId: fixture.workspaceId, plan: fixture.plan, expiresAt: new Date(START + 3_600_000).toISOString() }, fixture.member.id), "AUTHORIZATION_DENIED");
  const pending = request(fixture);
  expectCode(() => fixture.store.approveAgentPlan({ approvalId: pending.id, planHash: pending.planHash }, fixture.service.id), "AUTHORIZATION_DENIED");
  expectCode(() => fixture.store.approveAgentPlan({ approvalId: pending.id, planHash: "0".repeat(64) }, fixture.manager.id), "APPROVAL_PLAN_MISMATCH");
  assert.equal(fixture.store.listAgentApprovals({ workspaceId: fixture.workspaceId }, fixture.manager.id).find((item) => item.id === pending.id)?.status, "invalidated");

  const expiring = request(fixture, { id: "expiring-approval", expiresAt: new Date(START + 1_000).toISOString() });
  fixture.advance(2_000);
  expectCode(() => fixture.store.approveAgentPlan({ approvalId: expiring.id, planHash: expiring.planHash }, fixture.manager.id), "APPROVAL_EXPIRED");

  const live = request(fixture, { id: "revoked-service-approval", expiresAt: new Date(START + 3_600_000).toISOString() });
  fixture.store.approveAgentPlan({ approvalId: live.id, planHash: live.planHash }, fixture.manager.id);
  fixture.store.setAuthorizationSubjectStatusForFixture(fixture.service.id, "revoked");
  expectCode(() => fixture.store.consumeAgentApproval({ approvalId: live.id, planHash: live.planHash }, fixture.service.id), "AUTHORIZATION_DENIED");
});

test("the audit chain detects direct record tampering and v10 databases migrate additively", (context) => {
  const fixture = createFixture(context);
  request(fixture);
  const event = fixture.store.db.prepare("SELECT id FROM governance_audit_events ORDER BY sequence LIMIT 1").get();
  fixture.store.db.prepare("UPDATE governance_audit_events SET metadata_json='{}' WHERE id=?").run(event.id);
  assert.deepEqual(fixture.store.verifyGovernanceAuditChain(fixture.organizationId, fixture.owner.id), { ok: false, checked: 1, invalidEventId: event.id });
  expectCode(() => fixture.store.exportWorkspaceGovernanceAudit(fixture.workspaceId, fixture.owner.id), "AUDIT_INTEGRITY_FAILED");
  assert.equal(SCHEMA_VERSION, 11);

  fixture.store.db.exec("PRAGMA user_version = 10");
  fixture.store.close();
  const migrated = new MemoryStore(path.join(path.dirname(fixture.store.databasePath), "brace.sqlite3"));
  context.after(() => migrated.close());
  assert.equal(migrated.stats().schemaVersion, 11);
  assert.equal(migrated.stats().pendingAgentApprovals, 1);
});
