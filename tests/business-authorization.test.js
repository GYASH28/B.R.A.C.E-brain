"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ACTION_CAPABILITIES, authorize } = require("../core/business-authorization");

function businessRequest(overrides = {}) {
  return {
    action: "memory.read",
    subject: { id: "human-alex", kind: "human", verified: true, status: "active" },
    organization: { id: "org-northstar", status: "active" },
    workspace: { id: "workspace-research", organizationId: "org-northstar", status: "active" },
    membership: {
      id: "membership-alex-research",
      subjectId: "human-alex",
      organizationId: "org-northstar",
      workspaceId: "workspace-research",
      status: "active",
      role: "member",
    },
    resource: {
      id: "memory-roadmap",
      organizationId: "org-northstar",
      workspaceId: "workspace-research",
      scope: "team",
    },
    ...overrides,
  };
}

test("active workspace members receive only their current role capabilities", () => {
  assert.equal(authorize(businessRequest()).allowed, true);

  const memberExport = authorize(businessRequest({ action: "export.create" }));
  assert.equal(memberExport.allowed, false);
  assert.equal(memberExport.code, "capability_missing");
  assert.equal(memberExport.capability, ACTION_CAPABILITIES["export.create"]);

  const promoted = businessRequest({ action: "export.create" });
  promoted.membership = { ...promoted.membership, role: "manager" };
  assert.equal(authorize(promoted).allowed, true);

  promoted.membership = { ...promoted.membership, status: "suspended" };
  assert.equal(authorize(promoted).code, "membership_inactive");
});

test("foreign organization, workspace, and membership boundaries deny immediately", () => {
  const foreignOrganization = businessRequest();
  foreignOrganization.resource = { ...foreignOrganization.resource, organizationId: "org-foreign" };
  assert.equal(authorize(foreignOrganization).code, "resource_organization_mismatch");

  const foreignWorkspace = businessRequest();
  foreignWorkspace.resource = { ...foreignWorkspace.resource, workspaceId: "workspace-finance" };
  assert.equal(authorize(foreignWorkspace).code, "resource_workspace_mismatch");

  const foreignMembership = businessRequest();
  foreignMembership.membership = { ...foreignMembership.membership, workspaceId: "workspace-finance" };
  assert.equal(authorize(foreignMembership).code, "membership_workspace_mismatch");

  const archivedWorkspace = businessRequest();
  archivedWorkspace.workspace = { ...archivedWorkspace.workspace, status: "archived" };
  assert.equal(authorize(archivedWorkspace).code, "workspace_inactive");

  const invitedMember = businessRequest();
  invitedMember.membership = { ...invitedMember.membership, status: "invited" };
  assert.equal(authorize(invitedMember).code, "membership_inactive");

  const foreignMemberOrganization = businessRequest();
  foreignMemberOrganization.membership = { ...foreignMemberOrganization.membership, organizationId: "org-foreign" };
  assert.equal(authorize(foreignMemberOrganization).code, "membership_organization_mismatch");
});

test("organization-scoped resources still require an exact active workspace membership", () => {
  const organizationResource = businessRequest({
    resource: {
      id: "organization-handbook",
      organizationId: "org-northstar",
      workspaceId: "workspace-research",
      scope: "organization",
    },
  });
  assert.equal(authorize(organizationResource).allowed, true);

  assert.equal(authorize({ ...organizationResource, organization: undefined }).code, "missing_organization");
  assert.equal(authorize({ ...organizationResource, workspace: undefined }).code, "missing_workspace");
});

test("personal resources remain owner-only and outside role inheritance", () => {
  const personal = businessRequest({
    action: "ai.context",
    organization: undefined,
    workspace: undefined,
    membership: undefined,
    resource: { id: "private-preference", scope: "personal", ownerSubjectId: "human-alex" },
  });
  assert.equal(authorize(personal).code, "personal_owner");
  assert.equal(authorize({ ...personal, action: "graph.read" }).allowed, true);
  assert.equal(authorize({ ...personal, action: "export.create" }).allowed, true);

  const otherHuman = { ...personal, subject: { ...personal.subject, id: "human-riley" } };
  assert.equal(authorize(otherHuman).code, "personal_owner_mismatch");

  const administrator = businessRequest({
    action: "memory.read",
    resource: { id: "private-preference", scope: "personal", ownerSubjectId: "human-riley" },
  });
  administrator.membership = { ...administrator.membership, role: "admin" };
  assert.equal(authorize(administrator).code, "personal_owner_mismatch");
});

test("service agents receive explicit grants only, regardless of role", () => {
  const service = businessRequest({
    action: "ai.context",
    subject: { id: "service-summary", kind: "service", verified: true, status: "active" },
  });
  service.membership = {
    ...service.membership,
    subjectId: "service-summary",
    role: "owner",
    capabilities: ["ai.context"],
  };

  assert.equal(authorize(service).code, "service_explicit_grant");
  assert.equal(authorize({ ...service, action: "export.create" }).code, "service_capability_missing");
  assert.equal(authorize({ ...service, action: "graph.read" }).code, "service_capability_missing");

  const personal = {
    ...service,
    action: "memory.read",
    resource: { id: "private-note", scope: "personal", ownerSubjectId: "service-summary" },
  };
  assert.equal(authorize(personal).code, "personal_service_denied");
});

test("sensitive graph, AI, export, and governance actions are explicit", () => {
  const guest = businessRequest();
  guest.membership = { ...guest.membership, role: "guest" };
  assert.equal(authorize({ ...guest, action: "graph.read" }).allowed, true);
  assert.equal(authorize({ ...guest, action: "ai.context" }).code, "capability_missing");
  assert.equal(authorize({ ...guest, action: "export.create" }).code, "capability_missing");

  const auditor = businessRequest();
  auditor.membership = { ...auditor.membership, role: "auditor" };
  assert.equal(authorize({ ...auditor, action: "audit.read" }).allowed, true);
  assert.equal(authorize({ ...auditor, action: "organization.manage" }).code, "capability_missing");
});

test("missing facts, inactive identities, and unknown actions deny by default", () => {
  assert.equal(authorize(businessRequest({ action: undefined })).code, "missing_action");
  assert.equal(authorize(businessRequest({ action: "memory.teleport" })).code, "unknown_action");
  assert.equal(authorize(businessRequest({ subject: undefined })).code, "missing_subject");
  assert.equal(authorize(businessRequest({ resource: undefined })).code, "missing_resource");
  assert.equal(authorize(businessRequest({ membership: undefined })).code, "missing_membership");

  const unverified = businessRequest();
  unverified.subject = { ...unverified.subject, verified: false };
  assert.equal(authorize(unverified).code, "subject_unverified");

  const inactive = businessRequest();
  inactive.subject = { ...inactive.subject, status: "suspended" };
  assert.equal(authorize(inactive).code, "subject_inactive");
});

test("a known resource id is never accepted without resolved scope facts", () => {
  const unresolved = businessRequest({ resource: { id: "memory-roadmap" } });
  const result = authorize(unresolved);
  assert.equal(result.allowed, false);
  assert.equal(result.code, "missing_resource_scope");
  assert.equal(result.resourceId, "memory-roadmap");
  assert.equal(Object.isFrozen(result), true);
});
