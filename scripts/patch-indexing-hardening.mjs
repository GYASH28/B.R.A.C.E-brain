#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const storePath = path.join(root, "core/memory-store.js");
const indexerPath = path.join(root, "core/project-indexer.js");
let store = fs.readFileSync(storePath, "utf8");
let indexer = fs.readFileSync(indexerPath, "utf8");

function replaceInStore(search, replacement, label) {
  if (!store.includes(search)) throw new Error(`Index hardening could not locate store ${label}`);
  store = store.replace(search, replacement);
}

function replaceInIndexer(search, replacement, label) {
  if (!indexer.includes(search)) throw new Error(`Index hardening could not locate indexer ${label}`);
  indexer = indexer.replace(search, replacement);
}

if (!store.includes("embeddingModel: chunk.embeddingModel")) {
  replaceInStore(
    '        contentHash: sha256(normalizeForHash(content)),\n      };\n',
    '        contentHash: sha256(normalizeForHash(content)),\n' +
      '        embeddingModel: chunk.embeddingModel ? normalizeText(chunk.embeddingModel).slice(0, 180) : null,\n' +
      '        embedding: chunk.embedding ? validateVector(chunk.embedding) : null,\n' +
      '      };\n',
    "prepared source chunk",
  );
  replaceInStore(
    '        INSERT INTO source_chunks(\n          id, source_id, ordinal, heading, content, content_hash, created_at, updated_at\n        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)\n',
    '        INSERT INTO source_chunks(\n' +
      '          id, source_id, ordinal, heading, content, content_hash,\n' +
      '          embedding_model, embedding_json, created_at, updated_at\n' +
      '        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n',
    "source chunk insert columns",
  );
  replaceInStore(
    '          chunk.contentHash,\n          timestamp,\n          timestamp,\n',
    '          chunk.contentHash,\n' +
      '          chunk.embeddingModel,\n' +
      '          chunk.embedding ? JSON.stringify(chunk.embedding) : null,\n' +
      '          timestamp,\n' +
      '          timestamp,\n',
    "source chunk insert values",
  );
}

