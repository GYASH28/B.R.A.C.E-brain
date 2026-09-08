"use strict";

const { randomUUID } = require("node:crypto");
const { authorize } = require("../business-authorization");
const { decryptSyncPayload, encryptSyncPayload, metadataForAad } = require("../company-sync-crypto");

function syncError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function iso(clock) {
  const value = Number(clock());
  if (!Number.isFinite(value)) throw syncError("SYNC_CLOCK_INVALID", "The company-sync clock returned an invalid time.");
  return new Date(value).toISOString();
}

function bounded(value, label, maximum = 160) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > maximum || /[\u0000-\u001f\u007f]/.test(result)) {
    throw syncError("SYNC_INPUT_INVALID", `A valid ${label} is required.`);
  }
  return result;
}

function operationDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    direction: row.direction,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    actorSubjectId: row.actor_subject_id,
    deviceId: row.device_id,
    recordType: row.record_type,
    recordId: row.record_id,
    operationKind: row.operation_kind,
    baseRevision: Number(row.base_revision),
    resultRevision: Number(row.result_revision),
    keyId: row.key_id,
    payloadHash: row.payload_hash,
    status: row.status,
    remoteSequence: row.remote_sequence === null ? null : Number(row.remote_sequence),
    createdAt: row.created_at,
    terminalAt: row.terminal_at,
  };
}

function envelopeDto(row) {
  return {
    ...operationDto(row),
    operationId: row.id,
    nonce: Buffer.from(row.payload_nonce).toString("base64"),
    ciphertext: Buffer.from(row.payload_ciphertext).toString("base64"),
    authTag: Buffer.from(row.payload_auth_tag).toString("base64"),
  };
}

function conflictDto(row) {
  return row && {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    recordId: row.record_id,
    localOperationId: row.local_operation_id,
    remoteOperationId: row.remote_operation_id,
    baseRevision: Number(row.base_revision),
    localRevision: Number(row.local_revision),
    remoteRevision: Number(row.remote_revision),
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolution: row.resolution,
  };
}

class CompanySyncRepository {
  constructor(database, options = {}) {
    this.db = database;
    this.transaction = options.transaction;
    this.organizations = options.organizationRepository;
    this.keyProvider = options.keyProvider || null;
    this.clock = typeof options.clock === "function" ? options.clock : Date.now;
    if (typeof this.transaction !== "function") throw new Error("CompanySyncRepository requires a transaction boundary.");
    if (!this.organizations) throw new Error("CompanySyncRepository requires organization resolution.");
  }

  configureWorkspaceForFixture(input = {}) {
    const workspaceId = bounded(input.workspaceId, "workspace id", 128);
    const workspace = this.db.prepare("SELECT * FROM workspaces WHERE id=?").get(workspaceId);
    if (!workspace) throw syncError("SYNC_WORKSPACE_NOT_FOUND");
    const keyReference = bounded(input.keyReference, "opaque key reference", 240);
    const keyId = bounded(input.keyId, "key id", 160);
    const leaseTime = Date.parse(String(input.leaseExpiresAt || ""));
    if (!Number.isFinite(leaseTime)) throw syncError("SYNC_INPUT_INVALID", "A valid lease expiry is required.");
    const leaseExpiresAt = new Date(leaseTime).toISOString();
    const timestamp = iso(this.clock);
    this.db.prepare(`
      INSERT INTO company_sync_workspaces(
        workspace_id,organization_id,key_reference,key_id,policy_version,
        offline_allowed,lease_expires_at,status,created_at,updated_at,last_sync_at
      ) VALUES (?,?,?,?,?,?,?,'active',?,?,NULL)
      ON CONFLICT(workspace_id) DO UPDATE SET
        organization_id=excluded.organization_id,key_reference=excluded.key_reference,
        key_id=excluded.key_id,policy_version=excluded.policy_version,
        offline_allowed=excluded.offline_allowed,lease_expires_at=excluded.lease_expires_at,
        status='active',updated_at=excluded.updated_at
    `).run(
      workspace.id, workspace.organization_id, keyReference, keyId,
      Math.max(1, Number(input.policyVersion) || 1), input.offlineAllowed === false ? 0 : 1,
      leaseExpiresAt, timestamp, timestamp,
    );
    return this.workspaceStatus(workspace.id);
  }

