"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { MemoryStore, SCHEMA_VERSION } = require("../core/memory-store");

function fixture(context, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-shared-"));
  const databasePath = path.join(directory, "brace.sqlite3");
  const store = new MemoryStore(databasePath, options);
  context.after(() => {
    try { store.close(); } catch {}
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  return { directory, databasePath, store };
}

function setup(store) {
  const owner = store.createAuthorizationSubjectForFixture({ id: "human-owner", verified: true });
  const member = store.createAuthorizationSubjectForFixture({ id: "human-member", verified: true });
  const guest = store.createAuthorizationSubjectForFixture({ id: "human-guest", verified: true });
  const service = store.createAuthorizationSubjectForFixture({ id: "service-bot", kind: "service", verified: true });
  const organization = store.createOrganization({ name: "Synthetic Publication Org" });
  const workspace = organization.workspaces.find((item) => item.name === "Company Brain");
  const otherWorkspace = organization.workspaces.find((item) => item.id !== workspace.id);
  for (const [subject, role, capabilities] of [
    [owner, "owner", []],
    [member, "member", []],
    [guest, "guest", []],
    [service, "owner", ["memory.publish", "memory.read"]],
  ]) {
    store.upsertWorkspaceMemberForFixture({
      workspaceId: workspace.id,
      subjectId: subject.id,
      displayName: subject.id,
      email: `${subject.id}@example.invalid`,
      role,
      capabilities,
    });
  }
  store.upsertWorkspaceMemberForFixture({
    workspaceId: otherWorkspace.id,
    subjectId: owner.id,
    displayName: owner.id,
    email: "owner-other@example.invalid",
    role: "owner",
  });
  const memory = store.createMemory({
    id: "personal-memory",
    kind: "decision",
    title: "Publish the safe projection",
    summary: "Only four fields cross the boundary.",
    content: "The synthetic public payload has no private provenance.",
    tags: ["PRIVATE_TAG_SENTINEL"],
    sourceUri: "private://ORIGIN_URI_SENTINEL",
    sourceExcerpt: "PRIVATE_EXCERPT_SENTINEL",
  }).memory;
  store.addEvidence(memory.id, {
    outcome: "observed",
    summary: "PRIVATE_EVIDENCE_SENTINEL",
    reference: "private://PRIVATE_EVIDENCE_REFERENCE",
  });
  store.bindMemoryOwnerForFixture(memory.id, owner.id);
  return { owner, member, guest, service, organization: organization.organization, workspace, otherWorkspace, memory };
}

function publish(store, facts) {
  const preview = store.previewSharedPublication({
    memoryId: facts.memory.id,
    workspaceId: facts.workspace.id,
    ownershipScope: "team",
  }, facts.owner.id);
  return { preview, publication: store.commitSharedPublication(preview.previewId, facts.owner.id) };
}

function expectCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code);
}

test("schema v11 keeps the additive publication migration and never backfills personal owners", (context) => {
  const { databasePath, store } = fixture(context);
  assert.equal(SCHEMA_VERSION, 11);
  assert.equal(store.stats().schemaVersion, 11);
  assert.ok(store.db.prepare("PRAGMA table_info(memories)").all().some((column) => column.name === "owner_subject_id"));
  assert.deepEqual(
    store.db.prepare("PRAGMA index_info(shared_publications_scope_status_idx)").all().map((column) => column.name),
    ["organization_id", "workspace_id", "status"],
  );
  const memory = store.createMemory({ id: "unowned-before-v8", title: "Unowned", content: "No owner is inferred." }).memory;
  store.close();

  const v7 = new DatabaseSync(databasePath);
  v7.exec(`
    DROP TABLE shared_memory_revisions;
    DROP TABLE shared_publications;
    ALTER TABLE memories DROP COLUMN owner_subject_id;
    PRAGMA user_version=7;
  `);
  v7.close();
  const migrated = new MemoryStore(databasePath);
  assert.equal(migrated.stats().schemaVersion, 11);
  assert.equal(migrated.getMemory(memory.id).ownerSubjectId, null);
  assert.equal(migrated.db.prepare("SELECT count(*) count FROM shared_publications").get().count, 0);
  migrated.close();
});

