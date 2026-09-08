"use strict";

const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { verifyIdentityAssertion } = require("../core/identity-assertion");
const { MemoryStore, SCHEMA_VERSION } = require("../core/memory-store");
const { IdentitySessionContext } = require("../core/repositories/identity-session-repository");

const NOW = Date.parse("2026-09-07T12:00:00.000Z");
const ISSUER = "https://identity.example.test";
const AUDIENCE = "brace-desktop";
const KEY_ID = "fixture-ed25519-1";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const trust = {
  issuers: [{
    issuer: ISSUER,
    audience: AUDIENCE,
    keys: [{
      kid: KEY_ID,
      alg: "EdDSA",
      publicKeyPem: publicKey.export({ format: "pem", type: "spki" }),
    }],
  }],
};

function encode(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }

function assertion(claimOverrides = {}, headerOverrides = {}) {
  const issued = Math.floor(NOW / 1000);
  const header = { alg: "EdDSA", typ: "JWT", kid: KEY_ID, ...headerOverrides };
  const claims = {
    iss: ISSUER,
    sub: "employee-42",
    aud: AUDIENCE,
    iat: issued - 30,
    exp: issued + 3_600,
    jti: `assertion-${Math.random().toString(16).slice(2)}`,
    sid: `provider-session-${Math.random().toString(16).slice(2)}`,
    kind: "human",
    name: "Synthetic Employee",
    email: "employee@example.test",
    ...claimOverrides,
  };
  const signingInput = `${encode(header)}.${encode(claims)}`;
  return `${signingInput}.${sign(null, Buffer.from(signingInput), privateKey).toString("base64url")}`;
}

function expectCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code);
}

