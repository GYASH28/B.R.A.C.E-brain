"use strict";

const { createHash, randomUUID } = require("node:crypto");
const { authorize } = require("../business-authorization");
const { PublicationPreviewCache } = require("../publication-preview-cache");

const OWNERSHIP_SCOPES = new Set(["team", "organization"]);

function text(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function sha256(value) { return createHash("sha256").update(String(value)).digest("hex"); }
function tokens(value) { return text(value).toLocaleLowerCase("en-US").match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) || []; }
function iso(clock) {
  const value = Number(clock());
  if (!Number.isFinite(value)) throw new Error("The shared-memory clock returned an invalid time.");
  return new Date(value).toISOString();
}
function errorWithCode(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function authorizationDenied(decisions) {
  const error = errorWithCode("AUTHORIZATION_DENIED");
  const details = Object.freeze({ decisions: Object.freeze((Array.isArray(decisions) ? decisions : [decisions]).filter(Boolean)) });
  Object.defineProperty(error, "details", { value: details, enumerable: false });
  return error;
}
function projectionPayload(row) {
  return { kind: row.kind, title: row.title, summary: row.summary, content: row.content };
}
function fingerprint(row) { return sha256(JSON.stringify(projectionPayload(row))); }
function canonicalUri(publicationId, revision) { return `brace-shared://${publicationId}/revisions/${revision}`; }
function hydrateProjection(row) {
  if (!row) return null;
  return {
    id: row.id || row.publication_id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    ownershipScope: row.ownership_scope,
    status: row.status,
    revision: Number(row.revision ?? row.current_revision),
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    content: row.content,
    uri: canonicalUri(row.id || row.publication_id, Number(row.revision ?? row.current_revision)),
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

class SharedMemoryRepository {
  constructor(database, options = {}) {
    this.db = database;
    this.transaction = options.transaction;
    this.organizations = options.organizationRepository;
    this.clock = typeof options.clock === "function" ? options.clock : Date.now;
    this.previews = options.previewCache || new PublicationPreviewCache({ clock: this.clock });
    if (typeof this.transaction !== "function") throw new Error("SharedMemoryRepository requires a transaction boundary.");
    if (!this.organizations) throw new Error("SharedMemoryRepository requires organization resolution.");
  }

  bindOwnerForFixture(memoryId, subjectId) {
    const memory = this.db.prepare("SELECT id,workspace_id FROM memories WHERE id=?").get(String(memoryId || ""));
    const subject = this.db.prepare("SELECT id,kind FROM authorization_subjects WHERE id=?").get(String(subjectId || ""));
    if (!memory) throw new Error("Memory not found.");
    if (memory.workspace_id !== null) throw new Error("Only personal memories can receive an owner binding.");
    if (!subject || subject.kind !== "human") throw new Error("A personal memory owner must be a human authorization subject.");
    this.db.prepare("UPDATE memories SET owner_subject_id=? WHERE id=?").run(subject.id, memory.id);
    return { memoryId: memory.id, ownerSubjectId: subject.id };
  }

  sourceFacts(memoryId, actorSubjectId) {
    const memory = this.db.prepare("SELECT * FROM memories WHERE id=?").get(String(memoryId || ""));
    const subjectRow = actorSubjectId && this.db.prepare("SELECT * FROM authorization_subjects WHERE id=?").get(String(actorSubjectId));
    return {
      memory,
      subject: subjectRow && { id: subjectRow.id, kind: subjectRow.kind, verified: Boolean(subjectRow.verified_at), status: subjectRow.status },
      resource: memory && { id: memory.id, scope: "personal", ownerSubjectId: memory.owner_subject_id },
    };
  }

  assertPersonalPublish(memoryId, actorSubjectId) {
    const facts = this.sourceFacts(memoryId, actorSubjectId);
    const decision = authorize({ action: "memory.publish", subject: facts.subject, resource: facts.resource });
    if (!decision.allowed || !facts.memory || facts.memory.workspace_id !== null || facts.memory.status !== "active") {
      throw authorizationDenied(decision);
    }
    return facts.memory;
  }

  destinationDecisions(workspaceId, actorSubjectId, resource, actions) {
    const facts = this.organizations.resolveWorkspaceAuthorizationFacts(workspaceId, actorSubjectId, resource);
    const decisions = actions.map((action) => authorize({ action, ...facts }));
    if (decisions.some((decision) => !decision.allowed)) throw authorizationDenied(decisions);
    return facts;
  }

  preview(input = {}, actorSubjectId) {
    const ownershipScope = OWNERSHIP_SCOPES.has(input.ownershipScope) ? input.ownershipScope : null;
    if (!ownershipScope) throw new Error("A shared publication requires team or organization ownership.");
    const actorId = String(actorSubjectId || "");
    const memory = this.assertPersonalPublish(input.memoryId, actorId);
    const destination = this.destinationDecisions(
      String(input.workspaceId || ""),
      actorId,
      { id: String(input.workspaceId || ""), scope: ownershipScope },
      ["memory.publish", "memory.read"],
    );
    const publication = this.db.prepare(`
      SELECT id,status,current_revision FROM shared_publications
      WHERE origin_memory_id=? AND workspace_id=? AND ownership_scope=?
    `).get(memory.id, destination.workspace.id, ownershipScope);
    if (publication?.status === "revoked") throw errorWithCode("PUBLICATION_REVOKED");
    const preview = this.previews.create({
      actorSubjectId: actorId,
      memoryId: memory.id,
      workspaceId: destination.workspace.id,
      ownershipScope,
      sourceFingerprint: fingerprint(memory),
      currentRevision: Number(publication?.current_revision || 0),
    });
    return {
      previewId: preview.id,
      expiresAt: preview.expiresAt,
      expectedRevision: preview.currentRevision,
      destination: {
        organizationId: destination.organization.id,
        workspaceId: destination.workspace.id,
        ownershipScope,
      },
      projection: projectionPayload(memory),
      disclosure: {
        included: ["kind", "title", "summary", "content"],
        omitted: ["tags", "source metadata", "evidence", "embeddings", "project links", "duplicate links"],
        localRetentionLimitation: "Revocation removes this local shared projection from active access but cannot retract copies already exported or sent elsewhere.",
      },
    };
  }

  commit(previewId, actorSubjectId) {
    const preview = this.previews.inspect(previewId);
    if (!preview) throw authorizationDenied();
    const actorId = String(actorSubjectId || "");
    const committed = this.transaction(() => {
      const memory = this.assertPersonalPublish(preview.memoryId, actorId);
      const destination = this.destinationDecisions(
        preview.workspaceId,
        actorId,
        { id: preview.workspaceId, scope: preview.ownershipScope },
        ["memory.publish", "memory.read"],
      );
      if (preview.actorSubjectId !== actorId) throw authorizationDenied();
      const lifecycle = this.previews.inspect(preview.id);
      if (lifecycle.state === "consumed") throw errorWithCode("PREVIEW_CONSUMED");
      if (lifecycle.state === "expired") throw errorWithCode("PREVIEW_EXPIRED");
      const publication = this.db.prepare(`
        SELECT * FROM shared_publications
        WHERE origin_memory_id=? AND workspace_id=? AND ownership_scope=?
      `).get(memory.id, destination.workspace.id, preview.ownershipScope);
      if (publication?.status === "revoked") throw errorWithCode("PUBLICATION_REVOKED");
      const currentRevision = Number(publication?.current_revision || 0);
      if (fingerprint(memory) !== preview.sourceFingerprint || currentRevision !== preview.currentRevision) {
        throw errorWithCode("PREVIEW_STALE");
      }
      const publicationId = publication?.id || randomUUID();
      const revision = currentRevision + 1;
      const timestamp = iso(this.clock);
      const payload = projectionPayload(memory);
      if (publication) {
        const updated = this.db.prepare("UPDATE shared_publications SET current_revision=?,updated_at=? WHERE id=? AND status='active' AND current_revision=?")
          .run(revision, timestamp, publicationId, currentRevision);
        if (Number(updated.changes) !== 1) throw errorWithCode("PREVIEW_STALE");
      } else {
        this.db.prepare(`
          INSERT INTO shared_publications(
            id,organization_id,workspace_id,ownership_scope,origin_memory_id,publisher_subject_id,
            status,current_revision,created_at,updated_at,revoked_at,revoked_by_subject_id
          ) VALUES (?,?,?,?,?,?,'active',1,?,?,NULL,NULL)
        `).run(publicationId, destination.organization.id, destination.workspace.id, preview.ownershipScope, memory.id, actorId, timestamp, timestamp);
      }
      this.db.prepare(`
        INSERT INTO shared_memory_revisions(
          publication_id,revision,kind,title,summary,content,payload_hash,source_fingerprint,
          published_by_subject_id,published_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(publicationId, revision, payload.kind, payload.title, payload.summary, payload.content, sha256(JSON.stringify(payload)), preview.sourceFingerprint, actorId, timestamp);
      this.organizations.insertAudit({
        organizationId: destination.organization.id,
        workspaceId: destination.workspace.id,
        eventType: "memory.shared.published",
        actorLabel: actorId,
        summary: "Shared memory publication updated",
        metadata: { publicationId, revision, ownershipScope: preview.ownershipScope },
        occurredAt: timestamp,
      });
      return this.projectionByPublicationId(publicationId);
    });
    this.previews.finalize(preview.id);
    return committed;
  }

  revoke(input = {}, actorSubjectId) {
    const publicationId = String(input.publicationId || "");
    const expectedRevision = Number(input.expectedRevision);
    return this.transaction(() => {
      const publication = this.db.prepare("SELECT * FROM shared_publications WHERE id=?").get(publicationId);
      if (!publication) throw authorizationDenied();
      const facts = this.destinationDecisions(
        publication.workspace_id,
        String(actorSubjectId || ""),
        { id: publication.id, scope: publication.ownership_scope, organizationId: publication.organization_id, workspaceId: publication.workspace_id },
        ["memory.delete", "memory.read"],
      );
      if (publication.status !== "active") throw errorWithCode("PUBLICATION_REVOKED");
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== Number(publication.current_revision)) {
        throw errorWithCode("REVISION_STALE");
      }
      const timestamp = iso(this.clock);
      const revoked = this.db.prepare(`
        UPDATE shared_publications
        SET status='revoked',updated_at=?,revoked_at=?,revoked_by_subject_id=?
        WHERE id=? AND status='active' AND current_revision=?
      `).run(timestamp, timestamp, String(actorSubjectId || ""), publication.id, expectedRevision);
      if (Number(revoked.changes) !== 1) throw errorWithCode("REVISION_STALE");
      this.organizations.insertAudit({
        organizationId: facts.organization.id,
        workspaceId: facts.workspace.id,
        eventType: "memory.shared.revoked",
        actorLabel: String(actorSubjectId || ""),
        summary: "Shared memory publication revoked",
        metadata: { publicationId: publication.id, revision: expectedRevision, ownershipScope: publication.ownership_scope },
        occurredAt: timestamp,
      });
      return { id: publication.id, status: "revoked", revision: expectedRevision, revokedAt: timestamp };
    });
  }

  projectionByPublicationId(publicationId) {
    return hydrateProjection(this.db.prepare(`
      SELECT p.id,p.organization_id,p.workspace_id,p.ownership_scope,p.status,p.current_revision,p.updated_at,
        r.revision,r.kind,r.title,r.summary,r.content,r.published_at
      FROM shared_publications p JOIN shared_memory_revisions r
        ON r.publication_id=p.id AND r.revision=p.current_revision
      WHERE p.id=?
    `).get(publicationId));
  }

  get(publicationId, actorSubjectId) {
    const publication = this.db.prepare("SELECT * FROM shared_publications WHERE id=?").get(String(publicationId || ""));
    if (!publication) throw authorizationDenied();
    this.destinationDecisions(
      publication.workspace_id,
      String(actorSubjectId || ""),
      { id: publication.id, scope: publication.ownership_scope, organizationId: publication.organization_id, workspaceId: publication.workspace_id },
      ["memory.read"],
    );
    if (publication.status !== "active") return null;
    return this.projectionByPublicationId(publication.id);
  }

  authorizeWorkspace(options, actorSubjectId, actions) {
    const workspaceId = String(options?.workspaceId || "");
    return this.destinationDecisions(workspaceId, String(actorSubjectId || ""), { id: workspaceId, scope: "team" }, actions);
  }

  listRows(options = {}) {
    const filters = ["p.workspace_id=?", "p.status='active'"];
    const params = [String(options.workspaceId || "")];
    if (OWNERSHIP_SCOPES.has(options.ownershipScope)) {
      filters.push("p.ownership_scope=?");
      params.push(options.ownershipScope);
    }
    const limit = Math.min(500, Math.max(1, Number(options.limit) || 100));
    params.push(limit);
    return this.db.prepare(`
      SELECT p.id,p.organization_id,p.workspace_id,p.ownership_scope,p.status,p.current_revision,p.updated_at,
        r.revision,r.kind,r.title,r.summary,r.content,r.published_at
      FROM shared_publications p JOIN shared_memory_revisions r
        ON r.publication_id=p.id AND r.revision=p.current_revision
      WHERE ${filters.join(" AND ")}
      ORDER BY p.updated_at DESC,p.id LIMIT ?
    `).all(...params);
  }

  list(options = {}, actorSubjectId) {
    this.authorizeWorkspace(options, actorSubjectId, ["memory.read"]);
    return this.listRows(options).map(hydrateProjection);
  }

  search(query, options = {}, actorSubjectId) {
    this.authorizeWorkspace(options, actorSubjectId, ["search.query", "memory.read"]);
    const clean = text(query);
    if (!clean) return { mode: "lexical", query: clean, results: [] };
    const queryTokens = [...new Set(tokens(clean))].slice(0, 20);
    const candidateLimit = Math.min(2_000, Math.max(100, (Number(options.limit) || 20) * 10));
    const rows = this.listRows({ ...options, limit: candidateLimit });
    const scored = rows.map((row) => {
      const haystack = `${row.title} ${row.title} ${row.summary} ${row.content}`.toLocaleLowerCase("en-US");
      const matchedTokens = queryTokens.filter((token) => haystack.includes(token));
      return { row, score: matchedTokens.length / queryTokens.length, matchedTokens };
    }).filter((item) => item.matchedTokens.length)
      .sort((left, right) => right.score - left.score || String(right.row.updated_at).localeCompare(String(left.row.updated_at)));
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    return {
      mode: "lexical",
      query: clean,
      results: scored.slice(0, limit).map((item) => ({
        ...hydrateProjection(item.row),
        retrieval: { score: item.score, matchedTokens: item.matchedTokens },
      })),
    };
  }

  graph(options = {}, actorSubjectId) {
    this.authorizeWorkspace(options, actorSubjectId, ["graph.read", "memory.read"]);
    return {
      nodes: this.listRows(options).map((row) => {
        const item = hydrateProjection(row);
        return { id: item.id, type: "shared-publication", label: item.title, kind: item.kind, ownershipScope: item.ownershipScope, uri: item.uri, revision: item.revision, timestamp: item.updatedAt };
      }),
      edges: [],
    };
  }

  exportProjection(options = {}, actorSubjectId) {
    const facts = this.authorizeWorkspace(options, actorSubjectId, ["export.create", "memory.read"]);
    return {
      schemaVersion: 1,
      exportedAt: iso(this.clock),
      organizationId: facts.organization.id,
      workspaceId: facts.workspace.id,
      memories: this.listRows(options).map(hydrateProjection),
    };
  }

  previewContext(options = {}, actorSubjectId) {
    const query = text(options.query);
    const actions = ["ai.context", "memory.read"];
    if (query) actions.push("search.query");
    this.authorizeWorkspace(options, actorSubjectId, actions);
    const memories = query
      ? this.search(query, options, actorSubjectId).results
      : this.listRows(options).map(hydrateProjection);
    const selected = memories.slice(0, Math.min(50, Math.max(1, Number(options.limit) || 12)));
    return {
      mode: "shared-projection-preview",
      query,
      memories: selected,
      context: selected.map((item) => `[${item.kind}] ${item.title}\n${item.summary}\n${item.content}\n${item.uri}`).join("\n\n"),
    };
  }
}

module.exports = {
  OWNERSHIP_SCOPES,
  SharedMemoryRepository,
  authorizationDenied,
  canonicalUri,
  fingerprint,
};
