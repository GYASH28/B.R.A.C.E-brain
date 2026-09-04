"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { connectorHealth, inspectJsonConfig } = require("../core/connector-health");

test("missing JSON configuration is safe and treated as not configured yet", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brace-connector-"));
  const state = inspectJsonConfig(path.join(root, "missing.json"));
  assert.deepEqual(state, { exists: false, readable: true, valid: true, value: {}, error: null });
  assert.equal(connectorHealth({ id: "claude", detected: true, configured: false, configState: state }).status, "needs-setup");
  fs.rmSync(root, { recursive: true, force: true });
});

test("valid configured client is ready", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brace-connector-"));
  const filePath = path.join(root, "client.json");
  fs.writeFileSync(filePath, JSON.stringify({ mcpServers: { brace: { command: "brace" } } }));
  const state = inspectJsonConfig(filePath);
  assert.equal(state.valid, true);
  assert.equal(connectorHealth({ id: "claude", detected: true, configured: true, configState: state }).status, "ready");
  fs.rmSync(root, { recursive: true, force: true });
});

test("malformed JSON is a blocking configuration error rather than an empty config", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brace-connector-"));
  const filePath = path.join(root, "broken.json");
  fs.writeFileSync(filePath, "{ not valid json");
  const state = inspectJsonConfig(filePath);
  assert.equal(state.exists, true);
  assert.equal(state.valid, false);
  assert.match(state.error, /not valid JSON/i);
  const health = connectorHealth({ id: "antigravity", detected: true, configured: false, configState: state });
  assert.equal(health.status, "config-error");
  assert.match(health.detail, /attention|valid JSON/i);
  fs.rmSync(root, { recursive: true, force: true });
});

test("missing executable and generic/manual clients have distinct health states", () => {
  assert.equal(connectorHealth({ id: "codex", detected: false, configured: false }).status, "client-missing");
  assert.equal(connectorHealth({ id: "generic", detected: true, configured: false }).status, "manual");
});
