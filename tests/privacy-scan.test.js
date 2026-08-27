const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const excluded = new Set([
  ".git",
  ".next",
  ".vercel",
  "node_modules",
  "out",
  "dist",
  "artifacts",
]);
const ignoredFiles = new Set(["package-lock.json", "bun.lock"]);
const binaryExtensions = new Set([
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".woff",
  ".woff2",
]);

function publicTextFiles(directory, relative = "") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || ignoredFiles.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const child = relative ? path.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...publicTextFiles(absolute, child));
    else if (!binaryExtensions.has(path.extname(entry.name).toLowerCase())) files.push(child);
  }
  return files;
}

test("public candidate tree contains no machine paths, private seed snapshots, or secret tokens", () => {
  const violations = [];
  const patterns = [
    [/(?:^|["'\s])\/home\/[A-Za-z0-9._-]+\//g, "Linux home path"],
    [/[A-Za-z]:\\\\Users\\\\[^\\\s"']+/g, "Windows user path"],
    [/\b(?:ghp|github_pat|glpat|xox[baprs])[-_A-Za-z0-9]{16,}\b/g, "access token"],
    [/\b(?:sk|rk)-[A-Za-z0-9_-]{16,}\b/g, "API key"],
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "private key"],
  ];
  for (const file of publicTextFiles(root)) {
    const content = fs.readFileSync(path.join(root, file), "utf8");
    for (const [pattern, label] of patterns) {
      if (pattern.test(content)) violations.push(`${file}: ${label}`);
      pattern.lastIndex = 0;
    }
  }
  assert.equal(
    fs.existsSync(path.join(root, "src/lib/second-brain/vault-nodes.json")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(root, "src/lib/second-brain/seed-data.ts")),
    false,
  );
  assert.deepEqual(violations, []);
});

test("public candidate tree contains no generated memory payloads or local skill source", () => {
  const violations = [];
  for (const file of publicTextFiles(root)) {
    const normalized = file.split(path.sep).join("/");
    if (/\.(?:sqlite3?|db|backup|bak|export\.json)$/i.test(normalized)) {
      violations.push(`${normalized}: generated memory payload`);
    }
    if (/(^|\/)\.codex\/skills\/|(^|\/)scrollcraft\/(?:engine|references|SKILL\.md)/i.test(normalized)) {
      violations.push(`${normalized}: local skill source`);
    }
  }
  assert.deepEqual(violations, []);
});
