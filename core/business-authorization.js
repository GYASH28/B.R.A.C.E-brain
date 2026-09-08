"use strict";

// This module is intentionally independent of storage and transport. Callers must
// resolve fresh identity, membership, workspace, and resource facts before every
// protected operation; an identifier by itself is never authorization evidence.

const ACTION_CAPABILITIES = Object.freeze({
  "source.ingest": "source.ingest",
  "memory.read": "memory.read",
  "memory.write": "memory.write",
  "memory.delete": "memory.delete",
  "memory.publish": "memory.publish",
  "search.query": "search.query",
  "graph.read": "graph.read",
  "ai.context": "ai.context",
  "export.create": "export.create",
  "audit.read": "audit.read",
  "workspace.governance.manage": "workspace.governance.manage",
  "workspace.members.manage": "workspace.members.manage",
  "organization.manage": "organization.manage",
  "connector.read": "connector.read",
  "connector.write": "connector.write",
  "automation.execute": "automation.execute",
  "sync.transfer": "sync.transfer",
  "approval.request": "approval.request",
  "approval.decide": "approval.decide",
  "approval.consume": "approval.consume",
});

const ALL_CAPABILITIES = Object.freeze([...new Set(Object.values(ACTION_CAPABILITIES))]);

const ROLE_CAPABILITIES = Object.freeze({
  owner: ALL_CAPABILITIES,
  admin: ALL_CAPABILITIES,
  administrator: ALL_CAPABILITIES,
  manager: Object.freeze([
    "source.ingest", "memory.read", "memory.write", "memory.publish",
    "search.query", "graph.read", "ai.context", "export.create",
    "connector.read", "connector.write", "automation.execute",
    "approval.decide",
  ]),
  member: Object.freeze([
    "source.ingest", "memory.read", "memory.write", "search.query",
    "graph.read", "ai.context", "connector.read", "automation.execute",
  ]),
  guest: Object.freeze(["memory.read", "search.query", "graph.read"]),
  auditor: Object.freeze([
    "memory.read", "search.query", "graph.read", "export.create", "audit.read",
  ]),
  "service-agent": Object.freeze([]),
});

const PERSONAL_CAPABILITIES = new Set([
  "source.ingest", "memory.read", "memory.write", "memory.delete",
  "memory.publish", "search.query", "graph.read", "ai.context",
  "export.create", "connector.read", "connector.write", "automation.execute",
]);

