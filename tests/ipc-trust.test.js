import assert from "node:assert/strict";
import test from "node:test";
import { isTrustedRendererUrl } from "../electron/ipc-trust.ts";

test("packaged IPC accepts only the BRACE application origin", () => {
  const policy = { development: false };
  assert.equal(isTrustedRendererUrl("brain://app/index.html", policy), true);
  assert.equal(isTrustedRendererUrl("brain://app/settings/index.html", policy), true);
  assert.equal(isTrustedRendererUrl("brain://evil/index.html", policy), false);
  assert.equal(isTrustedRendererUrl("https://app.example/index.html", policy), false);
  assert.equal(isTrustedRendererUrl("file:///tmp/index.html", policy), false);
});

test("development IPC is restricted to the exact loopback renderer", () => {
  const policy = { development: true };
  assert.equal(isTrustedRendererUrl("http://127.0.0.1:3000/", policy), true);
  assert.equal(isTrustedRendererUrl("http://127.0.0.1:3000/graph", policy), true);
  assert.equal(isTrustedRendererUrl("http://localhost:3000/", policy), false);
  assert.equal(isTrustedRendererUrl("http://127.0.0.1:3001/", policy), false);
  assert.equal(isTrustedRendererUrl("http://127.0.0.1.evil.example:3000/", policy), false);
  assert.equal(isTrustedRendererUrl("not a url", policy), false);
});