  registerDeviceForFixture(input = {}) {
    const workspaceId = bounded(input.workspaceId, "workspace id", 128);
    const subjectId = bounded(input.subjectId, "subject id", 128);
    const workspace = this.db.prepare("SELECT * FROM workspaces WHERE id=?").get(workspaceId);
    const subject = this.db.prepare("SELECT * FROM authorization_subjects WHERE id=?").get(subjectId);
    if (!workspace || !subject) throw syncError("SYNC_INPUT_INVALID", "The fixture device requires an existing workspace and subject.");
    const id = bounded(input.id || randomUUID(), "device id", 128);
    const timestamp = iso(this.clock);
    this.db.prepare(`
      INSERT INTO company_sync_devices(
        id,organization_id,workspace_id,subject_id,label,status,created_at,last_seen_at,revoked_at
      ) VALUES (?,?,?,?,?,'active',?,?,NULL)
    `).run(id, workspace.organization_id, workspace.id, subject.id, bounded(input.label || "Synthetic device", "device label", 120), timestamp, timestamp);
    return { id, organizationId: workspace.organization_id, workspaceId: workspace.id, subjectId: subject.id, status: "active" };
  }

  workspaceStatus(workspaceId) {
    const row = this.db.prepare("SELECT * FROM company_sync_workspaces WHERE workspace_id=?").get(String(workspaceId || ""));
    return row && {
      organizationId: row.organization_id,
      workspaceId: row.workspace_id,
      keyReference: row.key_reference,
      keyId: row.key_id,
      policyVersion: Number(row.policy_version),
      offlineAllowed: Boolean(row.offline_allowed),
      leaseExpiresAt: row.lease_expires_at,
      status: row.status,
      lastSyncAt: row.last_sync_at,
    };
  }

  authorization(workspaceId, actorSubjectId, resource, actions) {
    const facts = this.organizations.resolveWorkspaceAuthorizationFacts(workspaceId, actorSubjectId, resource);
    const decisions = actions.map((action) => authorize({ action, ...facts }));
    if (decisions.some((decision) => !decision.allowed)) {
      const error = syncError("AUTHORIZATION_DENIED", "The company sync operation is not available for this identity.");
      Object.defineProperty(error, "details", { value: Object.freeze({ decisions: Object.freeze(decisions) }), enumerable: false });
      throw error;
    }
    return facts;
  }

  activeProfile(workspaceId, organizationId) {
    const profile = this.db.prepare("SELECT * FROM company_sync_workspaces WHERE workspace_id=? AND organization_id=?").get(workspaceId, organizationId);
    if (!profile || profile.status !== "active" || !profile.key_reference) throw syncError("SYNC_NOT_CONFIGURED", "Company sync is not configured for this workspace.");
    if (Date.parse(profile.lease_expires_at) <= Number(this.clock())) throw syncError("SYNC_LEASE_EXPIRED", "The workspace sync lease expired and must be refreshed online.");
    return profile;
  }

  activeDevice(deviceId, workspaceId, organizationId, expectedSubjectId) {
    const device = this.db.prepare("SELECT * FROM company_sync_devices WHERE id=? AND workspace_id=? AND organization_id=?")
      .get(deviceId, workspaceId, organizationId);
    if (!device || device.status !== "active" || device.subject_id !== expectedSubjectId) {
      throw syncError("SYNC_DEVICE_DENIED", "The sync device is not active for the exact workspace identity.");
    }
    return device;
  }