if (!indexer.includes("function loadBraceIgnore")) {
  replaceInIndexer(
    'const { sha256 } = require("./memory-store");\n',
    'const { redactSecrets, sha256 } = require("./memory-store");\n',
    "memory-store import",
  );

  replaceInIndexer(
    'function isIndexableFile(name) {\n  return TEXT_EXTENSIONS.has(path.extname(name).toLowerCase()) && !SENSITIVE_FILE.test(name);\n}\n',
    'function isIndexableFile(name) {\n' +
      '  return TEXT_EXTENSIONS.has(path.extname(name).toLowerCase()) && !SENSITIVE_FILE.test(name);\n' +
      '}\n\n' +
      'function globExpression(pattern) {\n' +
      '  const normalized = String(pattern || "").trim().replaceAll("\\\\", "/").replace(/^\\.\\//, "");\n' +
      '  if (!normalized || normalized.startsWith("#") || normalized.startsWith("!")) return null;\n' +
      '  const directoryOnly = normalized.endsWith("/");\n' +
      '  const raw = directoryOnly ? normalized.slice(0, -1) : normalized;\n' +
      '  let output = "";\n' +
      '  for (let index = 0; index < raw.length; index += 1) {\n' +
      '    const character = raw[index];\n' +
      '    if (character === "*" && raw[index + 1] === "*") {\n' +
      '      output += ".*";\n' +
      '      index += 1;\n' +
      '    } else if (character === "*") {\n' +
      '      output += "[^/]*";\n' +
      '    } else if (character === "?") {\n' +
      '      output += "[^/]";\n' +
      '    } else {\n' +
      '      output += character.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");\n' +
      '    }\n' +
      '  }\n' +
      '  return new RegExp(`^(?:${output})${directoryOnly ? "(?:/.*)?" : ""}$`);\n' +
      '}\n\n' +
      'function loadBraceIgnore(root) {\n' +
      '  const filePath = path.join(root, ".braceignore");\n' +
      '  if (!fs.existsSync(filePath)) return [];\n' +
      '  try {\n' +
      '    return fs.readFileSync(filePath, "utf8").split(/\\r?\\n/).map(globExpression).filter(Boolean);\n' +
      '  } catch {\n' +
      '    return [];\n' +
      '  }\n' +
      '}\n\n' +
      'function ignoredByBrace(relativePath, rules) {\n' +
      '  const normalized = String(relativePath || "").split(path.sep).join("/");\n' +
      '  return rules.some((rule) => rule.test(normalized));\n' +
      '}\n',
    "ignore helpers",
  );

  replaceInIndexer(
    '  const results = [];\n  const queue = [root];\n  while (queue.length) {\n',
    '  const results = [];\n' +
      '  const errors = [];\n' +
      '  const ignoreRules = loadBraceIgnore(root);\n' +
      '  const queue = [root];\n' +
      '  let queueIndex = 0;\n' +
      '  while (queueIndex < queue.length) {\n',
    "scan queue initialization",
  );
  replaceInIndexer(
    '    const directory = queue.shift();\n    const entries = fs.readdirSync(directory, { withFileTypes: true })\n      .sort((left, right) => left.name.localeCompare(right.name));\n',
    '    const directory = queue[queueIndex++];\n' +
      '    let entries;\n' +
      '    try {\n' +
      '      entries = fs.readdirSync(directory, { withFileTypes: true })\n' +
      '        .sort((left, right) => left.name.localeCompare(right.name));\n' +
      '    } catch (error) {\n' +
      '      errors.push({ path: path.relative(root, directory).split(path.sep).join("/"), error: String(error?.message || error) });\n' +
      '      continue;\n' +
      '    }\n',
    "scan directory read",
  );
  replaceInIndexer(
    '      if (results.length >= maximumFiles) return { root, files: results, truncated: true };\n      const absolutePath = path.join(directory, entry.name);\n',
    '      if (results.length >= maximumFiles) return { root, files: results, truncated: true, errors };\n' +
      '      const absolutePath = path.join(directory, entry.name);\n' +
      '      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");\n' +
      '      if (ignoredByBrace(relativePath, ignoreRules)) continue;\n',
    "scan path handling",
  );
  replaceInIndexer(
    '      const stat = fs.statSync(absolutePath);\n      if (stat.size > maximumBytes) continue;\n      results.push({\n        absolutePath,\n        relativePath: path.relative(root, absolutePath).split(path.sep).join("/"),\n',
    '      let stat;\n' +
      '      try { stat = fs.statSync(absolutePath); } catch (error) {\n' +
      '        errors.push({ path: relativePath, error: String(error?.message || error) });\n' +
      '        continue;\n' +
      '      }\n' +
      '      if (stat.size > maximumBytes) continue;\n' +
      '      results.push({\n' +
      '        absolutePath,\n' +
      '        relativePath,\n',
    "scan stat handling",
  );
  replaceInIndexer(
    '  return { root, files: results, truncated: false };\n',
    '  return { root, files: results, truncated: false, errors };\n',
    "scan return",
  );
}

