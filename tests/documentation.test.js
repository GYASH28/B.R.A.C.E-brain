const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function markdownFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(absolute);
    return path.extname(entry.name) === ".md" ? [absolute] : [];
  });
}

test("public Markdown links resolve inside the repository", () => {
  const files = [
    ...markdownFiles(path.join(root, "docs")),
    ...["README.md", "CONTRIBUTING.md", "SECURITY.md", "ROADMAP.md", "CHANGELOG.md", "THIRD_PARTY_NOTICES.md"].map((file) => path.join(root, file)),
  ];
  const missing = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const raw = match[1].trim().replace(/^<|>$/g, "");
      if (/^(?:https?:|mailto:|#)/.test(raw)) continue;
      const target = decodeURIComponent(raw.split("#")[0]);
      if (!target) continue;
      if (!fs.existsSync(path.resolve(path.dirname(file), target))) {
        missing.push(`${path.relative(root, file)} -> ${raw}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test("launch and How-to pages reference existing local assets and fragments", () => {
  const siteRoot = path.join(root, "website", "builds", "brace");
  const pages = [path.join(siteRoot, "index.html"), path.join(siteRoot, "how-to", "index.html")];
  const missing = [];
  for (const page of pages) {
    const content = fs.readFileSync(page, "utf8");
    const ids = new Set([...content.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
    for (const match of content.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const raw = match[1];
      if (/^(?:https?:|mailto:|data:)/.test(raw)) continue;
      if (raw.startsWith("#")) {
        if (!ids.has(raw.slice(1))) missing.push(`${path.relative(root, page)} -> ${raw}`);
        continue;
      }
      const target = raw.startsWith("/")
        ? path.join(siteRoot, raw)
        : path.resolve(path.dirname(page), raw.split("#")[0]);
      const resolved = target.endsWith(path.sep) ? path.join(target, "index.html") : target;
      if (!fs.existsSync(resolved)) missing.push(`${path.relative(root, page)} -> ${raw}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("public release infrastructure is present", () => {
  for (const file of [
    ".github/workflows/ci.yml",
    ".github/workflows/codeql.yml",
    ".github/workflows/pages.yml",
    ".github/workflows/release.yml",
    ".github/dependabot.yml",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/ISSUE_TEMPLATE/bug.yml",
    ".github/ISSUE_TEMPLATE/feature.yml",
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} is missing`);
  }
});
