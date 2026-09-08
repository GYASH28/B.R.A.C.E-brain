"use strict";

// Approval records are deliberately separate from connector execution. This local
// core can authorize one exact, inspectable plan but never performs an external
// effect. A future connector runtime must consume the returned one-time grant
// immediately before its own idempotent write.

const { createHash, randomUUID } = require("node:crypto");
const { authorize } = require("../business-authorization");

function approvalError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function iso(clock) {
  const value = Number(clock());
  if (!Number.isFinite(value)) throw approvalError("APPROVAL_CLOCK_INVALID", "The approval clock returned an invalid time.");
  return new Date(value).toISOString();
}

function text(value, label, maximum) {
  const result = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!result || result.length > maximum || /[\u0000-\u001f\u007f]/.test(result)) {
    throw approvalError("APPROVAL_PLAN_INVALID", `A valid ${label} is required.`);
  }
  return result;
}

function optionalText(value, label, maximum) {
  if (value === null || value === undefined || value === "") return null;
  return text(value, label, maximum);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) { return createHash("sha256").update(canonical(value)).digest("hex"); }

function stringList(value, label, maximumCount, maximumLength) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maximumCount) {
    throw approvalError("APPROVAL_PLAN_INVALID", `${label} must be a small list.`);
  }
  return [...new Set(value.map((entry) => text(entry, label, maximumLength)))];
}

function opaqueRefs(value) {
  const refs = stringList(value, "credential reference", 20, 180);
  if (refs.some((entry) => !/^[a-z][a-z0-9:/._-]*$/i.test(entry))) {
    throw approvalError("APPROVAL_PLAN_INVALID", "Credential references must be opaque identifiers, never credentials.");
  }
  return refs;
}

function integer(value, label, minimum, maximum, fallback) {
  if (value === undefined || value === null) return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw approvalError("APPROVAL_PLAN_INVALID", `${label} is outside its safe policy limit.`);
  }
  return number;
}

function normalizedPlan(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw approvalError("APPROVAL_PLAN_INVALID", "An inspectable approval plan is required.");
  }
  const target = input.target;
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    throw approvalError("APPROVAL_PLAN_INVALID", "The plan must name one exact target.");
  }
  const rollback = input.rollback && typeof input.rollback === "object" && !Array.isArray(input.rollback) ? input.rollback : {};
  const budgets = input.budgets && typeof input.budgets === "object" && !Array.isArray(input.budgets) ? input.budgets : {};
  return Object.freeze({
    schemaVersion: 1,
    action: text(input.action, "action", 120),
    target: Object.freeze({
      type: text(target.type, "target type", 80),
      id: text(target.id, "target id", 160),
      label: text(target.label, "target label", 240),
    }),
    summary: text(input.summary, "effect summary", 2_000),
    payloadPreview: optionalText(input.payloadPreview, "payload preview", 4_000),
    dataLeaving: Object.freeze(stringList(input.dataLeaving, "data-leaving description", 30, 300)),
    credentialRefs: Object.freeze(opaqueRefs(input.credentialRefs)),
    rollback: Object.freeze({
      available: rollback.available === true,
      summary: optionalText(rollback.summary, "rollback summary", 1_000),
    }),
    budgets: Object.freeze({
      maxCostCents: integer(budgets.maxCostCents, "maximum cost", 0, 1_000_000, 0),
      maxRuntimeSeconds: integer(budgets.maxRuntimeSeconds, "maximum runtime", 1, 3_600, 300),
      maxExternalCalls: integer(budgets.maxExternalCalls, "maximum external calls", 0, 100, 1),
    }),
  });
}