if (!indexer.includes("let redactedFiles = 0;")) {
  replaceInIndexer(
    '  let embedded = 0;\n  for (const file of scan.files) {\n',
    '  let embedded = 0;\n' +
      '  let redactedFiles = 0;\n' +
      '  let fileErrors = scan.errors?.length || 0;\n' +
      '  for (const file of scan.files) {\n',
    "index counters",
  );
  replaceInIndexer(
    '    const raw = fs.readFileSync(file.absolutePath);\n    if (raw.includes(0)) {\n',
    '    let raw;\n' +
      '    try { raw = fs.readFileSync(file.absolutePath); } catch {\n' +
      '      fileErrors += 1;\n' +
      '      continue;\n' +
      '    }\n' +
      '    if (raw.includes(0)) {\n',
    "file read handling",
  );
  replaceInIndexer(
    '    const content = raw.toString("utf8");\n    const hash = sha256(raw);\n',
    '    const originalContent = raw.toString("utf8");\n' +
      '    const redaction = redactSecrets(originalContent);\n' +
      '    const content = redaction.value;\n' +
      '    if (redaction.redacted) redactedFiles += 1;\n' +
      '    const hash = sha256(raw);\n',
    "content redaction",
  );
  replaceInIndexer(
    '    if (previous?.content_hash === hash && Number(previous.mtime_ms) === Number(file.mtimeMs)) {\n      unchanged += 1;\n      continue;\n    }\n    const source = store.upsertSource({\n',
    '    if (\n' +
      '      previous?.content_hash === hash &&\n' +
      '      Number(previous.mtime_ms) === Number(file.mtimeMs) &&\n' +
      '      store.listSourceChunks(previous.id).length > 0\n' +
      '    ) {\n' +
      '      unchanged += 1;\n' +
      '      continue;\n' +
      '    }\n' +
      '    const preparedChunks = chunkText(content, input);\n' +
      '    let vectors = null;\n' +
      '    if (input.embedder && preparedChunks.length) {\n' +
      '      vectors = await input.embedder.embed(preparedChunks.map((chunk) => chunk.content), { signal: input.signal });\n' +
      '      if (!Array.isArray(vectors) || vectors.length !== preparedChunks.length) {\n' +
      '        throw new Error("The embedding adapter returned an unexpected vector count.");\n' +
      '      }\n' +
      '    }\n' +
      '    const persistedChunks = preparedChunks.map((chunk, index) => ({\n' +
      '      ...chunk,\n' +
      '      ...(vectors ? { embeddingModel: input.embedder.model, embedding: vectors[index] } : {}),\n' +
      '    }));\n' +
      '    let source = previous;\n' +
      '    if (!source) source = store.upsertSource({\n',
    "precommit preparation",
  );
  replaceInIndexer(
    '    });\n    const chunks = store.replaceSourceChunks(source.id, chunkText(content, input));\n    if (input.embedder && chunks.length) {\n      const vectors = await input.embedder.embed(chunks.map((chunk) => chunk.content), {\n        signal: input.signal,\n      });\n      if (!Array.isArray(vectors) || vectors.length !== chunks.length) {\n        throw new Error("The embedding adapter returned an unexpected vector count.");\n      }\n      chunks.forEach((chunk, index) => {\n        store.upsertSourceChunkEmbedding(chunk.id, input.embedder.model, vectors[index]);\n        embedded += 1;\n      });\n    }\n',
    '    });\n' +
      '    const chunks = store.replaceSourceChunks(source.id, persistedChunks);\n' +
      '    if (previous) {\n' +
      '      source = store.upsertSource({\n' +
      '        projectId: project.id,\n' +
      '        uri,\n' +
      '        title: path.basename(file.relativePath),\n' +
      '        mediaType: path.extname(file.relativePath).toLowerCase() === ".md" ? "text/markdown" : "text/plain",\n' +
      '        contentHash: hash,\n' +
      '        mtimeMs: file.mtimeMs,\n' +
      '        metadata: { relativePath: file.relativePath, size: file.size, redacted: redaction.redacted },\n' +
      '      });\n' +
      '    }\n' +
      '    if (vectors) embedded += chunks.length;\n',
    "chunk persistence",
  );
  indexer = indexer.replace(
    '      metadata: { relativePath: file.relativePath, size: file.size },\n',
    '      metadata: { relativePath: file.relativePath, size: file.size, redacted: redaction.redacted },\n',
  );
  replaceInIndexer(
    '    metadata: { indexed, unchanged, removed, skippedBinary, embedded, truncated: scan.truncated },\n',
    '    metadata: { indexed, unchanged, removed, skippedBinary, embedded, redactedFiles, fileErrors, truncated: scan.truncated },\n',
    "index event metadata",
  );
  replaceInIndexer(
    '    embedded,\n    truncated: scan.truncated,\n',
    '    embedded,\n' +
      '    redactedFiles,\n' +
      '    fileErrors,\n' +
      '    truncated: scan.truncated,\n',
    "index result metadata",
  );
}

if (!indexer.includes("loadBraceIgnore,")) {
  replaceInIndexer(
    '  isIndexableFile,\n  listProjectFiles,\n',
    '  isIndexableFile,\n  listProjectFiles,\n  loadBraceIgnore,\n  ignoredByBrace,\n',
    "indexer exports",
  );
}

fs.writeFileSync(storePath, store.replace(/\r\n/g, "\n"));
fs.writeFileSync(indexerPath, indexer.replace(/\r\n/g, "\n"));