function identifier(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decision(input, allowed, code, reason, capability = null) {
  return Object.freeze({
    allowed,
    decision: allowed ? "allow" : "deny",
    code,
    reason,
    action: identifier(input?.action),
    capability,
    subjectId: identifier(input?.subject?.id),
    organizationId: identifier(input?.organization?.id),
    workspaceId: identifier(input?.workspace?.id),
    resourceId: identifier(input?.resource?.id),
  });
}

function deny(input, code, reason, capability) {
  return decision(input, false, code, reason, capability);
}

function allow(input, code, reason, capability) {
  return decision(input, true, code, reason, capability);
}

function authorize(input = {}) {
  const action = identifier(input.action);
  if (!action) return deny(input, "missing_action", "A protected action is required.");

  const capability = ACTION_CAPABILITIES[action];
  if (!capability) return deny(input, "unknown_action", "The requested action has no authorization policy.");

  const subject = input.subject;
  const subjectId = identifier(subject?.id);
  if (!subjectId) return deny(input, "missing_subject", "A verified authorization subject is required.", capability);
  if (subject?.kind !== "human" && subject?.kind !== "service") {
    return deny(input, "invalid_subject_kind", "The authorization subject must be a human or service identity.", capability);
  }
  if (subject.verified !== true) {
    return deny(input, "subject_unverified", "The authorization subject is not verified.", capability);
  }
  if (subject.status !== "active") {
    return deny(input, "subject_inactive", "The authorization subject is not active.", capability);
  }

  const resource = input.resource;
  if (!resource || !identifier(resource.id)) {
    return deny(input, "missing_resource", "A resolved resource is required; an action cannot be authorized from an identifier alone.", capability);
  }
  if (!identifier(resource.scope)) {
    return deny(input, "missing_resource_scope", "The resource ownership scope is required.", capability);
  }
  if (!["personal", "team", "organization"].includes(resource.scope)) {
    return deny(input, "invalid_resource_scope", "The resource ownership scope is not recognized.", capability);
  }

  if (resource.scope === "personal") {
    if (subject.kind !== "human") {
      return deny(input, "personal_service_denied", "Service identities cannot access personal resources.", capability);
    }
    if (!identifier(resource.ownerSubjectId) || resource.ownerSubjectId !== subjectId) {
      return deny(input, "personal_owner_mismatch", "Personal resources are available only to their verified human owner.", capability);
    }
    if (!PERSONAL_CAPABILITIES.has(capability)) {
      return deny(input, "personal_action_denied", "Business governance actions do not apply to a personal resource.", capability);
    }
    return allow(input, "personal_owner", "The verified human owns this personal resource.", capability);
  }

  const organization = input.organization;
  const organizationId = identifier(organization?.id);
  if (!organizationId) return deny(input, "missing_organization", "An organization boundary is required.", capability);
  if (organization.status !== "active") {
    return deny(input, "organization_inactive", "The organization is not active.", capability);
  }

  const workspace = input.workspace;
  const workspaceId = identifier(workspace?.id);
  if (!workspaceId) return deny(input, "missing_workspace", "An active workspace boundary is required.", capability);
  if (workspace.status !== "active") {
    return deny(input, "workspace_inactive", "The workspace is not active.", capability);
  }
  if (identifier(workspace.organizationId) !== organizationId) {
    return deny(input, "workspace_organization_mismatch", "The workspace is outside the requested organization.", capability);
  }
  if (identifier(resource.organizationId) !== organizationId) {
    return deny(input, "resource_organization_mismatch", "The resource is outside the requested organization.", capability);
  }
  if (identifier(resource.workspaceId) !== workspaceId) {
    return deny(input, "resource_workspace_mismatch", "The resource is outside the requested workspace.", capability);
  }

  const membership = input.membership;
  if (!membership || !identifier(membership.id)) {
    return deny(input, "missing_membership", "An active workspace membership is required.", capability);
  }
  if (membership.status !== "active") {
    return deny(input, "membership_inactive", "The workspace membership is not active.", capability);
  }
  if (identifier(membership.subjectId) !== subjectId) {
    return deny(input, "membership_subject_mismatch", "The membership belongs to a different subject.", capability);
  }
  if (identifier(membership.organizationId) !== organizationId) {
    return deny(input, "membership_organization_mismatch", "The membership belongs to a different organization.", capability);
  }
  if (identifier(membership.workspaceId) !== workspaceId) {
    return deny(input, "membership_workspace_mismatch", "The membership belongs to a different workspace.", capability);
  }

  const explicitCapabilities = new Set(Array.isArray(membership.capabilities)
    ? membership.capabilities.filter((entry) => typeof entry === "string")
    : []);

  if (subject.kind === "service") {
    if (!explicitCapabilities.has(capability)) {
      return deny(input, "service_capability_missing", "The service identity has no explicit grant for this action.", capability);
    }
    return allow(input, "service_explicit_grant", "The active service identity has an explicit workspace grant.", capability);
  }

  const roleCapabilities = ROLE_CAPABILITIES[membership.role] || [];
  if (!roleCapabilities.includes(capability) && !explicitCapabilities.has(capability)) {
    return deny(input, "capability_missing", "The active membership does not grant the required capability.", capability);
  }
  return allow(input, "role_or_explicit_grant", "The active membership grants the required capability.", capability);
}

module.exports = { ACTION_CAPABILITIES, ROLE_CAPABILITIES, authorize };
