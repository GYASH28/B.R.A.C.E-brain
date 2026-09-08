"use strict";

const { createCipheriv, createDecipheriv, createHash, randomBytes } = require("node:crypto");

const MAX_SYNC_PAYLOAD_BYTES = 256 * 1024;
const ENVELOPE_VERSION = 1;

function syncError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function bounded(value, label, maximum = 240) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    throw syncError("SYNC_ENVELOPE_INVALID", `The sync ${label} is invalid.`);
  }
  return value.trim();
}

function metadataForAad(input = {}) {
  const baseRevision = Number(input.baseRevision);
  const resultRevision = Number(input.resultRevision);
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0 || !Number.isSafeInteger(resultRevision) || resultRevision !== baseRevision + 1) {
    throw syncError("SYNC_ENVELOPE_INVALID", "Sync revisions must advance exactly once from a non-negative base revision.");
  }
  const operationKind = input.operationKind;
  if (!["upsert", "tombstone"].includes(operationKind)) {
    throw syncError("SYNC_ENVELOPE_INVALID", "The sync operation kind is invalid.");
  }
  const createdAt = bounded(input.createdAt, "creation time", 40);
  if (!Number.isFinite(Date.parse(createdAt))) throw syncError("SYNC_ENVELOPE_INVALID", "The sync creation time is invalid.");
  return Object.freeze({
    version: ENVELOPE_VERSION,
    operationId: bounded(input.operationId, "operation id", 128),
    organizationId: bounded(input.organizationId, "organization id", 128),
    workspaceId: bounded(input.workspaceId, "workspace id", 128),
    actorSubjectId: bounded(input.actorSubjectId, "actor subject id", 128),
    deviceId: bounded(input.deviceId, "device id", 128),
    recordType: input.recordType === "shared-memory" ? "shared-memory" : (() => { throw syncError("SYNC_ENVELOPE_INVALID", "The sync record type is invalid."); })(),
    recordId: bounded(input.recordId, "record id", 128),
    operationKind,
    baseRevision,
    resultRevision,
    keyId: bounded(input.keyId, "key id", 160),
    createdAt: new Date(createdAt).toISOString(),
  });
}

function aadBuffer(metadata) {
  const value = metadataForAad(metadata);
  return Buffer.from(JSON.stringify([
    value.version, value.operationId, value.organizationId, value.workspaceId,
    value.actorSubjectId, value.deviceId, value.recordType, value.recordId,
    value.operationKind, value.baseRevision, value.resultRevision, value.keyId,
    value.createdAt,
  ]));
}

function validatedKey(value) {
  if (!(Buffer.isBuffer(value) || value instanceof Uint8Array) || value.byteLength !== 32) {
    throw syncError("SYNC_KEY_INVALID", "The resolved workspace sync key must contain exactly 32 bytes.");
  }
  return Buffer.from(value);
}

function encryptSyncPayload(payload, metadata, keyMaterial) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw syncError("SYNC_PAYLOAD_INVALID", "A sync payload must be a JSON object.");
  }
  let plaintext;
  try { plaintext = Buffer.from(JSON.stringify(payload)); }
  catch { throw syncError("SYNC_PAYLOAD_INVALID", "The sync payload must be serializable JSON."); }
  if (!plaintext.length || plaintext.length > MAX_SYNC_PAYLOAD_BYTES) {
    plaintext.fill(0);
    throw syncError("SYNC_PAYLOAD_INVALID", "The sync payload is empty or exceeds the 256 KB limit.");
  }
  const key = validatedKey(keyMaterial);
  try {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
    cipher.setAAD(aadBuffer(metadata), { plaintextLength: plaintext.length });
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      nonce,
      ciphertext,
      authTag,
      payloadHash: createHash("sha256").update(ciphertext).update(authTag).digest("hex"),
    };
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }
}

function strictBase64(value, label, maximumBytes) {
  if (typeof value !== "string" || !value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw syncError("SYNC_ENVELOPE_INVALID", `The sync ${label} is not canonical base64.`);
  }
  const decoded = Buffer.from(value, "base64");
  if (!decoded.length || decoded.length > maximumBytes || decoded.toString("base64") !== value) {
    throw syncError("SYNC_ENVELOPE_INVALID", `The sync ${label} is not canonical base64.`);
  }
  return decoded;
}

function decryptSyncPayload(envelope, keyMaterial) {
  const metadata = metadataForAad(envelope);
  const nonce = strictBase64(envelope.nonce, "nonce", 12);
  const ciphertext = strictBase64(envelope.ciphertext, "ciphertext", MAX_SYNC_PAYLOAD_BYTES + 64);
  const authTag = strictBase64(envelope.authTag, "authentication tag", 16);
  if (nonce.length !== 12 || authTag.length !== 16) throw syncError("SYNC_ENVELOPE_INVALID", "The sync cryptographic envelope has invalid dimensions.");
  const expectedHash = createHash("sha256").update(ciphertext).update(authTag).digest("hex");
  if (envelope.payloadHash !== expectedHash) throw syncError("SYNC_ENVELOPE_INVALID", "The sync payload hash does not match its envelope.");
  const key = validatedKey(keyMaterial);
  let plaintext;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
    decipher.setAAD(aadBuffer(metadata), { plaintextLength: ciphertext.length });
    decipher.setAuthTag(authTag);
    try { plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]); }
    catch { throw syncError("SYNC_DECRYPT_FAILED", "The sync envelope failed authenticated decryption."); }
    if (!plaintext.length || plaintext.length > MAX_SYNC_PAYLOAD_BYTES) throw syncError("SYNC_PAYLOAD_INVALID", "The decrypted sync payload exceeds its safety limit.");
    let parsed;
    try { parsed = JSON.parse(plaintext.toString("utf8")); }
    catch { throw syncError("SYNC_PAYLOAD_INVALID", "The decrypted sync payload is not valid JSON."); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw syncError("SYNC_PAYLOAD_INVALID", "The decrypted sync payload must be a JSON object.");
    return parsed;
  } finally {
    key.fill(0);
    plaintext?.fill(0);
  }
}

module.exports = {
  ENVELOPE_VERSION,
  MAX_SYNC_PAYLOAD_BYTES,
  decryptSyncPayload,
  encryptSyncPayload,
  metadataForAad,
};
