const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  contentSecurityPolicy,
  createSecureAssetResponse,
  inlineScriptHashes,
} = require("../electron/secure-asset-response");

test("Electron asset CSP permits only the exact inline Next.js bootstrap scripts", () => {
  const first = "self.__next_f=self.__next_f||[]";
  const second = "self.__next_f.push([0])";
  const html = Buffer.from(
    `<script>${first}</script><script src="/bundle.js"></script><script>${second}</script>`,
  );
  const expected = [first, second].map((source) =>
    createHash("sha256").update(source).digest("base64"),
  );

  assert.deepEqual(inlineScriptHashes(html.toString()), expected);
  const policy = contentSecurityPolicy(html, "text/html; charset=utf-8");
  for (const hash of expected) assert.match(policy, new RegExp(`sha256-${hash.replace(/[+/]/g, "\\$&")}`));
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(policy, /script-src[^;]*brain:/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /base-uri 'none'/);
});

test("Electron serves local assets without file URL fetching and adds defense headers", async (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brace-secure-asset-test-"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const filePath = path.join(temporaryRoot, "index.html");
  fs.writeFileSync(filePath, "<!doctype html><script>window.ready=true</script>");

  const response = await createSecureAssetResponse(filePath);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(await response.text(), "<!doctype html><script>window.ready=true</script>");
});
