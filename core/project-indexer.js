"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { redactSecrets, sha256 } = require("./memory-store");

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

function globExpression(pattern) {
  const normalized = String(pattern || "").trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("#") || normalized.startsWith("!")) return null;
  const directoryOnly = normalized.endsWith("/");
  const raw = directoryOnly ? normalized.slice(0, -1) : normalized;
  let output = "";
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (character === "*" && raw[index + 1] === "*") {
      output += ".*";
      index += 1;
    } else if (character === "*") {
      output += "[^/]*";
    } else if (character === "?") {
      output += "[^/]";
    } else {
      output += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^(?:${output})${directoryOnly ? "(?:/.*)?" : ""}$`);
}

function loadBraceIgnore(root) {
  const filePath = path.join(root, ".braceignore");
  if (!fs.existsSync(filePath)) return [];
  try {
    return fs.readFileSync(filePath, "utf8").split(/\r?\n/).map(globExpression).filter(Boolean);
  } catch {
    return [];
  }
}

function ignoredByBrace(relativePath, rules) {
  const normalized = String(relativePath || "").split(path.sep).join("/");
  return rules.some((rule) => rule.test(normalized));
}

function listProjectFiles(rootPath, options = {}) {
  const root = assertProjectRoot(rootPath);
  const maximumFiles = Math.min(100_000, Math.max(1, Number(options.maxFiles) || 20_000));
  const maximumBytes = Math.min(20_000_000, Math.max(1_024, Number(options.maxFileBytes) || 2_000_000));
  const results = [];
  const errors = [];
  const ignoreRules = loadBraceIgnore(root);
  const queue = [root];
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    if (options.signal?.aborted) throw new Error("Project indexing was cancelled.");
    const directory = queue[queueIndex++];
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
    } catch (error) {
      errors.push({ path: path.relative(root, directory).split(path.sep).join("/"), error: String(error?.message || error) });
      continue;
    }
    for (const entry of entries) {
      if (results.length >= maximumFiles) return { root, files: results, truncated: true, errors };
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      if (ignoredByBrace(relativePath, ignoreRules)) continue;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) queue.push(absolutePath);
        continue;
      }
      if (!entry.isFile() || !isIndexableFile(entry.name)) continue;
      let stat;
      try { stat = fs.statSync(absolutePath); } catch (error) {
        errors.push({ path: relativePath, error: String(error?.message || error) });
        continue;
      }
      if (stat.size > maximumBytes) continue;
      results.push({
        absolutePath,
        relativePath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      });
    }
  }
  return { root, files: results, truncated: false, errors };
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
  const onProgress = typeof input.onProgress === "function" ? input.onProgress : () => {};
  onProgress({ phase: "scanning", completed: 0, total: null });
  const scan = listProjectFiles(input.rootPath, input);
  onProgress({ phase: "indexing", completed: 0, total: scan.files.length });
  const project = store.upsertProject({
    id: input.projectId,
    name: input.name || path.basename(scan.root),
    rootPath: scan.root,
  });
  const seenUris = [];
  let indexed = 0;
  let unchanged = 0;
  let skippedBinary = 0;
  let embedded = 0;
  let redactedFiles = 0;
  let fileErrors = scan.errors?.length || 0;
  for (let fileIndex = 0; fileIndex < scan.files.length; fileIndex += 1) {
    const file = scan.files[fileIndex];
    if (input.signal?.aborted) throw new Error("Project indexing was cancelled.");
    if (fileIndex === 0 || fileIndex % 10 === 0) {
      onProgress({ phase: "indexing", completed: fileIndex, total: scan.files.length });
    }
    let raw;
    try { raw = fs.readFileSync(file.absolutePath); } catch {
      fileErrors += 1;
      continue;
    }
    if (raw.includes(0)) {
      skippedBinary += 1;
      continue;
    }
    const originalContent = raw.toString("utf8");
    const redaction = redactSecrets(originalContent);
    const content = redaction.value;
    if (redaction.redacted) redactedFiles += 1;
    const hash = sha256(raw);
    const uri = sourceUri(project.id, file.relativePath);
    seenUris.push(uri);
    const previous = store.getSourceByUri(uri);
    if (
      previous?.content_hash === hash &&
      Number(previous.mtime_ms) === Number(file.mtimeMs) &&
      store.listSourceChunks(previous.id).length > 0
    ) {
      unchanged += 1;
      continue;
    }
    const preparedChunks = chunkText(content, input);
    let vectors = null;
    if (input.embedder && preparedChunks.length) {
      vectors = await input.embedder.embed(preparedChunks.map((chunk) => chunk.content), { signal: input.signal });
      if (!Array.isArray(vectors) || vectors.length !== preparedChunks.length) {
        throw new Error("The embedding adapter returned an unexpected vector count.");
      }
    }
    const persistedChunks = preparedChunks.map((chunk, index) => ({
      ...chunk,
      ...(vectors ? { embeddingModel: input.embedder.model, embedding: vectors[index] } : {}),
    }));
    let source = previous;
    if (!source) source = store.upsertSource({
      projectId: project.id,
      uri,
      title: path.basename(file.relativePath),
      mediaType: path.extname(file.relativePath).toLowerCase() === ".md"
        ? "text/markdown"
        : "text/plain",
      contentHash: hash,
      mtimeMs: file.mtimeMs,
      metadata: { relativePath: file.relativePath, size: file.size, redacted: redaction.redacted },
    });
    const chunks = store.replaceSourceChunks(source.id, persistedChunks);
    if (previous) {
      source = store.upsertSource({
        projectId: project.id,
        uri,
        title: path.basename(file.relativePath),
        mediaType: path.extname(file.relativePath).toLowerCase() === ".md" ? "text/markdown" : "text/plain",
        contentHash: hash,
        mtimeMs: file.mtimeMs,
        metadata: { relativePath: file.relativePath, size: file.size, redacted: redaction.redacted },
      });
    }
    if (vectors) embedded += chunks.length;
    for (const item of extractEntities(content)) {
      const entity = store.upsertEntity(item);
      store.relate({
        fromType: "source",
        fromId: source.id,
        toType: "entity",
        toId: entity.id,
        relation: item.relation,
        sourceId: source.id,
      });
    }
    indexed += 1;
  }
  onProgress({ phase: "indexing", completed: scan.files.length, total: scan.files.length });
  const removed = store.removeMissingSources(project.id, seenUris);
  const completedAt = new Date().toISOString();
  store.upsertProject({
    id: project.id,
    name: project.name,
    rootPath: project.root_path,
    lastIndexedAt: completedAt,
  });
  store.insertEvent({
    eventType: "project.indexed",
    occurredAt: completedAt,
    title: `Indexed ${project.name}`,
    summary: `${indexed} changed, ${unchanged} unchanged, ${removed} removed.`,
    projectId: project.id,
    metadata: { indexed, unchanged, removed, skippedBinary, embedded, redactedFiles, fileErrors, truncated: scan.truncated },
  });
  return {
    projectId: project.id,
    rootPath: project.root_path,
    filesSeen: scan.files.length,
    indexed,
    unchanged,
    removed,
    skippedBinary,
    embedded,
    redactedFiles,
    fileErrors,
    truncated: scan.truncated,
    completedAt,
  };
}

module.exports = {
  IGNORED_DIRECTORIES,
  SENSITIVE_FILE,
  TEXT_EXTENSIONS,
  assertProjectRoot,
  chunkText,
  extractEntities,
  indexProject,
  isIndexableFile,
  listProjectFiles,
  loadBraceIgnore,
  ignoredByBrace,
  sourceUri,
};
