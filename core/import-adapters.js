"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { chunkText, redactContentSecrets, sourceUri } = require("./project-indexer");

const DOCUMENT_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
const MAX_FILES = 1_000;
const MAX_FILE_BYTES = 5_000_000;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function collectFiles(selectedPaths) {
  const files = [];
  const unsupported = [];
  const queue = [...new Set((selectedPaths || []).map((item) => path.resolve(String(item || ""))).filter(Boolean))];
  for (let cursor = 0; cursor < queue.length && files.length < MAX_FILES; cursor += 1) {
    const candidate = queue[cursor];
    let stat;
    try { stat = fs.lstatSync(candidate); } catch { unsupported.push({ name: path.basename(candidate), reason: "unreadable" }); continue; }
    if (stat.isSymbolicLink()) { unsupported.push({ name: path.basename(candidate), reason: "symlink" }); continue; }
    if (stat.isDirectory()) {
      const name = path.basename(candidate);
      if ([".git", "node_modules", "dist", "build", ".next", ".cache"].includes(name)) continue;
      let children = [];
      try { children = fs.readdirSync(candidate).map((name) => path.join(candidate, name)); }
      catch { unsupported.push({ name, reason: "unreadable-directory" }); }
      queue.push(...children);
      continue;
    }
    if (!stat.isFile()) continue;
    if (stat.size > MAX_FILE_BYTES) { unsupported.push({ name: path.basename(candidate), reason: "larger-than-5MB" }); continue; }
    const extension = path.extname(candidate).toLowerCase();
    if (!DOCUMENT_EXTENSIONS.has(extension) && extension !== ".json") {
      unsupported.push({ name: path.basename(candidate), reason: "unsupported-type" });
      continue;
    }
    files.push({ filePath: candidate, name: path.basename(candidate), extension, bytes: stat.size, mtimeMs: stat.mtimeMs });
  }
  if (queue.length > MAX_FILES) unsupported.push({ name: "Additional files", reason: `limit-${MAX_FILES}` });
  return { files, unsupported };
}

function inspectJson(entry) {
  try {
    const parsed = JSON.parse(fs.readFileSync(entry.filePath, "utf8"));
    if (!Number.isInteger(parsed?.schemaVersion) || !Array.isArray(parsed?.memories)) return null;
    return {
      ...entry,
      kind: "brace-profile",
      data: parsed,
      counts: {
        memories: Math.min(10_000, parsed.memories.length),
        activeMemories: parsed.memories.filter((memory) => memory?.status === "active").slice(0, 10_000).length,
        evidence: parsed.memories.slice(0, 10_000).reduce((count, memory) => count + Math.min(100, Array.isArray(memory?.evidence) ? memory.evidence.length : 0), 0),
      },
    };
  } catch {
    return null;
  }
}

function previewImports(selectedPaths) {
  const collected = collectFiles(selectedPaths);
  const entries = [];
  for (const entry of collected.files) {
    if (entry.extension === ".json") {
      const profile = inspectJson(entry);
      if (profile) entries.push(profile);
      else collected.unsupported.push({ name: entry.name, reason: "not-a-brace-export" });
    } else {
      entries.push({ ...entry, kind: "document" });
    }
  }
  return {
    entries,
    unsupported: collected.unsupported.slice(0, 100),
    summary: {
      documents: entries.filter((entry) => entry.kind === "document").length,
      profiles: entries.filter((entry) => entry.kind === "brace-profile").length,
      memories: entries.reduce((count, entry) => count + Number(entry.counts?.activeMemories || 0), 0),
      bytes: entries.reduce((count, entry) => count + entry.bytes, 0),
      unsupported: collected.unsupported.length,
    },
  };
}

function executeImports(store, preview) {
  let documents = 0;
  let memories = 0;
  let duplicates = 0;
  let evidence = 0;
  let redactions = 0;
  const projects = new Map();
  for (const entry of preview.entries || []) {
    if (entry.kind === "document") {
      const rootPath = path.dirname(entry.filePath);
      let project = projects.get(rootPath);
      if (!project) {
        project = store.upsertProject({ rootPath, name: path.basename(rootPath), lastIndexedAt: null });
        projects.set(rootPath, project);
      }
      const source = fs.readFileSync(entry.filePath, "utf8");
      if (source.includes("\uFFFD")) continue;
      const redacted = redactContentSecrets(source);
      redactions += redacted.redacted;
      const chunks = chunkText(redacted.value, { extension: entry.extension });
      store.commitIndexedSource({
        projectId: project.id,
        uri: sourceUri(project.id, path.relative(rootPath, entry.filePath).split(path.sep).join("/")),
        title: entry.name,
        mediaType: entry.extension.startsWith(".md") ? "text/markdown" : "text/plain",
        contentHash: sha256(redacted.value),
        mtimeMs: entry.mtimeMs,
        metadata: { importedExplicitly: true, originalPreserved: true },
      }, chunks);
      documents += 1;
      continue;
    }
    if (entry.kind === "brace-profile") {
      for (const imported of entry.data.memories.slice(0, 10_000)) {
        if (imported?.status !== "active" || !imported?.title || !imported?.content) continue;
        const result = store.createMemory({
          kind: imported.kind,
          scope: imported.scope,
          title: imported.title,
          summary: imported.summary,
          content: imported.content,
          confidence: imported.confidence,
          importance: imported.importance,
          pinned: imported.pinned,
          tags: imported.tags,
          sourceUri: imported.sourceUri || "brace-import://portable-profile",
          sourceExcerpt: imported.sourceExcerpt || `Imported from ${entry.name}.`,
        });
        if (result.duplicate) { duplicates += 1; continue; }
        memories += 1;
        for (const item of (Array.isArray(imported.evidence) ? imported.evidence : []).slice(0, 100)) {
          if (!item?.summary || !item?.reference) continue;
          store.addEvidence(result.memory.id, item);
          evidence += 1;
        }
      }
    }
  }
  return { documents, memories, duplicates, evidence, redactions, projects: projects.size };
}

function publicPreview(preview) {
  return {
    summary: preview.summary,
    entries: preview.entries.map((entry) => ({ name: entry.name, kind: entry.kind, bytes: entry.bytes, counts: entry.counts || null })),
    unsupported: preview.unsupported,
  };
}

module.exports = { collectFiles, executeImports, previewImports, publicPreview };