const testsPath = path.join(root, "tests/project-indexer-hardening.test.js");
if (!fs.existsSync(testsPath)) {
  fs.writeFileSync(testsPath, `"use strict";\n\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst os = require("node:os");\nconst path = require("node:path");\nconst test = require("node:test");\nconst { MemoryStore } = require("../core/memory-store");\nconst { indexProject, listProjectFiles } = require("../core/project-indexer");\n\nfunction fixture(context) {\n  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-index-hardening-"));\n  const projectRoot = path.join(directory, "project");\n  fs.mkdirSync(path.join(projectRoot, "private"), { recursive: true });\n  const store = new MemoryStore(path.join(directory, "profile", "brace.sqlite3"));\n  context.after(() => {\n    try { store.close(); } catch {}\n    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });\n  });\n  return { directory, projectRoot, store };\n}\n\ntest(".braceignore excludes project-local paths before indexing", (context) => {\n  const { projectRoot } = fixture(context);\n  fs.writeFileSync(path.join(projectRoot, ".braceignore"), "private/**\\n*.generated.md\\n");\n  fs.writeFileSync(path.join(projectRoot, "public.md"), "public context");\n  fs.writeFileSync(path.join(projectRoot, "private", "notes.md"), "private context");\n  fs.writeFileSync(path.join(projectRoot, "ignored.generated.md"), "generated context");\n  assert.deepEqual(listProjectFiles(projectRoot).files.map((item) => item.relativePath), ["public.md"]);\n});\n\ntest("ordinary text files have recognizable secrets redacted before persistence", async (context) => {\n  const { projectRoot, store } = fixture(context);\n  fs.writeFileSync(path.join(projectRoot, "notes.md"), "# Notes\\n\\nProvider token sk-abcdefghijklmnopqrstuvwxyz123456 must never persist.");\n  const result = await indexProject(store, { rootPath: projectRoot });\n  assert.equal(result.redactedFiles, 1);\n  const persisted = store.searchSources("Provider token").results[0].content;\n  assert.match(persisted, /REDACTED API KEY/);\n  assert.doesNotMatch(persisted, /sk-abcdefghijklmnopqrstuvwxyz123456/);\n});\n\ntest("embedding failure leaves the previous complete source index searchable", async (context) => {\n  const { projectRoot, store } = fixture(context);\n  const notes = path.join(projectRoot, "notes.md");\n  fs.writeFileSync(notes, "# Stable\\n\\nThe previous complete index remains authoritative.");\n  const first = await indexProject(store, { rootPath: projectRoot });\n  assert.equal(store.searchSources("previous complete index").results.length, 1);\n\n  fs.writeFileSync(notes, "# Changed\\n\\nThis replacement should not land after embedding failure.");\n  const failedEmbedder = {\n    model: "fixture:fail",\n    async embed() { throw new Error("synthetic embedding failure"); },\n  };\n  await assert.rejects(\n    () => indexProject(store, { rootPath: projectRoot, projectId: first.projectId, embedder: failedEmbedder }),\n    /synthetic embedding failure/,\n  );\n  assert.equal(store.searchSources("previous complete index").results.length, 1);\n  assert.equal(store.searchSources("replacement should not land").results.length, 0);\n});\n\ntest("prepared embeddings are committed with source chunks in one replacement transaction", async (context) => {\n  const { projectRoot, store } = fixture(context);\n  fs.writeFileSync(path.join(projectRoot, "notes.md"), "# Semantic\\n\\nAlpha semantic context.");\n  const embedder = { model: "fixture:v1", async embed(values) { return values.map(() => [1, 0, 0]); } };\n  const result = await indexProject(store, { rootPath: projectRoot, embedder });\n  const project = store.listProjects().find((item) => item.id === result.projectId);\n  const found = store.searchSources("Alpha semantic", { projectId: project.id, embeddingModel: "fixture:v1", queryVector: [1, 0, 0] });\n  assert.ok(["hybrid", "semantic"].includes(found.mode));\n  assert.equal(found.results[0].retrieval.semanticSimilarity > 0.99, true);\n});\n`);
}

process.stdout.write("Applied BRACE project indexing hardening.\n");
