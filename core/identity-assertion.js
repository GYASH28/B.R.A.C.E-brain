"use strict";

const { createHash, createPublicKey, verify } = require("node:crypto");

const MAX_ASSERTION_BYTES = 16 * 1024;
const MAX_SESSION_SECONDS = 12 * 60 * 60;
const CLOCK_SKEW_SECONDS = 60;
const verifiedProofs = new WeakSet();

function identityError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function decodePart(value, label) {
  if (typeof value !== "string" || !value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw identityError("IDENTITY_ASSERTION_INVALID", `The identity ${label} is not valid base64url data.`);
  }
  const decoded = Buffer.from(value, "base64url");
  if (!decoded.length || decoded.toString("base64url") !== value) {
    throw identityError("IDENTITY_ASSERTION_INVALID", `The identity ${label} is not canonical base64url data.`);
  }
  return decoded;
}

function parseObject(buffer, label) {
  let value;
  try { value = JSON.parse(buffer.toString("utf8")); }
  catch { throw identityError("IDENTITY_ASSERTION_INVALID", `The identity ${label} is not valid JSON.`); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw identityError("IDENTITY_ASSERTION_INVALID", `The identity ${label} must be a JSON object.`);
  }
  return value;
}

function boundedIdentifier(value, label, maximum = 240) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    throw identityError("IDENTITY_ASSERTION_INVALID", `The identity assertion has an invalid ${label}.`);
  }
  return value.trim();
}

function exactAudience(value, expected) {
  if (typeof value === "string") return value === expected;
  return Array.isArray(value) && value.length > 0 && value.length <= 8
    && value.every((entry) => typeof entry === "string" && entry.length <= 240)
    && value.includes(expected);
}

function normalizeTrust(input) {
  const issuers = Array.isArray(input?.issuers) ? input.issuers : [];
  return issuers.slice(0, 32).map((entry) => ({
    issuer: String(entry?.issuer || ""),
    audience: String(entry?.audience || ""),
    keys: Array.isArray(entry?.keys) ? entry.keys.slice(0, 12) : [],
  }));
}