test("preview requires a verified active human owner and active publish/read destination membership", (context) => {
  const { store } = fixture(context);
  const facts = setup(store);
  const input = { memoryId: facts.memory.id, workspaceId: facts.workspace.id, ownershipScope: "team" };

  expectCode(() => store.previewSharedPublication(input, facts.member.id), "AUTHORIZATION_DENIED");
  expectCode(() => store.previewSharedPublication(input, facts.service.id), "AUTHORIZATION_DENIED");
  store.db.prepare("UPDATE authorization_subjects SET verified_at=NULL WHERE id=?").run(facts.owner.id);
  expectCode(() => store.previewSharedPublication(input, facts.owner.id), "AUTHORIZATION_DENIED");
  store.db.prepare("UPDATE authorization_subjects SET verified_at=? WHERE id=?").run(new Date().toISOString(), facts.owner.id);
  store.db.prepare("UPDATE workspace_members SET status='suspended' WHERE workspace_id=? AND subject_id=?").run(facts.workspace.id, facts.owner.id);
  expectCode(() => store.previewSharedPublication(input, facts.owner.id), "AUTHORIZATION_DENIED");
  store.db.prepare("UPDATE workspace_members SET status='active',role='member' WHERE workspace_id=? AND subject_id=?").run(facts.workspace.id, facts.owner.id);
  expectCode(() => store.previewSharedPublication(input, facts.owner.id), "AUTHORIZATION_DENIED");
  assert.equal(store.db.prepare("SELECT count(*) count FROM shared_publications").get().count, 0);
  assert.equal(store.db.prepare("SELECT count(*) count FROM organization_audit_events WHERE event_type LIKE 'memory.shared.%'").get().count, 0);
});

test("preview omits private metadata and commit creates an immutable canonical projection", (context) => {
  const { store } = fixture(context);
  const facts = setup(store);
  const { preview, publication } = publish(store, facts);
  const serializedPreview = JSON.stringify(preview);
  for (const sentinel of [facts.memory.id, "PRIVATE_TAG_SENTINEL", "ORIGIN_URI_SENTINEL", "PRIVATE_EXCERPT_SENTINEL", "PRIVATE_EVIDENCE_SENTINEL", "PRIVATE_EVIDENCE_REFERENCE"]) {
    assert.equal(serializedPreview.includes(sentinel), false);
  }
  assert.deepEqual(Object.keys(preview.projection), ["kind", "title", "summary", "content"]);
  assert.deepEqual(preview.disclosure.included, ["kind", "title", "summary", "content"]);
  assert.ok(preview.disclosure.omitted.includes("source metadata"));
  assert.match(preview.disclosure.localRetentionLimitation, /cannot retract copies/i);
  assert.match(publication.uri, new RegExp(`^brace-shared://${publication.id}/revisions/1$`));
  assert.equal(JSON.stringify(publication).includes(facts.memory.id), false);
  const revision = store.db.prepare("SELECT * FROM shared_memory_revisions WHERE publication_id=?").get(publication.id);
  assert.deepEqual(
    [revision.kind, revision.title, revision.summary, revision.content],
    [facts.memory.kind, facts.memory.title, facts.memory.summary, facts.memory.content],
  );
  const audit = store.db.prepare("SELECT * FROM organization_audit_events WHERE event_type='memory.shared.published'").get();
  assert.deepEqual(Object.keys(JSON.parse(audit.metadata_json)).sort(), ["ownershipScope", "publicationId", "revision"]);
  assert.equal(`${audit.summary}${audit.metadata_json}`.includes(facts.memory.title), false);
  assert.equal(`${audit.summary}${audit.metadata_json}`.includes(facts.memory.id), false);
  for (const sentinel of ["PRIVATE_TAG_SENTINEL", "ORIGIN_URI_SENTINEL", "PRIVATE_EXCERPT_SENTINEL", "PRIVATE_EVIDENCE_SENTINEL", "origin_memory_id"]) {
    assert.equal(`${audit.summary}${audit.metadata_json}`.includes(sentinel), false);
  }
});

test("an atomic SQL or audit failure rolls back without consuming the preview", (context) => {
  const { store } = fixture(context);
  const facts = setup(store);
  const preview = store.previewSharedPublication({ memoryId: facts.memory.id, workspaceId: facts.workspace.id, ownershipScope: "team" }, facts.owner.id);
  const originalInsertAudit = store.organizations.insertAudit;
  store.organizations.insertAudit = () => { throw new Error("synthetic audit failure"); };
  assert.throws(() => store.commitSharedPublication(preview.previewId, facts.owner.id), /synthetic audit failure/);
  assert.equal(store.db.prepare("SELECT count(*) count FROM shared_publications").get().count, 0);
  assert.equal(store.publicationPreviews.inspect(preview.previewId).state, "active");
  store.organizations.insertAudit = originalInsertAudit.bind(store.organizations);
  assert.equal(store.commitSharedPublication(preview.previewId, facts.owner.id).revision, 1);
  assert.equal(store.publicationPreviews.inspect(preview.previewId).state, "consumed");
});