function requestDto(row, includePlan = true) {
  if (!row) return null;
  const value = {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    requesterSubjectId: row.requester_subject_id,
    automationId: row.automation_id,
    automationRunId: row.automation_run_id,
    action: row.action,
    targetLabel: row.target_label,
    riskLevel: row.risk_level,
    planHash: row.plan_hash,
    status: row.status,
    correlationId: row.correlation_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    decidedBySubjectId: row.decided_by_subject_id,
    decisionNote: row.decision_note,
    consumedAt: row.consumed_at,
    invalidatedAt: row.invalidated_at,
  };
  if (includePlan) value.plan = JSON.parse(row.plan_json);
  return value;
}

function auditDto(row) {
  return row && {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    actorSubjectId: row.actor_subject_id,
    serviceSubjectId: row.service_subject_id,
    eventType: row.event_type,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    outcome: row.outcome,
    policyDecision: row.policy_decision,
    correlationId: row.correlation_id,
    metadata: JSON.parse(row.metadata_json),
    previousDigest: row.previous_digest,
    digest: row.event_digest,
    occurredAt: row.occurred_at,
  };
}

class ApprovalRepository {
  constructor(database, options = {}) {
    this.db = database;
    this.transaction = options.transaction;
    this.organizations = options.organizationRepository;
    this.clock = typeof options.clock === "function" ? options.clock : Date.now;
    if (typeof this.transaction !== "function" || !this.organizations) {
      throw new Error("ApprovalRepository requires organization authorization and a transaction boundary.");
    }
  }

  facts(workspaceId, subjectId) {
    return this.organizations.resolveWorkspaceAuthorizationFacts(workspaceId, subjectId, {
      id: String(workspaceId || ""), scope: "team",
    });
  }

  require(workspaceId, subjectId, action) {
    const facts = this.facts(workspaceId, subjectId);
    const decision = authorize({ action, ...facts });
    if (!decision.allowed) {
      const error = approvalError("AUTHORIZATION_DENIED", "The approval action is not available for this active identity.");
      Object.defineProperty(error, "details", { value: Object.freeze({ decision }), enumerable: false });
      throw error;
    }
    return facts;
  }

