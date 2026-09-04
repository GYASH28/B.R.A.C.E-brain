"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { summarizeIndexOutcome } = require("../src/lib/brace/index-outcome");

test("project index outcome reports changed and exceptional work without implying source mutation", () => {
  const message = summarizeIndexOutcome({
    indexed: 12,
    unchanged: 80,
    removed: 2,
    redactedFiles: 3,
    skippedBinary: 4,
    fileErrors: 1,
    filesSeen: 99,
    truncated: true,
  });
  assert.match(message, /12 changed/);
  assert.match(message, /80 unchanged/);
  assert.match(message, /2 removed from index/);
  assert.match(message, /3 files had sensitive patterns redacted in BRACE/);
  assert.match(message, /4 binary files skipped/);
  assert.match(message, /1 unreadable item skipped/);
  assert.match(message, /scan limit reached after 99 files/);
  assert.match(message, /Original files were not changed/);
});

test("refresh wording stays concise when no exceptional conditions occurred", () => {
  const message = summarizeIndexOutcome({ indexed: 0, unchanged: 24, removed: 0 }, { refresh: true });
  assert.equal(message, "Project index refreshed. 0 changed · 24 unchanged. Original files were not changed.");
});
