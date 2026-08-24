"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { indexProject } = require("./project-indexer");

async function initializeDemoProfile(store, options) {
  const sourceRoot = path.resolve(options.sourceRoot);
  const profileRoot = path.resolve(options.profileRoot);
  if (!fs.existsSync(sourceRoot)) throw new Error("The synthetic demo workspace is missing from this installation.");
  fs.mkdirSync(profileRoot, { recursive: true });
  fs.cpSync(sourceRoot, profileRoot, { recursive: true, force: true, errorOnExist: false });
  const indexed = await indexProject(store, {
    rootPath: profileRoot,
    name: "Northstar (synthetic demo)",
    signal: options.signal,
  });
  const scope = `project:${indexed.projectId}`;
  const architectureSource = store.getSourceByUri(
    `brace-project://${encodeURIComponent(indexed.projectId)}/Architecture%20Decisions.md`,
  );
  const memoryResults = [
    store.createMemory({
      kind: "project",
      scope,
      title: "Northstar product promise",
      summary: "Share durable project context across AI tools while source files stay local.",
      content: "Northstar demonstrates a fictional research team using one provenance-backed memory layer across multiple AI clients.",
      tags: ["northstar", "product"],
      sourceId: architectureSource?.id,
      sourceUri: architectureSource?.uri,
      confidence: 0.9,
      importance: 0.85,
    }),
    store.createMemory({
      kind: "lesson",
      scope,
      title: "Show provenance beside retrieval results",
      summary: "Stable project URIs and headings improve trust in recalled context.",
      content: "The synthetic retrieval study found that people trusted results more when each excerpt showed its source URI and Markdown heading.",
      tags: ["research", "provenance"],
      confidence: 0.82,
      importance: 0.72,
    }),
    store.createMemory({
      kind: "warning",
      scope,
      title: "Do not auto-merge near-duplicate decisions",
      summary: "Similarity is a review signal, not proof that two records agree.",
      content: "BRACE suggests near-duplicate memory pairs for review and only reuses exact normalized hashes automatically.",
      tags: ["consolidation", "safety"],
      confidence: 0.88,
      importance: 0.78,
    }),
  ];
  const decisionKey = `demo.decision.${indexed.projectId}`;
  if (!store.getSetting(decisionKey, false)) {
    store.createDecision({
      projectId: indexed.projectId,
      title: "Keep imported files canonical",
      context: "BRACE needs structured retrieval without taking ownership of project files.",
      decision: "Index imported files into external SQLite while preserving the originals as canonical sources.",
      rationale: "The boundary protects user files and makes application upgrades safe.",
      alternatives: ["Move project files into the app", "Store only raw transcripts"],
      sourceId: architectureSource?.id,
    });
    store.setSetting(decisionKey, true);
  }
  return {
    projectId: indexed.projectId,
    profileRoot,
    indexed,
    memories: memoryResults.map((result) => result.memory),
  };
}

module.exports = { initializeDemoProfile };