  appendAudit(input = {}) {
    const last = this.db.prepare("SELECT event_digest FROM governance_audit_events WHERE organization_id=? ORDER BY sequence DESC LIMIT 1")
      .get(input.organizationId);
    const previousDigest = last?.event_digest || null;
    const sequence = Number(this.db.prepare("SELECT COALESCE(MAX(sequence),0)+1 AS value FROM governance_audit_events WHERE organization_id=?")
      .get(input.organizationId).value);
    const event = {
      id: input.id || randomUUID(), sequence, organizationId: input.organizationId,
      workspaceId: input.workspaceId || null, actorSubjectId: input.actorSubjectId || null,
      serviceSubjectId: input.serviceSubjectId || null, eventType: text(input.eventType, "audit event type", 120),
      resourceType: text(input.resourceType, "audit resource type", 80), resourceId: text(input.resourceId, "audit resource id", 160),
      outcome: text(input.outcome, "audit outcome", 40), policyDecision: text(input.policyDecision, "policy decision", 40),
      correlationId: text(input.correlationId, "correlation id", 160),
      metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {},
      previousDigest, occurredAt: input.occurredAt || iso(this.clock),
    };
    const eventDigest = digest(event);
    this.db.prepare(`INSERT INTO governance_audit_events(
      id,sequence,organization_id,workspace_id,actor_subject_id,service_subject_id,
      event_type,resource_type,resource_id,outcome,policy_decision,correlation_id,
      metadata_json,previous_digest,event_digest,occurred_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      event.id, event.sequence, event.organizationId, event.workspaceId, event.actorSubjectId, event.serviceSubjectId,
      event.eventType, event.resourceType, event.resourceId, event.outcome, event.policyDecision, event.correlationId,
      JSON.stringify(event.metadata), event.previousDigest, eventDigest, event.occurredAt,
    );
    return auditDto(this.db.prepare("SELECT * FROM governance_audit_events WHERE id=?").get(event.id));
  }

  createRequest(input = {}, requesterSubjectId) {
    return this.transaction(() => {
      const workspaceId = text(input.workspaceId, "workspace id", 160);
      const facts = this.require(workspaceId, requesterSubjectId, "approval.request");
      if (facts.subject.kind !== "service") throw approvalError("APPROVAL_REQUESTER_MUST_BE_SERVICE", "Only a bounded service identity may request an agent approval.");
      const plan = normalizedPlan(input.plan);
      const riskLevel = ["low", "medium", "high", "critical"].includes(input.riskLevel) ? input.riskLevel : "high";
      const expiration = Date.parse(String(input.expiresAt || ""));
      const now = Number(this.clock());
      if (!Number.isFinite(expiration) || expiration <= now || expiration > now + 86_400_000) {
        throw approvalError("APPROVAL_EXPIRY_INVALID", "Approvals must expire within 24 hours.");
      }
      const id = text(input.id || randomUUID(), "approval id", 160);
      const correlationId = text(input.correlationId || id, "correlation id", 160);
      const planHash = digest(plan);
      const timestamp = iso(this.clock);
      this.db.prepare(`INSERT INTO agent_approval_requests(
        id,organization_id,workspace_id,requester_subject_id,automation_id,automation_run_id,
        action,target_label,risk_level,plan_json,plan_hash,correlation_id,status,expires_at,
        created_at,decided_at,decided_by_subject_id,decision_note,consumed_at,invalidated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?, ?, NULL,NULL,NULL,NULL,NULL)`).run(
        id, facts.organization.id, facts.workspace.id, facts.subject.id,
        optionalText(input.automationId, "automation id", 160), optionalText(input.automationRunId, "automation run id", 160),
        plan.action, plan.target.label, riskLevel, JSON.stringify(plan), planHash, correlationId,
        new Date(expiration).toISOString(), timestamp,
      );
      this.appendAudit({ organizationId: facts.organization.id, workspaceId: facts.workspace.id, serviceSubjectId: facts.subject.id,
        eventType: "approval.requested", resourceType: "approval", resourceId: id, outcome: "pending", policyDecision: "allow",
        correlationId, metadata: { action: plan.action, targetType: plan.target.type, planHash, riskLevel }, occurredAt: timestamp });
      return requestDto(this.db.prepare("SELECT * FROM agent_approval_requests WHERE id=?").get(id));
    });
  }

  loadRequest(id) {
    const row = this.db.prepare("SELECT * FROM agent_approval_requests WHERE id=?").get(String(id || ""));
    if (!row) throw approvalError("APPROVAL_NOT_FOUND");
    return row;
  }

  expireIfNeeded(row) {
    if (row.status === "pending" && Date.parse(row.expires_at) <= Number(this.clock())) {
      this.db.prepare("UPDATE agent_approval_requests SET status='expired' WHERE id=? AND status='pending'").run(row.id);
      return this.loadRequest(row.id);
    }
    return row;
  }

  decide(input = {}, approverSubjectId, status) {
    const result = this.transaction(() => {
      let row = this.expireIfNeeded(this.loadRequest(input.approvalId));
      const facts = this.require(row.workspace_id, approverSubjectId, "approval.decide");
      if (facts.subject.kind !== "human") throw approvalError("APPROVAL_DECIDER_MUST_BE_HUMAN", "A human manager must decide an agent approval.");
      if (facts.subject.id === row.requester_subject_id) throw approvalError("APPROVAL_SELF_DECISION_DENIED");
      if (row.status !== "pending") throw approvalError(row.status === "expired" ? "APPROVAL_EXPIRED" : "APPROVAL_NOT_PENDING");
      const suppliedHash = text(input.planHash, "plan hash", 128);
      if (suppliedHash !== row.plan_hash || digest(JSON.parse(row.plan_json)) !== row.plan_hash) {
        this.db.prepare("UPDATE agent_approval_requests SET status='invalidated',invalidated_at=? WHERE id=? AND status='pending'").run(iso(this.clock), row.id);
        this.appendAudit({ organizationId: row.organization_id, workspaceId: row.workspace_id, actorSubjectId: facts.subject.id,
          serviceSubjectId: row.requester_subject_id, eventType: "approval.invalidated", resourceType: "approval", resourceId: row.id,
          outcome: "denied", policyDecision: "deny", correlationId: row.correlation_id, metadata: { reason: "plan_hash_mismatch" } });
        return { mismatch: true };
      }
      const timestamp = iso(this.clock);
      const note = optionalText(input.note, "decision note", 1_000);
      this.db.prepare("UPDATE agent_approval_requests SET status=?,decided_at=?,decided_by_subject_id=?,decision_note=? WHERE id=? AND status='pending'")
        .run(status, timestamp, facts.subject.id, note, row.id);
      this.appendAudit({ organizationId: row.organization_id, workspaceId: row.workspace_id, actorSubjectId: facts.subject.id,
        serviceSubjectId: row.requester_subject_id, eventType: status === "approved" ? "approval.approved" : "approval.denied",
        resourceType: "approval", resourceId: row.id, outcome: status, policyDecision: "allow", correlationId: row.correlation_id,
        metadata: { planHash: row.plan_hash, riskLevel: row.risk_level }, occurredAt: timestamp });
      return requestDto(this.loadRequest(row.id));
    });
    if (result?.mismatch) throw approvalError("APPROVAL_PLAN_MISMATCH", "The reviewed plan no longer matches the immutable request.");
    return result;
  }

  approve(input = {}, subjectId) { return this.decide(input, subjectId, "approved"); }
  deny(input = {}, subjectId) { return this.decide(input, subjectId, "denied"); }

  consume(input = {}, serviceSubjectId) {
    const result = this.transaction(() => {
      let row = this.expireIfNeeded(this.loadRequest(input.approvalId));
      const facts = this.require(row.workspace_id, serviceSubjectId, "approval.consume");
      if (facts.subject.kind !== "service" || facts.subject.id !== row.requester_subject_id) {
        throw approvalError("APPROVAL_CONSUMER_DENIED", "Only the requesting service identity can consume this approval.");
      }
      if (row.status !== "approved") throw approvalError(row.status === "expired" ? "APPROVAL_EXPIRED" : "APPROVAL_NOT_APPROVED");
      const suppliedHash = text(input.planHash, "plan hash", 128);
      if (suppliedHash !== row.plan_hash || digest(JSON.parse(row.plan_json)) !== row.plan_hash) {
        this.db.prepare("UPDATE agent_approval_requests SET status='invalidated',invalidated_at=? WHERE id=? AND status='approved'").run(iso(this.clock), row.id);
        this.appendAudit({ organizationId: row.organization_id, workspaceId: row.workspace_id, serviceSubjectId: facts.subject.id,
          eventType: "approval.invalidated", resourceType: "approval", resourceId: row.id, outcome: "denied", policyDecision: "deny",
          correlationId: row.correlation_id, metadata: { reason: "plan_hash_mismatch" } });
        return { mismatch: true };
      }
      const timestamp = iso(this.clock);
      this.db.prepare("UPDATE agent_approval_requests SET status='consumed',consumed_at=? WHERE id=? AND status='approved'").run(timestamp, row.id);
      this.appendAudit({ organizationId: row.organization_id, workspaceId: row.workspace_id, serviceSubjectId: facts.subject.id,
        eventType: "approval.consumed", resourceType: "approval", resourceId: row.id, outcome: "consumed", policyDecision: "allow",
        correlationId: row.correlation_id, metadata: { planHash: row.plan_hash }, occurredAt: timestamp });
      const current = this.loadRequest(row.id);
      return Object.freeze({ approvalId: current.id, planHash: current.plan_hash, correlationId: current.correlation_id, expiresAt: current.expires_at });
    });
    if (result?.mismatch) throw approvalError("APPROVAL_PLAN_MISMATCH");
    return result;
  }

  list(options = {}, subjectId) {
    const workspaceId = text(options.workspaceId, "workspace id", 160);
    this.require(workspaceId, subjectId, "approval.decide");
    const status = options.status && ["pending", "approved", "denied", "expired", "consumed", "invalidated"].includes(options.status) ? options.status : null;
    const limit = Math.min(200, Math.max(1, Number(options.limit) || 50));
    const rows = status
      ? this.db.prepare("SELECT * FROM agent_approval_requests WHERE workspace_id=? AND status=? ORDER BY created_at DESC LIMIT ?").all(workspaceId, status, limit)
      : this.db.prepare("SELECT * FROM agent_approval_requests WHERE workspace_id=? ORDER BY created_at DESC LIMIT ?").all(workspaceId, limit);
    return rows.map((row) => requestDto(this.expireIfNeeded(row)));
  }

  verifyOrganizationChain(organizationId) {
    const rows = this.db.prepare("SELECT * FROM governance_audit_events WHERE organization_id=? ORDER BY sequence").all(organizationId);
    let previousDigest = null;
    for (const row of rows) {
      const event = { id: row.id, sequence: Number(row.sequence), organizationId: row.organization_id, workspaceId: row.workspace_id,
        actorSubjectId: row.actor_subject_id, serviceSubjectId: row.service_subject_id, eventType: row.event_type, resourceType: row.resource_type,
        resourceId: row.resource_id, outcome: row.outcome, policyDecision: row.policy_decision, correlationId: row.correlation_id,
        metadata: JSON.parse(row.metadata_json), previousDigest: row.previous_digest, occurredAt: row.occurred_at };
      if (row.previous_digest !== previousDigest || digest(event) !== row.event_digest) {
        return Object.freeze({ ok: false, checked: rows.length, invalidEventId: row.id });
      }
      previousDigest = row.event_digest;
    }
    return Object.freeze({ ok: true, checked: rows.length, headDigest: previousDigest });
  }

  exportWorkspaceAudit(workspaceId, subjectId) {
    const facts = this.require(text(workspaceId, "workspace id", 160), subjectId, "audit.read");
    const verification = this.verifyOrganizationChain(facts.organization.id);
    if (!verification.ok) {
      throw approvalError("AUDIT_INTEGRITY_FAILED", "The governance audit chain did not verify, so no evidence export was created.");
    }
    const rows = this.db.prepare(`
      SELECT * FROM governance_audit_events
      WHERE organization_id=? AND workspace_id=?
      ORDER BY sequence
    `).all(facts.organization.id, facts.workspace.id);
    return Object.freeze({
      format: "brace-governance-audit-v1",
      generatedAt: iso(this.clock),
      organizationId: facts.organization.id,
      workspaceId: facts.workspace.id,
      scope: "workspace",
      integrity: Object.freeze({
        verified: true,
        organizationChainEventCount: verification.checked,
        organizationChainHeadDigest: verification.headDigest,
        note: "This workspace-scoped report contains only events the active audit role may read. The chain was verified on this device across the organization before export.",
      }),
      events: Object.freeze(rows.map(auditDto)),
    });
  }

  verifyAuditChain(organizationId, subjectId) {
    const requestedOrganization = text(organizationId, "organization id", 160);
    const firstWorkspace = this.db.prepare(`
      SELECT w.id FROM workspaces w
      JOIN workspace_members m ON m.workspace_id=w.id
      WHERE w.organization_id=? AND m.subject_id=? AND m.status='active'
      ORDER BY w.created_at LIMIT 1
    `).get(requestedOrganization, String(subjectId || ""));
    if (!firstWorkspace) throw approvalError("ORGANIZATION_NOT_FOUND");
    this.require(firstWorkspace.id, subjectId, "audit.read");
    return this.verifyOrganizationChain(requestedOrganization);
  }
}

module.exports = { ApprovalRepository, normalizedPlan };