function verifyIdentityAssertion(compactJws, trustConfig, options = {}) {
  if (typeof compactJws !== "string" || !compactJws || Buffer.byteLength(compactJws) > MAX_ASSERTION_BYTES) {
    throw identityError("IDENTITY_ASSERTION_INVALID", "The identity assertion is missing or exceeds the size limit.");
  }
  const parts = compactJws.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw identityError("IDENTITY_ASSERTION_INVALID", "The identity assertion must be a compact signed JWS.");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseObject(decodePart(encodedHeader, "header"), "header");
  const headerKeys = Object.keys(header).sort();
  if (headerKeys.some((key) => !["alg", "kid", "typ"].includes(key)) || header.alg !== "EdDSA" || header.typ !== "JWT") {
    throw identityError("IDENTITY_ASSERTION_INVALID", "The identity assertion must use a bounded EdDSA JWT header.");
  }
  const kid = boundedIdentifier(header.kid, "key id", 160);
  const claims = parseObject(decodePart(encodedPayload, "payload"), "payload");
  const issuer = boundedIdentifier(claims.iss, "issuer", 500);
  let issuerUrl;
  try { issuerUrl = new URL(issuer); }
  catch { throw identityError("IDENTITY_ASSERTION_INVALID", "The identity issuer must be an HTTPS URL."); }
  if (issuerUrl.protocol !== "https:" || issuerUrl.username || issuerUrl.password || issuerUrl.hash) {
    throw identityError("IDENTITY_ASSERTION_INVALID", "The identity issuer must be an HTTPS origin or path without credentials or fragments.");
  }
  const trustedIssuer = normalizeTrust(trustConfig).find((entry) => entry.issuer === issuer);
  if (!trustedIssuer) throw identityError("IDENTITY_ISSUER_UNTRUSTED", "The identity issuer is not trusted by this BRACE deployment.");
  const audience = boundedIdentifier(trustedIssuer.audience, "audience", 240);
  if (!exactAudience(claims.aud, audience)) {
    throw identityError("IDENTITY_AUDIENCE_MISMATCH", "The identity assertion was not issued for this BRACE deployment.");
  }
  const trustedKey = trustedIssuer.keys.find((entry) => entry?.kid === kid && entry?.alg === "EdDSA");
  if (!trustedKey || typeof trustedKey.publicKeyPem !== "string" || trustedKey.publicKeyPem.length > 8_192) {
    throw identityError("IDENTITY_KEY_UNTRUSTED", "The identity signing key is not trusted by this BRACE deployment.");
  }
  let publicKey;
  try { publicKey = createPublicKey(trustedKey.publicKeyPem); }
  catch { throw identityError("IDENTITY_KEY_INVALID", "The configured identity signing key is invalid."); }
  if (publicKey.asymmetricKeyType !== "ed25519") {
    throw identityError("IDENTITY_KEY_INVALID", "The configured identity signing key must be Ed25519.");
  }
  const signature = decodePart(encodedSignature, "signature");
  if (signature.length !== 64 || !verify(null, Buffer.from(`${encodedHeader}.${encodedPayload}`), publicKey, signature)) {
    throw identityError("IDENTITY_SIGNATURE_INVALID", "The identity assertion signature is invalid.");
  }

  const allowedClaims = new Set(["iss", "sub", "aud", "iat", "exp", "jti", "sid", "kind", "name", "email"]);
  if (Object.keys(claims).some((key) => !allowedClaims.has(key))) {
    throw identityError("IDENTITY_ASSERTION_INVALID", "The identity assertion contains unsupported claims.");
  }
  const providerSubject = boundedIdentifier(claims.sub, "subject", 254);
  const jti = boundedIdentifier(claims.jti, "assertion id", 240);
  const providerSessionId = boundedIdentifier(claims.sid, "session id", 240);
  if (claims.kind !== "human") {
    throw identityError("IDENTITY_INTERACTIVE_HUMAN_REQUIRED", "Interactive company enrollment requires a verified human identity.");
  }
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp)) {
    throw identityError("IDENTITY_ASSERTION_INVALID", "The identity assertion timestamps must be integer seconds.");
  }
  const clock = typeof options.clock === "function" ? options.clock : Date.now;
  const nowSeconds = Math.floor(Number(clock()) / 1000);
  if (claims.iat > nowSeconds + CLOCK_SKEW_SECONDS) {
    throw identityError("IDENTITY_ASSERTION_NOT_YET_VALID", "The identity assertion was issued in the future.");
  }
  if (claims.exp <= nowSeconds) {
    throw identityError("IDENTITY_ASSERTION_EXPIRED", "The identity assertion has expired.");
  }
  if (claims.exp <= claims.iat || claims.exp - claims.iat > MAX_SESSION_SECONDS) {
    throw identityError("IDENTITY_ASSERTION_INVALID", "The identity assertion lifetime exceeds the twelve-hour deployment limit.");
  }
  const name = claims.name === undefined ? null : boundedIdentifier(claims.name, "display name", 120);
  const email = claims.email === undefined ? null : boundedIdentifier(claims.email, "email", 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw identityError("IDENTITY_ASSERTION_INVALID", "The identity assertion email is malformed.");
  }
  const proof = Object.freeze({
    issuer,
    audience,
    providerSubject,
    providerSessionId,
    jti,
    kind: "human",
    name,
    email,
    issuedAt: new Date(claims.iat * 1000).toISOString(),
    expiresAt: new Date(claims.exp * 1000).toISOString(),
    assertionHash: createHash("sha256").update(compactJws).digest("hex"),
  });
  verifiedProofs.add(proof);
  return proof;
}

function isVerifiedIdentityProof(value) { return Boolean(value && verifiedProofs.has(value)); }

module.exports = {
  CLOCK_SKEW_SECONDS,
  MAX_ASSERTION_BYTES,
  MAX_SESSION_SECONDS,
  isVerifiedIdentityProof,
  verifyIdentityAssertion,
};
