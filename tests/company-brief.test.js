import assert from "node:assert/strict";
import test from "node:test";
import { buildCompanyBrief, companyBriefLenses } from "../src/lib/brace/company-brief.ts";

const overview = { organization: { id: "org-a" }, workspaces: [
  { id: "team", organizationId: "org-a", status: "active", visibility: "team", kind: "team" },
  { id: "private", organizationId: "org-a", status: "active", visibility: "personal", kind: "personal" },
  { id: "archived", organizationId: "org-a", status: "archived", visibility: "team", kind: "team" },
  { id: "foreign", organizationId: "org-b", status: "active", visibility: "organization", kind: "team" },
] };
const memory = (id, extra = {}) => ({ id, workspaceId: "team", kind: "decision", scope: "team", status: "active", title: id, summary: "Release decision", tags: [], updatedAt: "2026-09-01T00:00:00Z", redacted: false, ...extra });

test("company brief excludes private, foreign, archived, redacted and retired records", () => {
  const records = [memory("allowed"), memory("personal", { workspaceId: "private" }), memory("other", { workspaceId: "foreign" }), memory("archive", { workspaceId: "archived" }), memory("unassigned", { workspaceId: null }), memory("redacted", { redacted: true }), memory("forgotten", { status: "forgotten" }), memory("private-scope", { scope: "private" })];
  const result = buildCompanyBrief(overview, records, []);
  assert.deepEqual(result.records.map((record) => record.id), ["allowed"]);
  assert.equal(result.totals.memories, 1);
  assert.equal(buildCompanyBrief(overview, records, [], { workspaceId: "foreign" }).records.length, 0);
});

test("company brief filters real records and reports counts before pagination", () => {
  const records = [memory("older"), memory("newer", { updatedAt: "2026-09-02T00:00:00Z" }), memory("risk", { kind: "warning", title: "Missing release evidence" })];
  const result = buildCompanyBrief(overview, records, [], { filter: "decisions", query: "release", limit: 1 });
  assert.equal(result.totalMatches, 2);
  assert.equal(result.records[0].id, "newer");
  assert.equal(result.totals.warnings, 1);
  assert.deepEqual(buildCompanyBrief(overview, records, [], { filter: "warnings" }).records.map((record) => record.id), ["risk"]);
});

test("project attention is scoped and based on recorded indexing state", () => {
  const projects = [
    { id: "new", workspace_id: "team", last_indexed_at: null },
    { id: "healthy", workspace_id: "team", last_indexed_at: "2026-09-01" },
    { id: "failed", workspace_id: "team", last_indexed_at: "2026-09-01", watch: { error: { message: "Source unavailable" } } },
    { id: "private", workspace_id: "private", last_indexed_at: null },
  ];
  const result = buildCompanyBrief(overview, [], projects);
  assert.deepEqual(result.projectIssues.map((project) => project.id), ["new", "failed"]);
  assert.equal(result.totals.projects, 3);
});

test("company role lenses are local presentation content and do not alter scoped data", () => {
  assert.deepEqual(Object.keys(companyBriefLenses), ["employee", "manager", "executive", "administrator"]);
  assert.equal(companyBriefLenses.executive.headline, "What needs your attention?");
  assert.equal(companyBriefLenses.employee.action.filter, "recent");
  assert.equal(companyBriefLenses.manager.action.filter, "decisions");
  assert.equal(companyBriefLenses.executive.action.filter, "warnings");
  assert.equal(companyBriefLenses.administrator.action.view, "projects");
  const records = [memory("shared"), memory("private", { workspaceId: "private" })];
  assert.deepEqual(buildCompanyBrief(overview, records, []).records.map((record) => record.id), ["shared"]);
});
