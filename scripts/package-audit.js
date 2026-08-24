#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const asar = require("@electron/asar");

const root = path.resolve(__dirname, "..");
const requested = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "dist", "installer", "linux-unpacked", "resources", "app.asar");
if (!fs.existsSync(requested) || !fs.statSync(requested).isFile()) {
  throw new Error(`app.asar not found: ${requested}`);
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brace-package-audit-"));
const extracted = path.join(temporaryRoot, "app");
const violations = [];
const required = [
  "dist/electron/main.js",
  "dist/electron/app-main.js",
  "dist/electron/preload.js",
  "dist/mcp/brace-mcp.cjs",
  "out/index.html",
  "examples/demo-workspace/README.md",
];
const prohibitedExtensions = /\.(?:sqlite3?|db|backup|bak|export\.json)$/i;
const secretPatterns = [
  [/(?:^|["'\s])\/home\/[A-Za-z0-9._-]+\//g, "Linux home path"],
  [/[A-Za-z]:\\Users\\[^\\\s"']+/g, "Windows user path"],
  [/\b(?:ghp|github_pat|glpat|xox[baprs])[-_A-Za-z0-9]{16,}\b/g, "access token"],
  [/\b(?:sk|rk)-[A-Za-z0-9_-]{16,}\b/g, "API key"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "private key"],
];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".svg", ".txt"]);

function walk(directory, relative = "") {
  const entries = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) entries.push(...walk(absolute, child));
    else entries.push(child);
  }
  return entries;
}

try {
  asar.extractAll(requested, extracted);
  const files = walk(extracted);
  for (const expected of required) {
    if (!files.includes(expected)) violations.push(`${expected}: required payload missing`);
  }
  for (const file of files) {
    if (prohibitedExtensions.test(file) || /(^|\/)\.env(?:\.|$)/.test(file)) {
      violations.push(`${file}: prohibited runtime data`);
    }
    if (/codex|scrollcraft\/(?:SKILL|references|engine)/i.test(file)) {
      violations.push(`${file}: local skill source must not be packaged`);
    }
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    const content = fs.readFileSync(path.join(extracted, file), "utf8");
    for (const [pattern, label] of secretPatterns) {
      if (pattern.test(content)) violations.push(`${file}: ${label}`);
      pattern.lastIndex = 0;
    }
  }
  process.stdout.write(`${JSON.stringify({
    archive: path.basename(requested),
    files: files.length,
    requiredPayloads: required.length,
    violations,
  }, null, 2)}\n`);
  if (violations.length) process.exitCode = 1;
} finally {
  fs.rmSync(temporaryRoot, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}