  resolveKey(profile) {
    if (!this.keyProvider || typeof this.keyProvider.resolveKey !== "function") {
      throw syncError("SYNC_KEY_UNAVAILABLE", "No workspace key provider is available.");
    }
    let key;
    try { key = this.keyProvider.resolveKey(profile.key_reference); }
    catch { throw syncError("SYNC_KEY_UNAVAILABLE", "The workspace sync key could not be resolved."); }
    return key;
  }

  withKey(profile, callback) {
    const key = this.resolveKey(profile);
    try { return callback(key); }
    finally {
      if (Buffer.isBuffer(key) || key instanceof Uint8Array) key.fill(0);
    }
  }

  publicationRow(publicationId) {
    return this.db.prepare(`
      SELECT p.*,r.revision,r.kind,r.title,r.summary,r.content,r.published_at
      FROM shared_publications p
      LEFT JOIN shared_memory_revisions r
        ON r.publication_id=p.id AND r.revision=p.current_revision
      WHERE p.id=?
    `).get(String(publicationId || ""));
  }

  enqueuePublication(input = {}, actorSubjectId) {
    return this.enqueue(input, actorSubjectId, false);
  }

  enqueueTombstone(input = {}, actorSubjectId) {
    return this.enqueue(input, actorSubjectId, true);
  }

