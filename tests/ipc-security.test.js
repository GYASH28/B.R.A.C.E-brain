"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertTrustedIpcSender,
  isTrustedIpcSender,
} = require("../electron/ipc-security");
const { schemas, validateIpcArguments } = require("../electron/ipc-contracts");

function eventFor(url, options = {}) {
  const frame = { url };
  const sender = {
    id: options.id || 7,
    mainFrame: frame,
    getURL: () => url,
  };
  return {
    sender,
    senderFrame: options.child ? { url } : frame,
  };
}

test("production IPC accepts only the BRACE main frame", () => {
  assert.equal(isTrustedIpcSender(eventFor("brain://app/index.html"), { development: false, expectedWebContentsId: 7 }), true);
  assert.equal(isTrustedIpcSender(eventFor("https://example.com/"), { development: false }), false);
  assert.equal(isTrustedIpcSender(eventFor("brain://evil/index.html"), { development: false }), false);
  assert.equal(isTrustedIpcSender(eventFor("brain://app/index.html", { child: true }), { development: false }), false);
  assert.equal(isTrustedIpcSender(eventFor("brain://app/index.html"), { development: false, expectedWebContentsId: 8 }), false);
  assert.throws(() => assertTrustedIpcSender(eventFor("https://example.com/"), { development: false }), /untrusted/i);
});

test("development IPC remains exact loopback only", () => {
  assert.equal(isTrustedIpcSender(eventFor("http://127.0.0.1:3000/"), { development: true }), true);
  assert.equal(isTrustedIpcSender(eventFor("http://localhost:3000/"), { development: true }), false);
  assert.equal(isTrustedIpcSender(eventFor("http://127.0.0.1:3001/"), { development: true }), false);
});

test("every privileged IPC handler has exactly one runtime contract", () => {
  const service = fs.readFileSync(path.resolve(__dirname, "../electron/memory-service.ts"), "utf8");
  const registered = [...service.matchAll(/trustedHandle\("(brace:[^"]+)"/g)].map((match) => match[1]);
  const registeredSet = new Set(registered);
  const schemaChannels = [...schemas.keys()];
  assert.equal(registered.length, registeredSet.size, "privileged IPC channels must not be registered twice");
  assert.deepEqual(
    [...registeredSet].sort(),
    schemaChannels.sort(),
    "runtime IPC schema coverage must exactly match privileged handler registration",
  );
});

test("IPC schemas reject malformed and oversized privileged calls", () => {
  assert.deepEqual(validateIpcArguments("brace:get-snapshot", []), []);
  assert.throws(() => validateIpcArguments("brace:get-snapshot", ["unexpected"]), /Invalid BRACE IPC request/);
  assert.throws(
    () => validateIpcArguments("brace:run-assistant", [{
      client: "codex",
      prompt: "x".repeat(12_001),
      contextId: "fixture-context",
    }]),
    /Invalid BRACE IPC request/,
  );
  assert.deepEqual(
    validateIpcArguments("brace:prepare-assistant-context", [{ client: "codex", prompt: "What changed?" }]),
    [{ client: "codex", prompt: "What changed?" }],
  );
  assert.deepEqual(
    validateIpcArguments("brace:run-assistant", [{ client: "claude", prompt: "Summarize", contextId: "ctx-1" }]),
    [{ client: "claude", prompt: "Summarize", contextId: "ctx-1" }],
  );
  assert.deepEqual(validateIpcArguments("brace:cancel-project-index", ["task-1"]), ["task-1"]);
  assert.deepEqual(validateIpcArguments("brace:get-diagnostics", []), []);
  assert.deepEqual(validateIpcArguments("brace:stage-restore", []), []);
  assert.deepEqual(validateIpcArguments("brace:cancel-pending-restore", []), []);
  assert.deepEqual(validateIpcArguments("brace:export-support-bundle", []), []);
  assert.throws(
    () => validateIpcArguments("brace:set-embedding-config", [{
      enabled: true,
      endpoint: "http://127.0.0.1:11434",
      model: "nomic-embed-text",
      extra: true,
    }]),
    /Invalid BRACE IPC request/,
  );
  assert.throws(() => validateIpcArguments("brace:copy-text", ["x".repeat(200_001)]), /Invalid BRACE IPC request/);
  assert.deepEqual(validateIpcArguments("brace:install-connector", ["generic", "remember"]), ["generic", "remember"]);
});
