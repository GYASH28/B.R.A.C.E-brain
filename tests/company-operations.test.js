import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildCompanyOperations } from "../src/lib/brace/company-operations.ts";

const overview = { organization: { id: "org" }, workspaces: [
  { id: "shared", organizationId: "org", name: "Shared", status: "active", visibility: "team", kind: "team", members: [{ id: "one", subjectId: null, displayName: "Avery", email: "a@example.invalid", role: "owner" }, { id: "two", subjectId: null, displayName: "Avery", email: "a@example.invalid", role: "manager" }] },
  { id: "personal", organizationId: "org", name: "Personal", status: "active", visibility: "personal", kind: "personal", members: [{ id: "private", subjectId: null, displayName: "Private", email: null, role: "member" }] },
  { id: "foreign", organizationId: "other", name: "Foreign", status: "active", visibility: "team", kind: "team", members: [] },
], audit: [{ id: "audit-shared", workspaceId: "shared", summary: "Shared event", occurredAt: "2026-09-01" }, { id: "audit-private", workspaceId: "personal", summary: "Private event", occurredAt: "2026-09-01" }], totals: {} };
const memory = (id, extra = {}) => ({ id, workspaceId: "shared", kind: "decision", scope: "team", status: "active", title: id, confidence: .8, sourceUri: null, updatedAt: "2026-09-01", redacted: false, ...extra });
const snapshot = (memories) => ({ memories, projects: [{ id: "project", workspace_id: "shared", name: "Project", last_indexed_at: null }], timeline: [], graph: { nodes: [{ id: "source", type: "source", projectId: "project" }], edges: [] }, businessAuthorization: { memberManagementByWorkspace: {} } });

test("company operations excludes unscoped, private, foreign, redacted and forgotten snapshot records", () => {
  const model = buildCompanyOperations(overview, snapshot([memory("allowed"), memory("unscoped", { workspaceId: null }), memory("private", { workspaceId: "personal" }), memory("foreign", { workspaceId: "foreign" }), memory("redacted", { redacted: true }), memory("forgotten", { status: "forgotten" }), memory("private-scope", { scope: "private" })]));
  assert.deepEqual(model.decisions.map((item) => item.id), ["allowed"]);
  assert.deepEqual(model.governance.auditEvents.map((item) => item.id), ["audit-shared"]);
});

test("company operations dedupes local people and presents missing indexing and sources honestly", () => {
  const model = buildCompanyOperations(overview, snapshot([memory("allowed", { scope: "project:project" })]));
  assert.equal(model.people.length, 1);
  assert.deepEqual(model.people[0].roles, ["owner", "manager"]);
  assert.equal(model.people[0].hasSubjectBinding, false);
  assert.deepEqual(model.projects[0], { id: "project", name: "Project", workspaceName: "Shared", lastIndexedAt: null, freshness: "not indexed", memoryCount: 1, sourceCount: 1 });
});

test("company operations UI exposes the four keyboard tabs and local identity boundary", async () => {
  const source = await readFile(new URL("../src/components/brace/organization/company-operations.tsx", import.meta.url), "utf8");
  for (const label of ["Project hub", "People & teams", "Decision room", "Governance"]) assert.match(source, new RegExp(label));
  assert.match(source, /role="tablist"/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /tabRefs\.current.*focus/);
  assert.match(source, /openGraphNode\(decision\.id\)/);
  assert.match(source, /not proof of a currently authenticated identity/);
});
