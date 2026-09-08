"use strict";

const { randomUUID } = require("node:crypto");
const { isVerifiedIdentityProof, verifyIdentityAssertion } = require("../identity-assertion");

function identityError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sessionDto(row) {
  return row && {
    id: row.id,
    subjectId: row.subject_id,
    issuer: row.issuer,
    status: row.status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

class IdentitySessionRepository {
  constructor(database, options = {}) {
    this.db = database;
    this.transaction = options.transaction || ((callback) => callback());
    this.trustConfig = options.trustConfig || { issuers: [] };
    this.clock = typeof options.clock === "function" ? options.clock : Date.now;
  }

  startAssertion(compactJws) {
    const proof = verifyIdentityAssertion(compactJws, this.trustConfig, { clock: this.clock });
    return this.startVerifiedProof(proof);
  }

  startVerifiedProof(proof) {
    if (!isVerifiedIdentityProof(proof)) {
      throw identityError("IDENTITY_PROOF_REQUIRED", "A cryptographically verified identity proof is required.");
    }
    return this.transaction(() => {
      if (this.db.prepare("SELECT 1 FROM identity_sessions WHERE assertion_jti=? OR assertion_hash=?").get(proof.jti, proof.assertionHash)) {
        throw identityError("IDENTITY_ASSERTION_REPLAYED", "This identity assertion was already used.");
      }
      if (this.db.prepare("SELECT 1 FROM identity_sessions WHERE issuer=? AND provider_session_id=?").get(proof.issuer, proof.providerSessionId)) {
        throw identityError("IDENTITY_SESSION_EXISTS", "This provider session is already enrolled on this device.");
      }
      const timestamp = new Date(Number(this.clock())).toISOString();
      const existing = this.db.prepare("SELECT * FROM authorization_subjects WHERE issuer=? AND provider_subject=?")
        .get(proof.issuer, proof.providerSubject);
      if (existing && existing.kind !== proof.kind) {
        throw identityError("IDENTITY_SUBJECT_CONFLICT", "The verified identity conflicts with an existing subject kind.");
      }
      if (existing && existing.status !== "active") {
        throw identityError("IDENTITY_SUBJECT_INACTIVE", "The verified identity is suspended or revoked on this device.");
      }
      const subjectId = existing?.id || randomUUID();
      if (existing) {
        this.db.prepare("UPDATE authorization_subjects SET verified_at=?,updated_at=? WHERE id=?")
          .run(timestamp, timestamp, subjectId);
      } else {
        this.db.prepare("INSERT INTO authorization_subjects(id,kind,issuer,provider_subject,verified_at,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)")
          .run(subjectId, proof.kind, proof.issuer, proof.providerSubject, timestamp, timestamp, timestamp);
      }
      const id = randomUUID();
      this.db.prepare(`
        INSERT INTO identity_sessions(
          id,subject_id,issuer,provider_session_id,assertion_jti,assertion_hash,
          audience,status,started_at,expires_at,last_verified_at,revoked_at,revocation_reason
        ) VALUES (?,?,?,?,?,?,?,'active',?,?,?,NULL,NULL)
      `).run(
        id, subjectId, proof.issuer, proof.providerSessionId, proof.jti,
        proof.assertionHash, proof.audience, timestamp, proof.expiresAt, timestamp,
      );
      return sessionDto(this.db.prepare("SELECT * FROM identity_sessions WHERE id=?").get(id));
    });
  }

  resolveActive(sessionId) {
    const id = String(sessionId || "");
    if (!id) return null;
    const row = this.db.prepare(`
      SELECT s.*,a.status AS subject_status,a.verified_at AS subject_verified_at
      FROM identity_sessions s JOIN authorization_subjects a ON a.id=s.subject_id
      WHERE s.id=?
    `).get(id);
    if (!row || row.status !== "active" || row.subject_status !== "active" || !row.subject_verified_at) return null;
    const now = Number(this.clock());
    const expires = Date.parse(row.expires_at);
    if (!Number.isFinite(expires) || expires <= now) {
      const timestamp = new Date(now).toISOString();
      this.db.prepare("UPDATE identity_sessions SET status='expired',last_verified_at=? WHERE id=? AND status='active'")
        .run(timestamp, id);
      return null;
    }
    this.db.prepare("UPDATE identity_sessions SET last_verified_at=? WHERE id=?")
      .run(new Date(now).toISOString(), id);
    return sessionDto(row);
  }

  get(sessionId) {
    return sessionDto(this.db.prepare("SELECT * FROM identity_sessions WHERE id=?").get(String(sessionId || "")));
  }

  revokeSelf(sessionId, reason = "signed-out") {
    const id = String(sessionId || "");
    const row = this.db.prepare("SELECT * FROM identity_sessions WHERE id=?").get(id);
    if (!row) return false;
    if (row.status !== "active") return true;
    const timestamp = new Date(Number(this.clock())).toISOString();
    this.db.prepare("UPDATE identity_sessions SET status='revoked',revoked_at=?,revocation_reason=?,last_verified_at=? WHERE id=? AND status='active'")
      .run(timestamp, String(reason || "signed-out").slice(0, 120), timestamp, id);
    return true;
  }

  setSubjectStatusForFixture(subjectId, status) {
    if (!["active", "suspended", "revoked"].includes(status)) throw new Error("Invalid fixture subject status.");
    const timestamp = new Date(Number(this.clock())).toISOString();
    const result = this.db.prepare("UPDATE authorization_subjects SET status=?,updated_at=? WHERE id=?")
      .run(status, timestamp, String(subjectId || ""));
    return Number(result.changes) === 1;
  }
}

class IdentitySessionContext {
  constructor(repository) {
    this.repository = repository;
    this.sessionId = null;
  }

  establish(compactJws) {
    const session = this.repository.startAssertion(compactJws);
    this.sessionId = session.id;
    return session;
  }

  getSubjectId() {
    const session = this.repository.resolveActive(this.sessionId);
    if (!session) this.sessionId = null;
    return session?.subjectId || null;
  }

  getStatus() {
    if (!this.sessionId) return { enrolled: false, session: null };
    const active = this.repository.resolveActive(this.sessionId);
    if (!active) { this.sessionId = null; return { enrolled: false, session: null }; }
    return { enrolled: true, session: active };
  }

  signOut() {
    if (!this.sessionId) return false;
    const id = this.sessionId;
    this.sessionId = null;
    return this.repository.revokeSelf(id);
  }
}

module.exports = { IdentitySessionContext, IdentitySessionRepository };
