"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { decryptSyncPayload, encryptSyncPayload } = require("../core/company-sync-crypto");
const { MemoryStore, SCHEMA_VERSION } = require("../core/memory-store");

const NOW = Date.parse("2026-09-07T12:00:00.000Z");
const WORKSPACE_KEY = Buffer.from("0123456789abcdef0123456789abcdef");
const KEY_REFERENCE = "fixture-keystore://company-key-1";
const KEY_ID = "company-key-v1";

function expectCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code);
}

function createStore(context, label, clock = () => NOW) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `brace-sync-${label}-`));
  const databasePath = path.join(directory, "brace.sqlite3");
  const keyProvider = {
    resolveKey(reference) {
      if (reference !== KEY_REFERENCE) throw new Error("unknown fixture key");
      return Buffer.from(WORKSPACE_KEY);
    },
  };
  const store = new MemoryStore(databasePath, { companySyncKeyProvider: keyProvider, clock });
  context.after(() => {
    try { store.close(); } catch {}
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  return { directory, databasePath, store };
}

function prepareReplica(store, suffix = "") {
  const organizationId = `sync-org${suffix}`;
  const workspaceId = `sync-workspace${suffix}`;
  const ownerId = `sync-owner${suffix}`;
  const transportId = `sync-transport${suffix}`;
  store.createOrganization({ id: organizationId, name: `Synthetic Sync Org ${suffix || "Primary"}` });
  store.createWorkspace({ id: workspaceId, organizationId, name: "Shared Operations", kind: "project", visibility: "team" });
  store.createAuthorizationSubjectForFixture({ id: ownerId, issuer: "fixture-sync", verified: true });
  store.createAuthorizationSubjectForFixture({ id: transportId, issuer: "fixture-sync", kind: "service", verified: true });
  store.upsertWorkspaceMemberForFixture({
    workspaceId, subjectId: ownerId, displayName: "Synthetic Owner", email: `${ownerId}@example.invalid`, role: "owner",
  });
  store.upsertWorkspaceMemberForFixture({
    workspaceId, subjectId: transportId, displayName: "Synthetic Transport", email: `${transportId}@example.invalid`,
    role: "member", capabilities: ["sync.transfer"],
  });
  store.configureCompanySyncWorkspaceForFixture({
    workspaceId,
    keyReference: KEY_REFERENCE,
    keyId: KEY_ID,
    leaseExpiresAt: new Date(NOW + 86_400_000).toISOString(),
    offlineAllowed: true,
  });
  store.registerCompanySyncDeviceForFixture({
    id: `source-device${suffix}`,
    workspaceId,
    subjectId: ownerId,
    label: "Synthetic source device",
  });
  return { organizationId, workspaceId, ownerId, transportId, deviceId: `source-device${suffix}` };
}

function createPublishedMemory(store, facts) {
  const memory = store.createMemory({
    id: "sync-personal-memory",
    kind: "decision",
    title: "Encrypted company direction",
    summary: "Only the approved projection may enter synchronization.",
    content: "CIPHERTEXT_ONLY_SENTINEL must never appear in the sync operation table as plaintext.",
    tags: ["PRIVATE_SYNC_TAG_SENTINEL"],
    sourceUri: "private://SYNC_SOURCE_SENTINEL",
  }).memory;
  store.bindMemoryOwnerForFixture(memory.id, facts.ownerId);
  const preview = store.previewSharedPublication({
    memoryId: memory.id,
    workspaceId: facts.workspaceId,
    ownershipScope: "team",
  }, facts.ownerId);
  const publication = store.commitSharedPublication(preview.previewId, facts.ownerId);
  return { memory, publication };
}

function cloneEnvelope(value) { return JSON.parse(JSON.stringify(value)); }

test("AES-GCM sync envelopes bind ciphertext to exact tenant and revision metadata", () => {
  const metadata = {
    operationId: "operation-crypto",
    organizationId: "organization-a",
    workspaceId: "workspace-a",
    actorSubjectId: "subject-a",
    deviceId: "device-a",
    recordType: "shared-memory",
    recordId: "record-a",
    operationKind: "upsert",
    baseRevision: 0,
    resultRevision: 1,
    keyId: KEY_ID,
    createdAt: new Date(NOW).toISOString(),
  };
  const payload = { schemaVersion: 1, value: "Encrypted fixture" };
  const encrypted = encryptSyncPayload(payload, metadata, WORKSPACE_KEY);
  const envelope = {
    ...metadata,
    nonce: encrypted.nonce.toString("base64"),
    ciphertext: encrypted.ciphertext.toString("base64"),
    authTag: encrypted.authTag.toString("base64"),
    payloadHash: encrypted.payloadHash,
  };
  assert.deepEqual(decryptSyncPayload(envelope, WORKSPACE_KEY), payload);
  expectCode(() => decryptSyncPayload({ ...envelope, workspaceId: "workspace-b" }, WORKSPACE_KEY), "SYNC_DECRYPT_FAILED");
  expectCode(() => decryptSyncPayload({ ...envelope, resultRevision: 2 }, WORKSPACE_KEY), "SYNC_ENVELOPE_INVALID");
  expectCode(() => decryptSyncPayload(envelope, Buffer.alloc(32, 7)), "SYNC_DECRYPT_FAILED");
});

test("only authorized shared projections enter a ciphertext-only outbox with bounded acknowledgement", (context) => {
  const { databasePath, store } = createStore(context, "outbox");
  const facts = prepareReplica(store);
  const { memory, publication } = createPublishedMemory(store, facts);
  const operation = store.enqueueCompanySyncPublication({
    publicationId: publication.id,
    expectedRevision: publication.revision,
    deviceId: facts.deviceId,
    operationId: "outbox-operation-1",
  }, facts.ownerId);
  assert.equal(operation.status, "pending");
  assert.equal(store.stats().syncPendingOperations, 1);
  const row = store.db.prepare("SELECT * FROM company_sync_operations WHERE id=?").get(operation.id);
  assert.equal(Buffer.from(row.payload_ciphertext).includes(Buffer.from("CIPHERTEXT_ONLY_SENTINEL")), false);
  assert.equal(JSON.stringify(row).includes("PRIVATE_SYNC_TAG_SENTINEL"), false);
  assert.equal(JSON.stringify(row).includes("SYNC_SOURCE_SENTINEL"), false);
  assert.equal(fs.readFileSync(databasePath).includes(WORKSPACE_KEY), false);
  assert.equal(store.db.prepare("SELECT key_reference FROM company_sync_workspaces WHERE workspace_id=?").get(facts.workspaceId).key_reference, KEY_REFERENCE);

  const envelope = store.listCompanySyncOutbox({ workspaceId: facts.workspaceId }, facts.ownerId)[0];
  assert.equal(envelope.id, operation.id);
  assert.equal(Object.hasOwn(envelope, "projection"), false);
  assert.equal(Object.hasOwn(envelope, "content"), false);
  const member = store.createAuthorizationSubjectForFixture({ id: "ordinary-member", issuer: "fixture-sync", verified: true });
  store.upsertWorkspaceMemberForFixture({ workspaceId: facts.workspaceId, subjectId: member.id, displayName: "Member", email: "ordinary@example.invalid", role: "member" });
  expectCode(() => store.listCompanySyncOutbox({ workspaceId: facts.workspaceId }, member.id), "AUTHORIZATION_DENIED");
  expectCode(() => store.enqueueCompanySyncPublication({
    publicationId: memory.id, expectedRevision: 1, deviceId: facts.deviceId,
  }, facts.ownerId), "SYNC_PUBLICATION_NOT_FOUND");
  expectCode(() => store.enqueueCompanySyncPublication({
    publicationId: publication.id, expectedRevision: 1, deviceId: facts.deviceId, operationId: operation.id,
  }, facts.ownerId), "SYNC_OPERATION_REPLAYED");

  const acknowledged = store.acknowledgeCompanySyncOutbox({ operationId: operation.id, remoteSequence: 41 }, facts.ownerId);
  assert.equal(acknowledged.status, "acknowledged");
  assert.equal(acknowledged.remoteSequence, 41);
  assert.equal(store.stats().syncPendingOperations, 0);
});

test("replicas deny tenant crossing, reject tampering, reconcile reorder, and propagate tombstones", (context) => {
  const source = createStore(context, "source").store;
  const target = createStore(context, "target").store;
  const sourceFacts = prepareReplica(source);
  const targetFacts = prepareReplica(target);
  const { memory, publication } = createPublishedMemory(source, sourceFacts);
  const first = source.enqueueCompanySyncPublication({
    publicationId: publication.id, expectedRevision: 1, deviceId: sourceFacts.deviceId, operationId: "revision-one",
  }, sourceFacts.ownerId);
  source.updateMemory(memory.id, { title: "Encrypted company direction — revised", content: "The second approved revision." });
  const secondPreview = source.previewSharedPublication({ memoryId: memory.id, workspaceId: sourceFacts.workspaceId, ownershipScope: "team" }, sourceFacts.ownerId);
  const secondPublication = source.commitSharedPublication(secondPreview.previewId, sourceFacts.ownerId);
  source.enqueueCompanySyncPublication({
    publicationId: publication.id, expectedRevision: 2, deviceId: sourceFacts.deviceId, operationId: "revision-two",
  }, sourceFacts.ownerId);
  const envelopes = source.listCompanySyncOutbox({ workspaceId: sourceFacts.workspaceId }, sourceFacts.ownerId);
  const envelopeOne = envelopes.find((item) => item.id === first.id);
  const envelopeTwo = envelopes.find((item) => item.id === "revision-two");

  const foreign = prepareReplica(target, "-foreign");
  expectCode(() => target.receiveCompanySyncEnvelope({ ...envelopeOne, workspaceId: foreign.workspaceId, organizationId: foreign.organizationId }, foreign.transportId), "SYNC_DEVICE_DENIED");
  const tampered = cloneEnvelope(envelopeOne);
  const bytes = Buffer.from(tampered.ciphertext, "base64");
  bytes[0] ^= 1;
  tampered.ciphertext = bytes.toString("base64");
  expectCode(() => target.receiveCompanySyncEnvelope(tampered, targetFacts.transportId), "SYNC_ENVELOPE_INVALID");
  const forgedHash = cloneEnvelope(tampered);
  forgedHash.payloadHash = createHash("sha256").update(Buffer.from(forgedHash.ciphertext, "base64")).update(Buffer.from(forgedHash.authTag, "base64")).digest("hex");
  expectCode(() => target.receiveCompanySyncEnvelope(forgedHash, targetFacts.transportId), "SYNC_DECRYPT_FAILED");

  const outOfOrder = target.receiveCompanySyncEnvelope(envelopeTwo, targetFacts.transportId);
  assert.equal(outOfOrder.outcome, "conflict");
  assert.equal(target.stats().syncUnresolvedConflicts, 1);
  const applied = target.receiveCompanySyncEnvelope(envelopeOne, targetFacts.transportId);
  assert.equal(applied.outcome, "applied");
  assert.deepEqual(applied.reconciled, ["revision-two"]);
  assert.equal(target.stats().syncUnresolvedConflicts, 0);
  const replica = target.getCompanySyncReplica({ workspaceId: targetFacts.workspaceId, recordId: publication.id }, targetFacts.ownerId);
  assert.equal(replica.revision, secondPublication.revision);
  assert.equal(replica.projection.title, "Encrypted company direction — revised");
  assert.equal(target.receiveCompanySyncEnvelope(envelopeOne, targetFacts.transportId).outcome, "duplicate");

  source.revokeSharedPublication({ publicationId: publication.id, expectedRevision: 2 }, sourceFacts.ownerId);
  source.enqueueCompanySyncTombstone({
    publicationId: publication.id, expectedRevision: 2, deviceId: sourceFacts.deviceId, operationId: "revision-three-tombstone",
  }, sourceFacts.ownerId);
  const tombstone = source.listCompanySyncOutbox({ workspaceId: sourceFacts.workspaceId }, sourceFacts.ownerId)
    .find((item) => item.id === "revision-three-tombstone");
  assert.equal(target.receiveCompanySyncEnvelope(tombstone, targetFacts.transportId).outcome, "applied");
  const deleted = target.getCompanySyncReplica({ workspaceId: targetFacts.workspaceId, recordId: publication.id }, targetFacts.ownerId);
  assert.equal(deleted.status, "tombstoned");
  assert.equal(deleted.revision, 3);
  assert.equal(Object.hasOwn(deleted, "projection"), false);

  const revokedDevice = target.revokeCompanySyncDevice({ workspaceId: targetFacts.workspaceId, deviceId: targetFacts.deviceId }, targetFacts.ownerId);
  assert.equal(revokedDevice.status, "revoked");
  expectCode(() => target.receiveCompanySyncEnvelope(tombstone, targetFacts.transportId), "SYNC_DEVICE_DENIED");
  const revokedWorkspace = target.revokeCompanySyncWorkspace({ workspaceId: targetFacts.workspaceId }, targetFacts.ownerId);
  assert.equal(revokedWorkspace.keyReferenceRemoved, true);
  assert.equal(revokedWorkspace.removedRecords, 1);
  assert.equal(target.db.prepare("SELECT key_reference FROM company_sync_workspaces WHERE workspace_id=?").get(targetFacts.workspaceId).key_reference, null);
  assert.equal(target.getCompanySyncReplica({ workspaceId: targetFacts.workspaceId, recordId: publication.id }, targetFacts.ownerId), null);
});

test("expired leases fail closed and schema v9 migration creates empty sync boundaries", (context) => {
  let now = NOW;
  const { databasePath, store } = createStore(context, "migration", () => now);
  const facts = prepareReplica(store);
  const { publication } = createPublishedMemory(store, facts);
  now += 172_800_000;
  expectCode(() => store.enqueueCompanySyncPublication({
    publicationId: publication.id, expectedRevision: 1, deviceId: facts.deviceId,
  }, facts.ownerId), "SYNC_LEASE_EXPIRED");

  store.db.exec(`
    DROP TABLE company_sync_conflicts;
    DROP TABLE company_sync_records;
    DROP TABLE company_sync_operations;
    DROP TABLE company_sync_devices;
    DROP TABLE company_sync_workspaces;
    PRAGMA user_version=9;
  `);
  store.close();
  const migrated = new MemoryStore(databasePath, {
    companySyncKeyProvider: { resolveKey: () => Buffer.from(WORKSPACE_KEY) },
    clock: () => now,
  });
  assert.equal(SCHEMA_VERSION, 11);
  assert.equal(migrated.stats().schemaVersion, 11);
  assert.equal(migrated.stats().syncPendingOperations, 0);
  assert.equal(migrated.stats().syncUnresolvedConflicts, 0);
  assert.ok(migrated.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='company_sync_operations'").get());
  migrated.close();
});
