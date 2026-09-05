"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MemoryStore } = require("../core/memory-store");
const { executeImports, previewImports, publicPreview } = require("../core/import-adapters");

test("preview-first imports preserve originals, redact documents, and deduplicate profiles", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-import-"));
  const databasePath = path.join(directory, "state", "brace.sqlite3");
  const documentPath = path.join(directory, "notes.md");
  const profilePath = path.join(directory, "profile.json");
  const original = "# Architecture\n\nUse a local graph. password=synthetic-secret-value";
  fs.writeFileSync(documentPath, original);
  fs.writeFileSync(profilePath, JSON.stringify({
    schemaVersion: 6,
    memories: [{
      status: "active",
      kind: "decision",
      scope: "global",
      title: "Keep imports local",
      summary: "Originals remain untouched.",
      content: "Import content without rewriting selected files.",
      tags: ["import"],
      evidence: [{ outcome: "promoted", summary: "Synthetic fixture", reference: "brace-test://fixture" }],
    }],
  }));
  const store = new MemoryStore(databasePath);
  context.after(() => {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const preview = previewImports([documentPath, profilePath]);
  assert.deepEqual(preview.summary, { documents: 1, profiles: 1, memories: 1, bytes: fs.statSync(documentPath).size + fs.statSync(profilePath).size, unsupported: 0 });
  assert.equal(Object.hasOwn(publicPreview(preview).entries[0], "filePath"), false);
  const result = executeImports(store, preview);
  assert.equal(result.documents, 1);
  assert.equal(result.memories, 1);
  assert.equal(result.evidence, 1);
  assert.equal(result.redactions, 1);
  assert.equal(fs.readFileSync(documentPath, "utf8"), original);
  const source = store.searchSources("architecture", { limit: 5 }).results[0];
  assert.match(source.content, /REDACTED (?:PASSWORD|GENERIC-SECRET)/);
  assert.doesNotMatch(source.sourceUri, /brace-import-|synthetic-secret-value/);
  const repeated = executeImports(store, preview);
  assert.equal(repeated.duplicates, 1);
});
