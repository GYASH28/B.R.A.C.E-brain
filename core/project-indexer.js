"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const TEXT_EXTENSIONS = new Set([
  ".c", ".cc", ".cpp", ".cs", ".css", ".csv", ".go", ".h", ".hpp",
  ".html", ".java", ".js", ".json", ".jsx", ".kt", ".md", ".mdx",
  ".php", ".prisma", ".py", ".rb", ".rs", ".scss", ".sh", ".sql",
  ".svelte", ".swift", ".toml", ".ts", ".tsx", ".txt", ".vue", ".xml",
  ".yaml", ".yml",
]);
const IGNORED_DIRECTORIES = new Set([
  ".git", ".hg", ".svn", ".next", ".turbo", ".cache", ".idea",
  ".vscode", ".venv", "__pycache__", "build", "coverage", "dist",
  "node_modules", "out", "target", "vendor", "venv", "_BRACE_DATA",
]);
const SENSITIVE_FILE = /^(?:\.env(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?|tokens?(?:\..*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?)$|\.(?:key|pem|p12|pfx|sqlite3?|db|log)$/i;
const CONTENT_SECRET_PATTERNS = [
  { name: "private-key", pattern: /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9]+)? PRIVATE KEY-----/g },
  { name: "aws-access-key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: "github-token", pattern: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,255}\b/g },
  { name: "generic-secret", pattern: /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[^\s"'`]{8,512}["']?/gi },
];

function assertProjectRoot(rootPath) {
  const root = path.resolve(String(rootPath || ""));
  if (!rootPath || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error("Select an existing project directory to index.");
  }
  const filesystemRoot = path.parse(root).root;
  const home = path.resolve(os.homedir());
  if (root === filesystemRoot || root === home) {
    throw new Error("Choose a specific project folder, not a filesystem or home-directory root.");
  }
  return root;
}

function isIndexableFile(name) {
  return TEXT_EXTENSIONS.has(path.extname(name).toLowerCase()) && !SENSITIVE_FILE.test(name);
}

function braceIgnorePatterns(root) {
  const ignorePath = path.join(root, ".braceignore");
  if (!fs.existsSync(ignorePath)) return [];
  return fs.readFileSync(ignorePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"))
    .slice(0, 2_000);
}

function globPattern(pattern) {
  const directoryOnly = pattern.endsWith("/");
  const anchored = pattern.startsWith("/");
  const normalized = pattern.replace(/^\/+|\/+$/g, "");
  let source = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === "*" && normalized[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (character === "*") source += "[^/]*";
    else if (character === "?") source += "[^/]";
    else source += character.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }
  const prefix = anchored || normalized.includes("/") ? "^" : "(?:^|/)";
  return new RegExp(`${prefix}${source}${directoryOnly ? "(?:/|$)" : "$"}`);
}

function isBraceIgnored(relativePath, patterns) {
  const value = String(relativePath || "").replaceAll(path.sep, "/").replace(/^\/+/, "");
  return patterns.some((pattern) => globPattern(pattern).test(value));
}

function redactContentSecrets(input) {
  let value = String(input || "");
  const findings = [];
  for (const { name, pattern } of CONTENT_SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let count = 0;
    value = value.replace(pattern, () => {
      count += 1;
      return `[REDACTED ${name.toUpperCase()}]`;
    });
    if (count) findings.push({ type: name, count });
  }
  return { value, findings, redacted: findings.reduce((sum, item) => sum + item.count, 0) };
}

function listProjectFiles(rootPath, options = {}) {
  const root = assertProjectRoot(rootPath);
  const realRoot = fs.realpathSync(root);
  const maximumFiles = Math.min(100_000, Math.max(1, Number(options.maxFiles) || 20_000));
  const maximumBytes = Math.min(20_000_000, Math.max(1_024, Number(options.maxFileBytes) || 2_000_000));
  const results = [];
  const ignored = braceIgnorePatterns(root);
  const queue = [root];
  let queueIndex = 0;
  let ignoredByRule = 0;
  let skippedLarge = 0;
  let skippedUnsupported = 0;
  const errors = [];
  while (queueIndex < queue.length) {
    if (options.signal?.aborted) throw new Error("Project indexing was cancelled.");
    const directory = queue[queueIndex];
    queueIndex += 1;
    let entries;
    try {
      const realDirectory = fs.realpathSync(directory);
      if (realDirectory !== realRoot && !realDirectory.startsWith(`${realRoot}${path.sep}`)) {
        errors.push({ path: path.relative(root, directory), code: "outside-root" });
        continue;
      }
      entries = fs.readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
    } catch (error) {
      errors.push({ path: path.relative(root, directory), code: String(error?.code || "unreadable-directory") });
      continue;
    }
    for (const entry of entries) {
      if (results.length >= maximumFiles) return { root, files: results, truncated: true, ignoredByRule, skippedLarge, skippedUnsupported, errors };
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      if (entry.isSymbolicLink()) continue;
      if (isBraceIgnored(`${relativePath}${entry.isDirectory() ? "/" : ""}`, ignored)) {
        ignoredByRule += 1;
        continue;
      }
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) queue.push(absolutePath);
        continue;
      }
      if (!entry.isFile() || !isIndexableFile(entry.name)) {
        if (entry.isFile()) skippedUnsupported += 1;
        continue;
      }
      let stat;
      try {
        stat = fs.lstatSync(absolutePath);
        const realFile = fs.realpathSync(absolutePath);
        if (!stat.isFile() || (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`))) {
          errors.push({ path: relativePath, code: "outside-root" });
          continue;
        }
      } catch (error) {
        errors.push({ path: relativePath, code: String(error?.code || "unreadable-file") });
        continue;
      }
      if (stat.size > maximumBytes) {
        skippedLarge += 1;
        continue;
      }
      results.push({
        absolutePath,
        relativePath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      });
    }
  }
  return { root, files: results, truncated: false, ignoredByRule, skippedLarge, skippedUnsupported, errors };
}

function chunkText(text, options = {}) {
  const maximum = Math.min(8_000, Math.max(400, Number(options.maxCharacters) || 1_800));
  const overlap = Math.min(500, Math.max(0, Number(options.overlapCharacters) || 160));
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const lines = normalized.split("\n");
  const sections = [];
  let heading = "";
  let buffer = [];
  const flush = () => {
    const content = buffer.join("\n").trim();
    if (content) sections.push({ heading, content });
    buffer = [];
  };
  for (const line of lines) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (match) {
      flush();
      heading = match[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();
  if (!sections.length) sections.push({ heading: "", content: normalized });

  const chunks = [];
  for (const section of sections) {
    let remaining = section.content;
    while (remaining.length > maximum) {
      let split = remaining.lastIndexOf("\n\n", maximum);
      if (split < Math.floor(maximum * 0.5)) split = remaining.lastIndexOf(" ", maximum);
      if (split < Math.floor(maximum * 0.5)) split = maximum;
      const content = remaining.slice(0, split).trim();
      if (content) chunks.push({ heading: section.heading, content });
      remaining = remaining.slice(Math.max(1, split - overlap)).trim();
    }
    if (remaining) chunks.push({ heading: section.heading, content: remaining });
  }
  return chunks;
}

function extractEntities(text) {
  const value = String(text || "");
  const entities = [];
  for (const match of value.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]{2,80})/gu)) {
    entities.push({ name: match[1], entityType: "tag", relation: "tagged_with" });
  }
  for (const match of value.matchAll(/\[\[([^\]|#]{2,160})(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)) {
    entities.push({ name: match[1].trim(), entityType: "topic", relation: "references" });
  }
  const unique = new Map();
  for (const entity of entities) {
    const key = `${entity.entityType}:${entity.name.toLocaleLowerCase("en-US")}`;
    if (!unique.has(key)) unique.set(key, entity);
  }
  return [...unique.values()].slice(0, 200);
}

function sourceUri(projectId, relativePath) {
  return `brace-project://${encodeURIComponent(projectId)}/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

async function indexProject(store, input) {
  const root = assertProjectRoot(input.rootPath);
  const project = store.upsertProject({
    id: input.projectId,
    workspaceId: input.workspaceId,
    name: input.name || path.basename(root),
    rootPath: root,
  });
  const seenUris = [];
  let indexed = 0;
  let unchanged = 0;
  let embedded = 0;
  let redacted = 0;
  const redactionTypes = new Map();
  const { runProjectIndexWorker } = require("./project-index-jobs");
  let workerResult;
  try {
    workerResult = await runProjectIndexWorker(input, async (file, fileIndex, total) => {
      if (input.signal?.aborted) throw new Error("Project indexing was cancelled.");
      input.onProgress?.({ phase: "redacting", completed: fileIndex + 1, total, indexed, unchanged, redacted });
      const uri = sourceUri(project.id, file.relativePath);
      seenUris.push(uri);
      const previous = store.getSourceByUri(uri);
      if (previous?.content_hash === file.contentHash && Number(previous.mtime_ms) === Number(file.mtimeMs)) {
        unchanged += 1;
        input.onProgress?.({ phase: "reading", completed: fileIndex + 1, total, indexed, unchanged, redacted });
        return;
      }
      redacted += file.redacted;
      for (const finding of file.redactionTypes) {
        redactionTypes.set(finding.type, (redactionTypes.get(finding.type) || 0) + finding.count);
      }
      input.onProgress?.({ phase: "chunking", completed: fileIndex + 1, total, chunks: file.chunks.length, indexed, unchanged, redacted });
      let vectors = null;
      if (input.embedder && file.chunks.length) {
        input.onProgress?.({ phase: "embedding", completed: fileIndex, total, chunks: file.chunks.length, indexed, unchanged, redacted });
        vectors = await input.embedder.embed(file.chunks.map((chunk) => chunk.content), { signal: input.signal });
        if (!Array.isArray(vectors) || vectors.length !== file.chunks.length) {
          throw new Error("The embedding adapter returned an unexpected vector count.");
        }
      }
      const committed = store.commitIndexedSource({
        projectId: project.id,
        uri,
        title: path.basename(file.relativePath),
        mediaType: file.mediaType,
        contentHash: file.contentHash,
        mtimeMs: file.mtimeMs,
        metadata: { relativePath: file.relativePath, size: file.size },
      }, file.chunks, vectors ? { model: input.embedder.model, vectors } : null);
      if (vectors) embedded += vectors.length;
      for (const item of file.entities) {
        const entity = store.upsertEntity(item);
        store.relate({
          fromType: "source",
          fromId: committed.source.id,
          toType: "entity",
          toId: entity.id,
          relation: item.relation,
          sourceId: committed.source.id,
        });
      }
      indexed += 1;
      input.onProgress?.({ phase: "reading", completed: fileIndex + 1, total, indexed, unchanged, redacted });
    });
  } catch (error) {
    if (!String(error?.message || "").toLowerCase().includes("cancel")) {
      store.insertEvent({
        eventType: "project.index.failed",
        title: `Indexing failed for ${project.name}`,
        summary: "The previous complete index remains available.",
        projectId: project.id,
        metadata: { phase: "worker-or-commit" },
      });
    }
    throw error;
  }
  const traversalErrors = [...(workerResult.errors || []), ...(workerResult.readErrors || [])];
  const partial = Boolean(
    workerResult.truncated || traversalErrors.length || workerResult.skippedUnsupportedEncoding,
  );
  input.onProgress?.({ phase: "finalizing", completed: workerResult.total, total: workerResult.total, indexed, unchanged, redacted });
  const removed = partial ? 0 : store.removeMissingSources(project.id, seenUris);
  const completedAt = new Date().toISOString();
  store.upsertProject({
    id: project.id,
    workspaceId: project.workspace_id,
    name: project.name,
    rootPath: project.root_path,
    lastIndexedAt: partial ? project.last_indexed_at : completedAt,
  });
  store.insertEvent({
    eventType: partial ? "project.index.partial" : "project.indexed",
    occurredAt: completedAt,
    title: `${partial ? "Partially indexed" : "Indexed"} ${project.name}`,
    summary: `${indexed} changed, ${unchanged} unchanged, ${removed} removed.`,
    projectId: project.id,
    metadata: {
      indexed,
      unchanged,
      removed,
      skippedBinary: workerResult.skippedBinary,
      skippedLarge: workerResult.skippedLarge,
      skippedUnsupported: workerResult.skippedUnsupported,
      skippedUnsupportedEncoding: workerResult.skippedUnsupportedEncoding,
      errors: traversalErrors.length,
      embedded,
      redacted,
      ignoredByRule: workerResult.ignoredByRule,
      truncated: workerResult.truncated,
    },
  });
  const result = {
    projectId: project.id,
    rootPath: project.root_path,
    status: partial ? "partial" : "complete",
    filesSeen: workerResult.total,
    indexed,
    unchanged,
    removed,
    skippedBinary: workerResult.skippedBinary,
    skippedLarge: workerResult.skippedLarge,
    skippedUnsupported: workerResult.skippedUnsupported,
    skippedUnsupportedEncoding: workerResult.skippedUnsupportedEncoding,
    errors: traversalErrors.length,
    embedded,
    redacted,
    redactionTypes: Object.fromEntries(redactionTypes),
    ignoredByRule: workerResult.ignoredByRule,
    truncated: workerResult.truncated,
    completedAt,
  };
  input.onProgress?.({ phase: partial ? "partial" : "complete", completed: workerResult.total, total: workerResult.total, ...result });
  return result;
}

module.exports = {
  IGNORED_DIRECTORIES,
  SENSITIVE_FILE,
  CONTENT_SECRET_PATTERNS,
  TEXT_EXTENSIONS,
  assertProjectRoot,
  chunkText,
  extractEntities,
  indexProject,
  isBraceIgnored,
  isIndexableFile,
  listProjectFiles,
  redactContentSecrets,
  sourceUri,
};
