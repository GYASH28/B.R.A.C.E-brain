"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  connectorHealth,
  inspectJsonConfig,
  loadJsonConfigForWrite,
} = require("../core/connector-health");

test("missing JSON configuration is safe and treated as not configured yet", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brace-connector-"));
  const filePath = path.join(root, "missing.json");
  const state = inspectJsonConfig(filePath);
  assert.deepEqual(state, { exists: false, readable: true, valid: true, value: {}, error: null });
  assert.deepEqual(loadJsonConfigForWrite(filePath), {});
  assert.equal(connectorHealth({ id: "claude", detected: true, configured: false, configState: state }).status, "needs-setup");
  fs.rmSync(root, { recursive: true, force: true });
});

test("valid configured client is ready and preserves configuration for write", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brace-connector-"));
  const filePath = path.join(root, "client.json");
  const expected = { mcpServers: { existing: { command: "other" }, brace: { command: "brace" } }, setting: true };
  fs.writeFileSync(filePath, JSON.stringify(expected));
  const state = inspectJsonConfig(filePath);
  assert.equal(state.valid, true);
  assert.deepEqual(loadJsonConfigForWrite(filePath), expected);
  assert.equal(connectorHealth({ id: "claude", detected: true, configured: true, configState: state }).status, "ready");
  fs.rmSync(root, { recursive: true, force: true });
});

test("malformed JSON is a blocking configuration error and cannot be loaded for write", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brace-connector-"));
  const filePath = path.join(root, "broken.json");
  const original = "{ not valid json";
  fs.writeFileSync(filePath, original);
  const state = inspectJsonConfig(filePath);
  assert.equal(state.exists, true);
  assert.equal(state.valid, false);
  assert.match(state.error, /not valid JSON/i);
  const health = connectorHealth({ id: "antigravity", detected: true, configured: false, configState: state });
  assert.equal(health.status, "config-error");
  assert.match(health.detail, /attention|valid JSON/i);
  assert.throws(
    () => loadJsonConfigForWrite(filePath),
    (error) => error && error.code === "BRACE_CONNECTOR_CONFIG_INVALID" && /did not modify/i.test(error.message),
  );
  assert.equal(fs.readFileSync(filePath, "utf8"), original);
  fs.rmSync(root, { recursive: true, force: true });
});

test("missing executable and generic/manual clients have distinct health states", () => {
  assert.equal(connectorHealth({ id: "codex", detected: false, configured: false }).status, "client-missing");
  assert.equal(connectorHealth({ id: "generic", detected: true, configured: false }).status, "manual");
});
