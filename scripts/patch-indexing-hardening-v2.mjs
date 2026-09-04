#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const original = path.join(root, "scripts/patch-indexing-hardening.mjs");
let source = fs.readFileSync(original, "utf8");
source = source.replace(
  "store = store.replace(search, replacement);",
  "store = store.replace(search, () => replacement);",
);
source = source.replace(
  "indexer = indexer.replace(search, replacement);",
  "indexer = indexer.replace(search, () => replacement);",
);
// One direct replacement later in the patcher also contains generated source;
// make it functional for the same literal-replacement guarantee.
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
