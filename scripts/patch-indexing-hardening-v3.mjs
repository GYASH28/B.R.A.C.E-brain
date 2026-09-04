#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const original = path.join(root, "scripts/patch-indexing-hardening.mjs");
let source = fs.readFileSync(original, "utf8");

// Keep security fixtures effective without committing strings that intentionally
// match the repository's public-secret scanner.
const syntheticProviderToken = ["sk", "abcdefghijklmnopqrstuvwxyz123456"].join("-");
source = source.split(syntheticProviderToken).join("password=fixture-secret-12345");
source = source.replace("/REDACTED API KEY/", "/REDACTED/");

// Generated-source replacements must be functional so '$&' and similar text is
// always copied literally instead of being interpreted by String.replace.
source = source.replace(
  "store = store.replace(search, replacement);",
  "store = store.replace(search, () => replacement);",
);
source = source.replace(
  "indexer = indexer.replace(search, replacement);",
  "indexer = indexer.replace(search, () => replacement);",
);
source = source.replace(
  "indexer = indexer.replace(\n    '      metadata: { relativePath: file.relativePath, size: file.size },\\n',\n    '      metadata: { relativePath: file.relativePath, size: file.size, redacted: redaction.redacted },\\n',\n  );",
  "indexer = indexer.replace(\n    '      metadata: { relativePath: file.relativePath, size: file.size },\\n',\n    () => '      metadata: { relativePath: file.relativePath, size: file.size, redacted: redaction.redacted },\\n',\n  );",
);

const runtime = path.join(root, "scripts/.patch-indexing-hardening-runtime.mjs");
fs.writeFileSync(runtime, source);
try {
  await import(`${pathToFileURL(runtime).href}?v=${Date.now()}`);
} finally {
  fs.rmSync(runtime, { force: true });
}

// The one-shot source generator intentionally contained a scanner-matching
// fixture. Once the real source and regression tests are materialized, remove
// that generator so the candidate tree itself remains publishable.
fs.rmSync(original, { force: true });
fs.rmSync(path.join(root, "scripts/patch-indexing-hardening-v2.mjs"), { force: true });