  enqueue(input, actorSubjectId, tombstone) {
    return this.transaction(() => {
      const publication = this.publicationRow(bounded(input.publicationId, "publication id", 128));
      if (!publication) throw syncError("SYNC_PUBLICATION_NOT_FOUND");
      if (tombstone ? publication.status !== "revoked" : publication.status !== "active") {
        throw syncError(tombstone ? "SYNC_TOMBSTONE_REQUIRES_REVOCATION" : "SYNC_PUBLICATION_INACTIVE");
      }
      const expectedRevision = Number(input.expectedRevision);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== Number(publication.current_revision)) {
        throw syncError("REVISION_STALE");
      }
      const actorId = bounded(actorSubjectId, "actor subject id", 128);
      const actions = tombstone ? ["sync.transfer", "memory.delete"] : ["sync.transfer", "memory.read"];
      const facts = this.authorization(
        publication.workspace_id,
        actorId,
        { id: publication.id, scope: publication.ownership_scope, organizationId: publication.organization_id, workspaceId: publication.workspace_id },
        actions,
      );
      const deviceId = bounded(input.deviceId, "device id", 128);
      this.activeDevice(deviceId, facts.workspace.id, facts.organization.id, actorId);
      const profile = this.activeProfile(facts.workspace.id, facts.organization.id);
      const operationId = bounded(input.operationId || randomUUID(), "operation id", 128);
      if (this.db.prepare("SELECT 1 FROM company_sync_operations WHERE id=?").get(operationId)) throw syncError("SYNC_OPERATION_REPLAYED");
      const currentRevision = Number(publication.current_revision);
      const metadata = metadataForAad({
        operationId,
        organizationId: publication.organization_id,
        workspaceId: publication.workspace_id,
        actorSubjectId: actorId,
        deviceId,
        recordType: "shared-memory",
        recordId: publication.id,
        operationKind: tombstone ? "tombstone" : "upsert",
        baseRevision: tombstone ? currentRevision : currentRevision - 1,
        resultRevision: tombstone ? currentRevision + 1 : currentRevision,
        keyId: profile.key_id,
        createdAt: iso(this.clock),
      });
      const payload = tombstone ? {
        schemaVersion: 1,
        recordId: publication.id,
        operationKind: "tombstone",
        resultRevision: metadata.resultRevision,
        revokedAt: publication.revoked_at,
      } : {
        schemaVersion: 1,
        recordId: publication.id,
        operationKind: "upsert",
        resultRevision: metadata.resultRevision,
        ownershipScope: publication.ownership_scope,
        kind: publication.kind,
        title: publication.title,
        summary: publication.summary,
        content: publication.content,
        publishedAt: publication.published_at,
      };
      const encrypted = this.withKey(profile, (key) => encryptSyncPayload(payload, metadata, key));
      this.insertOperation({ ...metadata, ...encrypted, direction: "outbox", status: "pending" });
      this.organizations.insertAudit({
        organizationId: facts.organization.id,
        workspaceId: facts.workspace.id,
        eventType: tombstone ? "sync.tombstone.queued" : "sync.publication.queued",
        actorLabel: actorId,
        summary: tombstone ? "Encrypted shared-memory tombstone queued" : "Encrypted shared-memory revision queued",
        metadata: { operationId, publicationId: publication.id, revision: metadata.resultRevision },
        occurredAt: metadata.createdAt,
      });
      return operationDto(this.operationRow(operationId));
    });
  }

  insertOperation(input) {
    this.db.prepare(`
      INSERT INTO company_sync_operations(
        id,direction,organization_id,workspace_id,actor_subject_id,device_id,
        record_type,record_id,operation_kind,base_revision,result_revision,key_id,
        payload_nonce,payload_ciphertext,payload_auth_tag,payload_hash,status,
        remote_sequence,created_at,terminal_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,NULL)
    `).run(
      input.operationId, input.direction, input.organizationId, input.workspaceId,
      input.actorSubjectId, input.deviceId, input.recordType, input.recordId,
      input.operationKind, input.baseRevision, input.resultRevision, input.keyId,
      input.nonce, input.ciphertext, input.authTag, input.payloadHash,
      input.status, input.createdAt,
    );
  }

  operationRow(id) { return this.db.prepare("SELECT * FROM company_sync_operations WHERE id=?").get(String(id || "")); }

  listOutbox(options = {}, actorSubjectId) {
    const workspaceId = bounded(options.workspaceId, "workspace id", 128);
    const facts = this.authorization(workspaceId, actorSubjectId, { id: workspaceId, scope: "team" }, ["sync.transfer"]);
    this.activeProfile(workspaceId, facts.organization.id);
    const limit = Math.min(200, Math.max(1, Number(options.limit) || 50));
    return this.db.prepare(`
      SELECT * FROM company_sync_operations
      WHERE workspace_id=? AND direction='outbox' AND status='pending'
      ORDER BY created_at,id LIMIT ?
    `).all(workspaceId, limit).map(envelopeDto);
  }

  acknowledgeOutbox(input = {}, actorSubjectId) {
    return this.transaction(() => {
      const row = this.operationRow(bounded(input.operationId, "operation id", 128));
      if (!row || row.direction !== "outbox") throw syncError("SYNC_OPERATION_NOT_FOUND");
      const facts = this.authorization(row.workspace_id, actorSubjectId, {
        id: row.id, scope: "team", organizationId: row.organization_id, workspaceId: row.workspace_id,
      }, ["sync.transfer"]);
      this.activeProfile(row.workspace_id, facts.organization.id);
      if (row.status === "acknowledged") return operationDto(row);
      if (row.status !== "pending") throw syncError("SYNC_OPERATION_TERMINAL");
      const sequence = Number(input.remoteSequence);
      if (!Number.isSafeInteger(sequence) || sequence < 1) throw syncError("SYNC_INPUT_INVALID", "A positive remote sequence is required.");
      const timestamp = iso(this.clock);
      this.db.prepare("UPDATE company_sync_operations SET status='acknowledged',remote_sequence=?,terminal_at=? WHERE id=? AND status='pending'")
        .run(sequence, timestamp, row.id);
      this.db.prepare("UPDATE company_sync_workspaces SET last_sync_at=?,updated_at=? WHERE workspace_id=?")
        .run(timestamp, timestamp, row.workspace_id);
      return operationDto(this.operationRow(row.id));
    });
  }

  revokeDevice(input = {}, actorSubjectId) {
    return this.transaction(() => {
      const workspaceId = bounded(input.workspaceId, "workspace id", 128);
      const deviceId = bounded(input.deviceId, "device id", 128);
      const device = this.db.prepare("SELECT * FROM company_sync_devices WHERE id=? AND workspace_id=?").get(deviceId, workspaceId);
      if (!device) throw syncError("SYNC_DEVICE_NOT_FOUND");
      const facts = this.authorization(workspaceId, actorSubjectId, {
        id: device.id, scope: "team", organizationId: device.organization_id, workspaceId,
      }, ["organization.manage"]);
      if (device.status === "revoked") return { id: device.id, status: "revoked", revokedAt: device.revoked_at };
      const timestamp = iso(this.clock);
      this.db.prepare("UPDATE company_sync_devices SET status='revoked',revoked_at=?,last_seen_at=? WHERE id=? AND status='active'")
        .run(timestamp, timestamp, device.id);
      this.organizations.insertAudit({
        organizationId: facts.organization.id,
        workspaceId,
        eventType: "sync.device.revoked",
        actorLabel: String(actorSubjectId || ""),
        summary: "Company sync device revoked",
        metadata: { deviceId: device.id },
        occurredAt: timestamp,
      });
      return { id: device.id, status: "revoked", revokedAt: timestamp };
    });
  }

  revokeWorkspaceReplica(input = {}, actorSubjectId) {
    return this.transaction(() => {
      const workspaceId = bounded(input.workspaceId, "workspace id", 128);
      const profile = this.db.prepare("SELECT * FROM company_sync_workspaces WHERE workspace_id=?").get(workspaceId);
      if (!profile) throw syncError("SYNC_NOT_CONFIGURED");
      const facts = this.authorization(workspaceId, actorSubjectId, {
        id: workspaceId, scope: "team", organizationId: profile.organization_id, workspaceId,
      }, ["organization.manage"]);
      const timestamp = iso(this.clock);
      const removedRecords = Number(this.db.prepare("DELETE FROM company_sync_records WHERE workspace_id=?").run(workspaceId).changes);
      this.db.prepare("DELETE FROM company_sync_conflicts WHERE workspace_id=?").run(workspaceId);
      this.db.prepare("UPDATE company_sync_operations SET status='rejected',terminal_at=? WHERE workspace_id=? AND direction='outbox' AND status='pending'")
        .run(timestamp, workspaceId);
      this.db.prepare("UPDATE company_sync_devices SET status='revoked',revoked_at=COALESCE(revoked_at,?),last_seen_at=? WHERE workspace_id=?")
        .run(timestamp, timestamp, workspaceId);
      this.db.prepare("UPDATE company_sync_workspaces SET status='revoked',key_reference=NULL,lease_expires_at=?,updated_at=? WHERE workspace_id=?")
        .run(timestamp, timestamp, workspaceId);
      this.organizations.insertAudit({
        organizationId: facts.organization.id,
        workspaceId,
        eventType: "sync.workspace.revoked",
        actorLabel: String(actorSubjectId || ""),
        summary: "Local company sync access revoked and materialized replica removed",
        metadata: { removedRecords },
        occurredAt: timestamp,
      });
      return { workspaceId, status: "revoked", revokedAt: timestamp, removedRecords, keyReferenceRemoved: true };
    });
  }

  receiveEnvelope(envelope = {}, transportSubjectId) {
    const metadata = metadataForAad(envelope);
    return this.transaction(() => {
      this.authorization(metadata.workspaceId, transportSubjectId, {
        id: metadata.operationId, scope: "team", organizationId: metadata.organizationId, workspaceId: metadata.workspaceId,
      }, ["sync.transfer"]);
      this.activeDevice(metadata.deviceId, metadata.workspaceId, metadata.organizationId, metadata.actorSubjectId);
      const profile = this.activeProfile(metadata.workspaceId, metadata.organizationId);
      const existing = this.operationRow(metadata.operationId);
      if (existing) {
        if (existing.payload_hash !== envelope.payloadHash || existing.workspace_id !== metadata.workspaceId) {
          throw syncError("SYNC_OPERATION_COLLISION", "A reused operation id carried different data.");
        }
        return { outcome: "duplicate", operation: operationDto(existing), reconciled: [] };
      }
      if (profile.key_id !== metadata.keyId) throw syncError("SYNC_KEY_MISMATCH", "The envelope key id is not active for this workspace.");
      const payload = this.withKey(profile, (key) => decryptSyncPayload(envelope, key));
      this.validatePayload(payload, metadata);
      const encrypted = {
        nonce: Buffer.from(envelope.nonce, "base64"),
        ciphertext: Buffer.from(envelope.ciphertext, "base64"),
        authTag: Buffer.from(envelope.authTag, "base64"),
        payloadHash: envelope.payloadHash,
      };
      const current = this.recordRow(metadata.workspaceId, metadata.recordId);
      const localRevision = Number(current?.current_revision || 0);
      const outcome = metadata.baseRevision === localRevision ? "accepted" : "conflict";
      this.insertOperation({ ...metadata, ...encrypted, direction: "inbound", status: outcome });
      if (outcome === "conflict") {
        this.insertConflict(metadata, current, localRevision);
        return { outcome: "conflict", operation: operationDto(this.operationRow(metadata.operationId)), reconciled: [] };
      }
      this.materialize(metadata);
      const reconciled = this.reconcileRecord(metadata.workspaceId, metadata.recordId);
      const timestamp = iso(this.clock);
      this.db.prepare("UPDATE company_sync_workspaces SET last_sync_at=?,updated_at=? WHERE workspace_id=?")
        .run(timestamp, timestamp, metadata.workspaceId);
      return { outcome: "applied", operation: operationDto(this.operationRow(metadata.operationId)), reconciled };
    });
  }

  validatePayload(payload, metadata) {
    const allowed = metadata.operationKind === "upsert"
      ? ["schemaVersion", "recordId", "operationKind", "resultRevision", "ownershipScope", "kind", "title", "summary", "content", "publishedAt"]
      : ["schemaVersion", "recordId", "operationKind", "resultRevision", "revokedAt"];
    if (Object.keys(payload).some((key) => !allowed.includes(key))
      || payload.schemaVersion !== 1
      || payload.recordId !== metadata.recordId
      || payload.operationKind !== metadata.operationKind
      || payload.resultRevision !== metadata.resultRevision) {
      throw syncError("SYNC_PAYLOAD_INVALID", "The encrypted payload does not match its authenticated operation metadata.");
    }
    if (metadata.operationKind === "upsert") {
      if (!["team", "organization"].includes(payload.ownershipScope)
        || typeof payload.kind !== "string" || typeof payload.title !== "string"
        || typeof payload.summary !== "string" || typeof payload.content !== "string"
        || payload.title.length > 300 || payload.summary.length > 4_000 || payload.content.length > 200_000
        || !Number.isFinite(Date.parse(payload.publishedAt))) {
        throw syncError("SYNC_PAYLOAD_INVALID", "The encrypted shared-memory projection is malformed or unbounded.");
      }
    } else if (!Number.isFinite(Date.parse(payload.revokedAt))) {
      throw syncError("SYNC_PAYLOAD_INVALID", "The encrypted tombstone has no valid revocation time.");
    }
  }

  recordRow(workspaceId, recordId) {
    return this.db.prepare("SELECT * FROM company_sync_records WHERE workspace_id=? AND record_id=?").get(workspaceId, recordId);
  }

  materialize(metadata) {
    const status = metadata.operationKind === "tombstone" ? "tombstoned" : "active";
    const timestamp = iso(this.clock);
    this.db.prepare(`
      INSERT INTO company_sync_records(
        organization_id,workspace_id,record_type,record_id,status,current_revision,
        current_operation_id,updated_at
      ) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(workspace_id,record_type,record_id) DO UPDATE SET
        status=excluded.status,current_revision=excluded.current_revision,
        current_operation_id=excluded.current_operation_id,updated_at=excluded.updated_at
    `).run(
      metadata.organizationId, metadata.workspaceId, metadata.recordType,
      metadata.recordId, status, metadata.resultRevision, metadata.operationId, timestamp,
    );
  }

  insertConflict(metadata, current, localRevision) {
    this.db.prepare(`
      INSERT INTO company_sync_conflicts(
        id,organization_id,workspace_id,record_type,record_id,local_operation_id,
        remote_operation_id,base_revision,local_revision,remote_revision,status,
        created_at,resolved_at,resolution
      ) VALUES (?,?,?,?,?,?,?,?,?,?,'unresolved',?,NULL,NULL)
    `).run(
      randomUUID(), metadata.organizationId, metadata.workspaceId, metadata.recordType,
      metadata.recordId, current?.current_operation_id || null, metadata.operationId,
      metadata.baseRevision, localRevision, metadata.resultRevision, iso(this.clock),
    );
  }

  reconcileRecord(workspaceId, recordId) {
    const applied = [];
    while (true) {
      const current = this.recordRow(workspaceId, recordId);
      const revision = Number(current?.current_revision || 0);
      const next = this.db.prepare(`
        SELECT o.*,c.id AS conflict_id FROM company_sync_operations o
        JOIN company_sync_conflicts c ON c.remote_operation_id=o.id
        WHERE o.workspace_id=? AND o.record_id=? AND o.status='conflict'
          AND c.status='unresolved' AND o.base_revision=?
        ORDER BY o.result_revision,o.created_at,o.id LIMIT 1
      `).get(workspaceId, recordId, revision);
      if (!next) break;
      this.materialize({
        operationId: next.id,
        organizationId: next.organization_id,
        workspaceId: next.workspace_id,
        recordType: next.record_type,
        recordId: next.record_id,
        operationKind: next.operation_kind,
        resultRevision: Number(next.result_revision),
      });
      const timestamp = iso(this.clock);
      this.db.prepare("UPDATE company_sync_operations SET status='accepted',terminal_at=? WHERE id=?").run(timestamp, next.id);
      this.db.prepare("UPDATE company_sync_conflicts SET status='resolved',resolved_at=?,resolution='applied-after-predecessor' WHERE id=?")
        .run(timestamp, next.conflict_id);
      applied.push(next.id);
    }
    return applied;
  }

  getReplicaRecord(input = {}, actorSubjectId) {
    const workspaceId = bounded(input.workspaceId, "workspace id", 128);
    const recordId = bounded(input.recordId, "record id", 128);
    const facts = this.authorization(workspaceId, actorSubjectId, {
      id: recordId, scope: "team",
    }, ["memory.read"]);
    const row = this.recordRow(workspaceId, recordId);
    if (!row) return null;
    const operation = this.operationRow(row.current_operation_id);
    const profile = this.activeProfile(workspaceId, facts.organization.id);
    const payload = this.withKey(profile, (key) => decryptSyncPayload(envelopeDto(operation), key));
    if (row.status === "tombstoned") {
      return { recordId, workspaceId, status: "tombstoned", revision: Number(row.current_revision), revokedAt: payload.revokedAt };
    }
    return { recordId, workspaceId, status: "active", revision: Number(row.current_revision), projection: payload };
  }

  listConflicts(options = {}, actorSubjectId) {
    const workspaceId = bounded(options.workspaceId, "workspace id", 128);
    this.authorization(workspaceId, actorSubjectId, { id: workspaceId, scope: "team" }, ["audit.read"]);
    return this.db.prepare(`
      SELECT * FROM company_sync_conflicts WHERE workspace_id=?
      ORDER BY CASE status WHEN 'unresolved' THEN 0 ELSE 1 END,created_at DESC LIMIT 200
    `).all(workspaceId).map(conflictDto);
  }
}

module.exports = { CompanySyncRepository, conflictDto, envelopeDto, operationDto };