test("preview replay, expiry, stale source, and optimistic revision races are rejected", (context) => {
  let now = Date.parse("2026-01-01T00:00:00.000Z");
  const { store } = fixture(context, { clock: () => now, publicationPreviewCacheOptions: { ttlMs: 1_000 } });
  const facts = setup(store);
  const first = store.previewSharedPublication({ memoryId: facts.memory.id, workspaceId: facts.workspace.id, ownershipScope: "team" }, facts.owner.id);
  const racing = store.previewSharedPublication({ memoryId: facts.memory.id, workspaceId: facts.workspace.id, ownershipScope: "team" }, facts.owner.id);
  store.commitSharedPublication(first.previewId, facts.owner.id);
  expectCode(() => store.commitSharedPublication(first.previewId, facts.owner.id), "PREVIEW_CONSUMED");
  expectCode(() => store.commitSharedPublication(racing.previewId, facts.owner.id), "PREVIEW_STALE");

  const stale = store.previewSharedPublication({ memoryId: facts.memory.id, workspaceId: facts.workspace.id, ownershipScope: "team" }, facts.owner.id);
  store.updateMemory(facts.memory.id, { content: "Changed personal content after preview." });
  expectCode(() => store.commitSharedPublication(stale.previewId, facts.owner.id), "PREVIEW_STALE");
  const unchangedProjection = store.listSharedMemories({ workspaceId: facts.workspace.id }, facts.owner.id)[0];
  assert.equal(unchangedProjection.content, "The synthetic public payload has no private provenance.");

  const expired = store.previewSharedPublication({ memoryId: facts.memory.id, workspaceId: facts.workspace.id, ownershipScope: "team" }, facts.owner.id);
  now += 1_001;
  expectCode(() => store.commitSharedPublication(expired.previewId, facts.owner.id), "PREVIEW_EXPIRED");
  store.db.prepare("UPDATE workspace_members SET status='suspended' WHERE workspace_id=? AND subject_id=?").run(facts.workspace.id, facts.owner.id);
  expectCode(() => store.commitSharedPublication(expired.previewId, facts.owner.id), "AUTHORIZATION_DENIED");
});

test("explicit republishing creates revisions while personal edits never mutate prior shared copies", (context) => {
  const { store } = fixture(context);
  const facts = setup(store);
  const initial = publish(store, facts).publication;
  store.updateMemory(facts.memory.id, { title: "Revised personal title", content: "Revised explicitly publishable payload." });
  assert.equal(store.getSharedMemory(initial.id, facts.owner.id).title, "Publish the safe projection");
  const preview = store.previewSharedPublication({ memoryId: facts.memory.id, workspaceId: facts.workspace.id, ownershipScope: "team" }, facts.owner.id);
  const revision = store.commitSharedPublication(preview.previewId, facts.owner.id);
  assert.equal(revision.id, initial.id);
  assert.equal(revision.revision, 2);
  assert.equal(revision.title, "Revised personal title");
  const rows = store.db.prepare("SELECT revision,title FROM shared_memory_revisions WHERE publication_id=? ORDER BY revision").all(initial.id);
  assert.deepEqual(rows.map((row) => [row.revision, row.title]), [[1, "Publish the safe projection"], [2, "Revised personal title"]]);
});

test("revocation requires delete/read, checks revision, revokes the whole publication, and forbids republish", (context) => {
  const { store } = fixture(context);
  const facts = setup(store);
  const publication = publish(store, facts).publication;
  expectCode(() => store.revokeSharedPublication({ publicationId: publication.id, expectedRevision: 1 }, facts.member.id), "AUTHORIZATION_DENIED");
  expectCode(() => store.revokeSharedPublication({ publicationId: publication.id, expectedRevision: 2 }, facts.owner.id), "REVISION_STALE");
  assert.equal(store.db.prepare("SELECT status FROM shared_publications WHERE id=?").get(publication.id).status, "active");
  const revoked = store.revokeSharedPublication({ publicationId: publication.id, expectedRevision: 1 }, facts.owner.id);
  assert.equal(revoked.status, "revoked");
  assert.equal(store.getSharedMemory(publication.id, facts.owner.id), null);
  assert.deepEqual(store.listSharedMemories({ workspaceId: facts.workspace.id }, facts.owner.id), []);
  assert.equal(store.db.prepare("SELECT count(*) count FROM shared_memory_revisions WHERE publication_id=?").get(publication.id).count, 1);
  expectCode(() => store.previewSharedPublication({ memoryId: facts.memory.id, workspaceId: facts.workspace.id, ownershipScope: "team" }, facts.owner.id), "PUBLICATION_REVOKED");
});

