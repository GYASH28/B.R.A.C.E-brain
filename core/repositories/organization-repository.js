"use strict";

const { randomUUID } = require("node:crypto");
const { ACTION_CAPABILITIES, authorize } = require("../business-authorization");

const CAPABILITY_ALLOWLIST = new Set(Object.values(ACTION_CAPABILITIES));

function nowIso() { return new Date().toISOString(); }
function text(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function parse(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
function capabilities(value) {
  const parsed = parse(value, []);
  return Array.isArray(parsed) ? [...new Set(parsed.filter((entry) => typeof entry === "string" && CAPABILITY_ALLOWLIST.has(entry)))] : [];
}
function organization(row) { return row && { id: row.id, name: row.name, slug: row.slug, edition: row.edition, dataResidency: row.data_residency, ownershipBoundary: row.ownership_boundary, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }; }
function workspace(row) { return row && { id: row.id, organizationId: row.organization_id, name: row.name, kind: row.kind, visibility: row.visibility, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }; }
function dataPolicy(row, workspaceId = null) {
  return Object.freeze({
    workspaceId: row?.workspace_id || workspaceId || null,
    classification: row?.classification || "internal",
    retentionReviewDays: row?.retention_review_days === null || row?.retention_review_days === undefined ? null : Number(row.retention_review_days),
    legalHold: Boolean(row?.legal_hold),
    policyVersion: Number(row?.policy_version || 0),
    updatedBySubjectId: row?.updated_by_subject_id || null,
    updatedAt: row?.updated_at || null,
  });
}
function member(row) { return row && { id: row.id, workspaceId: row.workspace_id, subjectId: row.subject_id, displayName: row.display_name, email: row.email, role: row.role, status: row.status, capabilities: capabilities(row.capabilities_json), createdAt: row.created_at, updatedAt: row.updated_at }; }
function subject(row) { return row && { id: row.id, kind: row.kind, verified: Boolean(row.verified_at), status: row.status }; }
function auditEvent(row) { return row && { id: row.id, organizationId: row.organization_id, workspaceId: row.workspace_id, eventType: row.event_type, actorLabel: row.actor_label, summary: row.summary, metadata: parse(row.metadata_json, {}), occurredAt: row.occurred_at }; }

class OrganizationRepository {
  constructor(database, transaction) {
    this.db = database;
    this.transaction = transaction;
  }

  create(input = {}) {
    const name = text(input.name).slice(0, 120);
    if (!name) throw new Error("An organization name is required.");
    const baseSlug = (text(input.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "organization").slice(0, 80);
    let slug = baseSlug;
    let suffix = 1;
    while (this.db.prepare("SELECT 1 FROM organizations WHERE slug = ?").get(slug)) {
      suffix += 1;
      slug = `${baseSlug.slice(0, Math.max(1, 79 - String(suffix).length))}-${suffix}`;
    }
    const id = String(input.id || randomUUID());
    const timestamp = nowIso();
    const edition = ["personal", "team", "enterprise"].includes(input.edition) ? input.edition : "team";
    const boundary = text(input.ownershipBoundary || "Company workspaces are governed; personal memory remains private.").slice(0, 500);
    const defaults = edition === "personal"
      ? [["Personal Brain", "personal", "personal"]]
      : [["Company Brain", "team", "organization"], ["Executive Room", "executive", "team"], ["Projects", "project", "team"]];
    this.transaction(() => {
      this.db.prepare("INSERT INTO organizations(id,name,slug,edition,data_residency,ownership_boundary,status,created_at,updated_at) VALUES (?,?,?,?, 'local',?,'active',?,?)")
        .run(id, name, slug, edition, boundary, timestamp, timestamp);
      const insertWorkspace = this.db.prepare("INSERT INTO workspaces(id,organization_id,name,kind,visibility,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)");
      for (const [workspaceName, kind, visibility] of defaults) insertWorkspace.run(randomUUID(), id, workspaceName, kind, visibility, timestamp, timestamp);
      this.insertAudit({ organizationId: id, eventType: "organization.created", actorLabel: input.actorLabel || "Local owner", summary: `${name} created on this device`, occurredAt: timestamp });
    });
    return this.overview(id);
  }

  list() {
    return this.db.prepare("SELECT * FROM organizations ORDER BY updated_at DESC").all().map(organization);
  }

  createWorkspace(input = {}) {
    const organizationId = String(input.organizationId || "");
    if (!this.db.prepare("SELECT 1 FROM organizations WHERE id=?").get(organizationId)) throw new Error("Organization not found.");
    const name = text(input.name).slice(0, 120);
    if (!name) throw new Error("A workspace name is required.");
    const kind = ["personal", "team", "executive", "project"].includes(input.kind) ? input.kind : "team";
    const visibility = ["personal", "team", "organization"].includes(input.visibility) ? input.visibility : kind === "personal" ? "personal" : "team";
    const id = String(input.id || randomUUID());
    const timestamp = nowIso();
    this.transaction(() => {
      this.db.prepare("INSERT INTO workspaces(id,organization_id,name,kind,visibility,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)")
        .run(id, organizationId, name, kind, visibility, timestamp, timestamp);
      this.insertAudit({ organizationId, workspaceId: id, eventType: "workspace.created", actorLabel: input.actorLabel, summary: `${name} workspace created` });
    });
    return workspace(this.db.prepare("SELECT * FROM workspaces WHERE id=?").get(id));
  }

  createSubjectForFixture(input = {}) {
    const id = String(input.id || randomUUID());
    const kind = input.kind === "service" ? "service" : "human";
    const status = ["active", "suspended", "revoked"].includes(input.status) ? input.status : "active";
    const timestamp = nowIso();
    const issuer = text(input.issuer || "fixture").slice(0, 120);
    const providerSubject = text(input.providerSubject || id).slice(0, 254);
    this.db.prepare("INSERT INTO authorization_subjects(id,kind,issuer,provider_subject,verified_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(id, kind, issuer, providerSubject, input.verified === true ? timestamp : null, status, timestamp, timestamp);
    return subject(this.db.prepare("SELECT * FROM authorization_subjects WHERE id=?").get(id));
  }

  resolveWorkspaceAuthorizationFacts(workspaceId, actorSubjectId, resource = {}) {
    const normalizedWorkspaceId = String(workspaceId || "");
    const workspaceRow = this.db.prepare("SELECT * FROM workspaces WHERE id=?").get(normalizedWorkspaceId);
    const organizationRow = workspaceRow && this.db.prepare("SELECT * FROM organizations WHERE id=?").get(workspaceRow.organization_id);
    const subjectRow = actorSubjectId && this.db.prepare("SELECT * FROM authorization_subjects WHERE id=?").get(String(actorSubjectId));
    const membershipRow = workspaceRow && actorSubjectId && this.db.prepare("SELECT * FROM workspace_members WHERE workspace_id=? AND subject_id=?").get(normalizedWorkspaceId, String(actorSubjectId));
    return {
      subject: subject(subjectRow),
      organization: organization(organizationRow),
      workspace: workspace(workspaceRow),
      membership: membershipRow && { ...member(membershipRow), organizationId: workspaceRow.organization_id },
      resource: workspaceRow && {
        ...resource,
        id: String(resource.id || workspaceRow.id),
        scope: resource.scope || workspaceRow.visibility,
        organizationId: resource.organizationId || workspaceRow.organization_id,
        workspaceId: resource.workspaceId || workspaceRow.id,
      },
    };
  }

  resolveMemberManagementFacts(workspaceId, actorSubjectId) {
    return this.resolveWorkspaceAuthorizationFacts(workspaceId, actorSubjectId);
  }

  memberManagementDecision(workspaceId, actorSubjectId) {
    return authorize({
      action: "workspace.members.manage",
      ...this.resolveMemberManagementFacts(String(workspaceId || ""), actorSubjectId),
    });
  }

  governanceAuditDecision(workspaceId, actorSubjectId) {
    return authorize({
      action: "audit.read",
      ...this.resolveWorkspaceAuthorizationFacts(String(workspaceId || ""), actorSubjectId),
    });
  }

  governanceManagementDecision(workspaceId, actorSubjectId) {
    return authorize({
      action: "workspace.governance.manage",
      ...this.resolveWorkspaceAuthorizationFacts(String(workspaceId || ""), actorSubjectId),
    });
  }

  workspaceDataPolicy(workspaceId) {
    const normalizedWorkspaceId = String(workspaceId || "");
    const workspaceRow = this.db.prepare("SELECT id FROM workspaces WHERE id=?").get(normalizedWorkspaceId);
    if (!workspaceRow) throw new Error("Workspace not found.");
    return dataPolicy(this.db.prepare("SELECT * FROM workspace_data_policies WHERE workspace_id=?").get(normalizedWorkspaceId), normalizedWorkspaceId);
  }

  setWorkspaceDataPolicyAuthorized(input = {}, actorSubjectId) {
    return this.transaction(() => {
      const workspaceId = String(input.workspaceId || "");
      const facts = this.resolveWorkspaceAuthorizationFacts(workspaceId, actorSubjectId);
      const decision = authorize({ action: "workspace.governance.manage", ...facts });
      if (!decision.allowed) {
        const error = new Error("AUTHORIZATION_DENIED");
        error.code = "AUTHORIZATION_DENIED";
        throw error;
      }
      const previous = this.workspaceDataPolicy(workspaceId);
      const classification = input.classification === undefined ? previous.classification : String(input.classification || "");
      if (!new Set(["internal", "confidential", "restricted"]).has(classification)) {
        throw new Error("Choose a supported workspace classification.");
      }
      let retentionReviewDays = previous.retentionReviewDays;
      if (Object.prototype.hasOwnProperty.call(input, "retentionReviewDays")) {
        if (input.retentionReviewDays === null || input.retentionReviewDays === "") retentionReviewDays = null;
        else {
          const value = Number(input.retentionReviewDays);
          if (!Number.isSafeInteger(value) || value < 1 || value > 3650) {
            throw new Error("Retention review must be between 1 and 3,650 days, or be cleared.");
          }
          retentionReviewDays = value;
        }
      }
      const legalHold = input.legalHold === undefined ? previous.legalHold : input.legalHold === true;
      const policyVersion = Math.max(1, previous.policyVersion + 1);
      const timestamp = nowIso();
      this.db.prepare(`INSERT INTO workspace_data_policies(
        workspace_id,classification,retention_review_days,legal_hold,policy_version,updated_by_subject_id,updated_at
      ) VALUES (?,?,?,?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET
        classification=excluded.classification,retention_review_days=excluded.retention_review_days,
        legal_hold=excluded.legal_hold,policy_version=excluded.policy_version,
        updated_by_subject_id=excluded.updated_by_subject_id,updated_at=excluded.updated_at
      `).run(workspaceId, classification, retentionReviewDays, legalHold ? 1 : 0, policyVersion, facts.subject.id, timestamp);
      this.insertAudit({
        organizationId: facts.organization.id, workspaceId, actorLabel: facts.subject.id,
        eventType: "workspace.policy.updated", summary: `Workspace policy set to ${classification}`,
        metadata: { classification, retentionReviewDays, legalHold, policyVersion }, occurredAt: timestamp,
      });
      return this.workspaceDataPolicy(workspaceId);
    });
  }

  upsertMemberForFixture(input = {}) {
    return this.upsertMember(input, { actorLabel: input.actorLabel || "Fixture setup", allowInputId: true });
  }

  upsertMemberAuthorized(input = {}, actorSubjectId) {
    return this.transaction(() => {
      const suppliedMember = input.id && this.db.prepare("SELECT workspace_id FROM workspace_members WHERE id=?").get(String(input.id));
      if (suppliedMember && suppliedMember.workspace_id !== String(input.workspaceId || "")) {
        const error = new Error("AUTHORIZATION_DENIED");
        error.code = "AUTHORIZATION_DENIED";
        throw error;
      }
      const workspaceId = String(input.workspaceId || "");
      const facts = this.resolveMemberManagementFacts(workspaceId, actorSubjectId);
      const decision = authorize({ action: "workspace.members.manage", ...facts });
      if (!decision.allowed) {
        const error = new Error("AUTHORIZATION_DENIED");
        error.code = "AUTHORIZATION_DENIED";
        throw error;
      }
      return this.upsertMember(input, { actorLabel: facts.subject.id, inTransaction: true });
    });
  }

  upsertMember(input = {}, options = {}) {
    const workspaceId = String(input.workspaceId || "");
    const workspaceRow = this.db.prepare("SELECT * FROM workspaces WHERE id=?").get(workspaceId);
    if (!workspaceRow) throw new Error("Workspace not found.");
    const displayName = text(input.displayName).slice(0, 120);
    if (!displayName) throw new Error("A member display name is required.");
    const email = text(input.email).toLowerCase().slice(0, 254) || null;
    const role = ["owner", "admin", "manager", "member", "guest", "auditor"].includes(input.role) ? input.role : "member";
    const status = ["active", "invited", "suspended"].includes(input.status) ? input.status : "active";
    const existing = email ? this.db.prepare("SELECT * FROM workspace_members WHERE workspace_id=? AND email=?").get(workspaceId, email) : null;
    const id = existing?.id || String(options.allowInputId && input.id || randomUUID());
    const timestamp = nowIso();
    const subjectId = input.subjectId ? String(input.subjectId) : null;
    const grantedCapabilities = Array.isArray(input.capabilities)
      ? [...new Set(input.capabilities.filter((entry) => typeof entry === "string" && CAPABILITY_ALLOWLIST.has(entry)))] : [];
    const write = () => {
      this.db.prepare("INSERT INTO workspace_members(id,workspace_id,display_name,email,subject_id,role,status,capabilities_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,email) DO UPDATE SET display_name=excluded.display_name,subject_id=excluded.subject_id,role=excluded.role,status=excluded.status,capabilities_json=excluded.capabilities_json,updated_at=excluded.updated_at")
        .run(id, workspaceId, displayName, email, subjectId, role, status, JSON.stringify(grantedCapabilities), existing?.created_at || timestamp, timestamp);
      this.insertAudit({ organizationId: workspaceRow.organization_id, workspaceId, eventType: existing ? "member.updated" : "member.added", actorLabel: options.actorLabel, summary: `${displayName} set as ${role}`, metadata: { memberId: id, status } });
    };
    if (options.inTransaction) write(); else this.transaction(write);
    return member(this.db.prepare("SELECT * FROM workspace_members WHERE id=?").get(id));
  }

  insertAudit(input = {}) {
    const id = String(input.id || randomUUID());
    this.db.prepare("INSERT INTO organization_audit_events(id,organization_id,workspace_id,event_type,actor_label,summary,metadata_json,occurred_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(id, String(input.organizationId || ""), input.workspaceId || null, text(input.eventType || "organization.changed").slice(0, 100), text(input.actorLabel || "Local owner").slice(0, 120), text(input.summary).slice(0, 500), JSON.stringify(input.metadata || {}), input.occurredAt || nowIso());
    return auditEvent(this.db.prepare("SELECT * FROM organization_audit_events WHERE id=?").get(id));
  }

  overview(id) {
    const selected = organization(this.db.prepare("SELECT * FROM organizations WHERE id=?").get(String(id || "")));
    if (!selected) return null;
    const workspaces = this.db.prepare("SELECT w.*,(SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id=w.id AND wm.status='active') member_count,(SELECT COUNT(*) FROM projects p WHERE p.workspace_id=w.id) project_count,(SELECT COUNT(*) FROM memories m WHERE m.workspace_id=w.id AND m.status='active') memory_count FROM workspaces w WHERE w.organization_id=? ORDER BY CASE w.kind WHEN 'team' THEN 0 WHEN 'executive' THEN 1 WHEN 'project' THEN 2 ELSE 3 END,w.name")
      .all(selected.id).map((row) => ({ ...workspace(row), dataPolicy: this.workspaceDataPolicy(row.id), memberCount: Number(row.member_count), projectCount: Number(row.project_count), memoryCount: Number(row.memory_count), members: this.db.prepare("SELECT * FROM workspace_members WHERE workspace_id=? ORDER BY role,display_name").all(row.id).map(member) }));
    const audit = this.db.prepare("SELECT * FROM organization_audit_events WHERE organization_id=? ORDER BY occurred_at DESC LIMIT 100").all(selected.id).map(auditEvent);
    return { organization: selected, workspaces, audit, totals: workspaces.reduce((total, item) => ({ workspaces: total.workspaces + 1, members: total.members + item.memberCount, projects: total.projects + item.projectCount, memories: total.memories + item.memoryCount }), { workspaces: 0, members: 0, projects: 0, memories: 0 }) };
  }
}

module.exports = { OrganizationRepository };
