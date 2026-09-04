"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const app = () => fs.readFileSync("src/components/brace/brace-app.tsx", "utf8");
const privacy = () => fs.readFileSync("docs/PRIVACY.md", "utf8");

test("desktop UI does not claim application-level encryption that BRACE does not provide", () => {
  const source = app();
  assert.doesNotMatch(source, /encrypted local index/i);
  assert.match(source, /Opening your local SQLite index/i);
  assert.match(privacy(), /does not encrypt `brace\.sqlite3` at the application layer/i);
});

test("note-vault ingestion is discoverable in first-run and project UI", () => {
  const source = app();
  assert.match(source, /Choose a folder or vault/);
  assert.match(source, /Projects & note vaults/);
  assert.match(source, /Obsidian-style note vault/);
  assert.match(source, /Import folder or note vault/);
});