test("all shared read APIs authorize and isolate projections from personal and foreign-workspace sentinels", (context) => {
  const { store } = fixture(context);
  const facts = setup(store);
  const publication = publish(store, facts).publication;
  store.createMemory({ title: "PERSONAL_TITLE_LEAK", content: "PERSONAL_CONTENT_LEAK" });
  const foreignMemory = store.createMemory({ title: "Foreign projection", content: "FOREIGN_WORKSPACE_LEAK" }).memory;
  store.bindMemoryOwnerForFixture(foreignMemory.id, facts.owner.id);
  const foreignPreview = store.previewSharedPublication({ memoryId: foreignMemory.id, workspaceId: facts.otherWorkspace.id, ownershipScope: "team" }, facts.owner.id);
  store.commitSharedPublication(foreignPreview.previewId, facts.owner.id);

  const outputs = [
    store.getSharedMemory(publication.id, facts.member.id),
    store.listSharedMemories({ workspaceId: facts.workspace.id }, facts.member.id),
    store.searchSharedMemories("projection", { workspaceId: facts.workspace.id }, facts.member.id),
    store.getSharedMemoryGraph({ workspaceId: facts.workspace.id }, facts.member.id),
    store.previewSharedContext({ workspaceId: facts.workspace.id, query: "projection" }, facts.member.id),
    store.exportSharedProjection({ workspaceId: facts.workspace.id }, facts.owner.id),
  ];
  assert.equal(outputs[2].mode, "lexical");
  assert.deepEqual(outputs[3].edges, []);
  assert.ok(outputs[3].nodes.every((node) => node.type === "shared-publication"));
  const serialized = JSON.stringify(outputs);
  for (const sentinel of [
    "PERSONAL_TITLE_LEAK", "PERSONAL_CONTENT_LEAK", "FOREIGN_WORKSPACE_LEAK",
    facts.memory.id, "originMemoryId", "origin_memory_id", "ownerSubjectId",
    "PRIVATE_TAG_SENTINEL", "ORIGIN_URI_SENTINEL", "PRIVATE_EXCERPT_SENTINEL",
    "PRIVATE_EVIDENCE_SENTINEL", "PRIVATE_EVIDENCE_REFERENCE",
  ]) {
    assert.equal(serialized.includes(sentinel), false);
  }
  expectCode(() => store.exportSharedProjection({ workspaceId: facts.workspace.id }, facts.member.id), "AUTHORIZATION_DENIED");
  expectCode(() => store.previewSharedContext({ workspaceId: facts.workspace.id }, facts.guest.id), "AUTHORIZATION_DENIED");
  expectCode(() => store.listSharedMemories({ workspaceId: facts.otherWorkspace.id }, facts.member.id), "AUTHORIZATION_DENIED");
});

test("legacy workspace_id memories cannot be published and denials expose only non-enumerable diagnostics", (context) => {
  const { store } = fixture(context);
  const facts = setup(store);
  const legacy = store.createMemory({ workspaceId: facts.workspace.id, title: "Legacy governed row", content: "A workspace id is not publication." }).memory;
  assert.throws(() => store.bindMemoryOwnerForFixture(legacy.id, facts.owner.id), /Only personal memories/);
  let denied;
  try {
    store.previewSharedPublication({ memoryId: legacy.id, workspaceId: facts.workspace.id, ownershipScope: "team" }, facts.owner.id);
  } catch (error) {
    denied = error;
  }
  assert.equal(denied.code, "AUTHORIZATION_DENIED");
  assert.equal(Object.prototype.propertyIsEnumerable.call(denied, "details"), false);
  assert.equal(JSON.stringify(denied).includes("personal_owner"), false);
  assert.equal(store.db.prepare("SELECT count(*) count FROM shared_publications").get().count, 0);
  assert.deepEqual(store.listSharedMemories({ workspaceId: facts.workspace.id }, facts.owner.id), []);
});
