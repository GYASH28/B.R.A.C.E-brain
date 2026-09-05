"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("public website deployment declares restrictive security headers", () => {
  const config = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../website/builds/brace/vercel.json"), "utf8"),
  );
  const global = config.headers.find((entry) => entry.source === "/(.*)");
  assert.ok(global, "global header rule should exist");
  const headers = Object.fromEntries(
    global.headers.map((header) => [header.key.toLowerCase(), header.value]),
  );
  assert.match(headers["content-security-policy"], /default-src 'self'/);
  assert.match(headers["content-security-policy"], /script-src 'self'/);
  assert.match(headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(headers["content-security-policy"], /object-src 'none'/);
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["x-frame-options"], "DENY");
  assert.ok(headers["permissions-policy"]);
  assert.ok(headers["referrer-policy"]);
});