function fixture(context, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-identity-"));
  const databasePath = path.join(directory, "brace.sqlite3");
  const store = new MemoryStore(databasePath, { identityTrust: trust, clock: () => NOW, ...options });
  context.after(() => {
    try { store.close(); } catch {}
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  return { directory, databasePath, store };
}

test("identity assertions require a trusted Ed25519 issuer, audience, human, and bounded lifetime", () => {
  const compact = assertion({ jti: "valid-proof", sid: "valid-provider-session" });
  const proof = verifyIdentityAssertion(compact, trust, { clock: () => NOW });
  assert.equal(proof.issuer, ISSUER);
  assert.equal(proof.providerSubject, "employee-42");
  assert.equal(proof.email, "employee@example.test");
  assert.match(proof.assertionHash, /^[a-f0-9]{64}$/);

  const parts = compact.split(".");
  const changedPayload = encode({
    iss: ISSUER, sub: "attacker", aud: AUDIENCE,
    iat: Math.floor(NOW / 1000), exp: Math.floor(NOW / 1000) + 600,
    jti: "tampered", sid: "tampered", kind: "human",
  });
  expectCode(
    () => verifyIdentityAssertion(`${parts[0]}.${changedPayload}.${parts[2]}`, trust, { clock: () => NOW }),
    "IDENTITY_SIGNATURE_INVALID",
  );
  expectCode(() => verifyIdentityAssertion(assertion({}, { alg: "none" }), trust, { clock: () => NOW }), "IDENTITY_ASSERTION_INVALID");
  expectCode(() => verifyIdentityAssertion(assertion({ aud: "another-app" }), trust, { clock: () => NOW }), "IDENTITY_AUDIENCE_MISMATCH");
  expectCode(() => verifyIdentityAssertion(assertion(), { issuers: [] }, { clock: () => NOW }), "IDENTITY_ISSUER_UNTRUSTED");
  expectCode(() => verifyIdentityAssertion(assertion({ kind: "service" }), trust, { clock: () => NOW }), "IDENTITY_INTERACTIVE_HUMAN_REQUIRED");
  expectCode(() => verifyIdentityAssertion(assertion({ exp: Math.floor(NOW / 1000) }), trust, { clock: () => NOW }), "IDENTITY_ASSERTION_EXPIRED");
  expectCode(() => verifyIdentityAssertion(assertion({ iat: Math.floor(NOW / 1000) + 120 }), trust, { clock: () => NOW }), "IDENTITY_ASSERTION_NOT_YET_VALID");
  expectCode(() => verifyIdentityAssertion(assertion({ exp: Math.floor(NOW / 1000) + 43_201 }), trust, { clock: () => NOW }), "IDENTITY_ASSERTION_INVALID");
  expectCode(() => verifyIdentityAssertion(assertion({ nonce: "unsupported" }), trust, { clock: () => NOW }), "IDENTITY_ASSERTION_INVALID");
});

test("verified sessions bind active subjects without storing or returning the raw assertion", (context) => {
  const { store } = fixture(context);
  const compact = assertion({ jti: "single-use-jti", sid: "single-provider-session" });
  const session = store.startIdentitySession(compact);
  assert.equal(store.stats().schemaVersion, 11);
  assert.equal(store.stats().identitySessions, 1);
  assert.equal(session.status, "active");
  assert.equal(Object.hasOwn(session, "providerSessionId"), false);
  assert.equal(Object.hasOwn(session, "assertionHash"), false);
  assert.equal(Object.hasOwn(session, "assertionJti"), false);
  const stored = store.db.prepare("SELECT * FROM identity_sessions WHERE id=?").get(session.id);
  assert.match(stored.assertion_hash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(stored).includes(compact), false);
  const subject = store.db.prepare("SELECT * FROM authorization_subjects WHERE id=?").get(session.subjectId);
  assert.equal(subject.kind, "human");
  assert.equal(subject.status, "active");
  assert.ok(subject.verified_at);
  expectCode(() => store.startIdentitySession(compact), "IDENTITY_ASSERTION_REPLAYED");
});

test("session authorization rechecks expiry and subject status and sign-out revokes immediately", (context) => {
  const { store } = fixture(context);
  const contextOne = new IdentitySessionContext(store.identitySessions);
  const first = contextOne.establish(assertion({ jti: "context-one", sid: "context-one" }));
  assert.equal(contextOne.getSubjectId(), first.subjectId);
  assert.equal(store.setAuthorizationSubjectStatusForFixture(first.subjectId, "suspended"), true);
  assert.equal(contextOne.getSubjectId(), null);

  assert.equal(store.setAuthorizationSubjectStatusForFixture(first.subjectId, "active"), true);
  const contextTwo = new IdentitySessionContext(store.identitySessions);
  const second = contextTwo.establish(assertion({ jti: "context-two", sid: "context-two" }));
  assert.equal(contextTwo.getStatus().enrolled, true);
  assert.equal(contextTwo.signOut(), true);
  assert.equal(contextTwo.getSubjectId(), null);
  assert.equal(store.getIdentitySession(second.id).status, "revoked");

  let mutableNow = NOW;
  const expiringStore = new MemoryStore(":memory:", { identityTrust: trust, clock: () => mutableNow });
  const expiring = expiringStore.startIdentitySession(assertion({
    jti: "expiring", sid: "expiring", exp: Math.floor(NOW / 1000) + 2,
  }));
  mutableNow += 3_000;
  assert.equal(expiringStore.resolveActiveIdentitySession(expiring.id), null);
  assert.equal(expiringStore.getIdentitySession(expiring.id).status, "expired");
  expiringStore.close();
});

test("schema v8 profiles receive the identity-session table without inferred sessions", (context) => {
  const { databasePath, store } = fixture(context);
  store.db.exec("DROP TABLE identity_sessions; PRAGMA user_version=8;");
  store.close();
  const migrated = new MemoryStore(databasePath, { identityTrust: trust, clock: () => NOW });
  assert.equal(SCHEMA_VERSION, 11);
  assert.equal(migrated.stats().schemaVersion, 11);
  assert.equal(migrated.stats().identitySessions, 0);
  assert.ok(migrated.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='identity_sessions'").get());
  migrated.close();
});
