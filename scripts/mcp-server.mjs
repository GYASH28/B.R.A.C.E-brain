#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import memoryModule from "../core/memory-store.js";
import dataPathModule from "../core/data-paths.js";
import embeddingModule from "../core/embedding-adapters.js";
import skillModule from "../core/skill-runtime.js";

const { MemoryStore } = memoryModule;
const { databasePath } = dataPathModule;
const { createOllamaEmbeddingAdapter } = embeddingModule;
const { runSkillAction } = skillModule;

const memoryKind = z.enum([
  "project",
  "decision",
  "lesson",
  "warning",
  "preference",
  "summary",
  "hypothesis",
  "fact",
  "procedure",
]);

function jsonResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: { ...value },
  };
}

function safeProject(project) {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    lastIndexedAt: project.last_indexed_at,
  };
}

function createEmbeddingAdapter(environment) {
  const model = String(environment.BRACE_OLLAMA_EMBED_MODEL || "").trim();
  if (!model) return null;
  return createOllamaEmbeddingAdapter({
    endpoint: environment.BRACE_OLLAMA_ENDPOINT || "http://127.0.0.1:11434",
    model,
  });
}

export function createBraceMcpServer(options = {}) {
  const environment = options.environment || process.env;
  const store = options.store || new MemoryStore(databasePath({ environment }));
  const ownsStore = !options.store;
  const writesEnabled = options.writesEnabled ?? environment.BRACE_MCP_WRITE === "1";
  const destructiveEnabled = options.destructiveEnabled ?? environment.BRACE_MCP_DESTRUCTIVE === "1";
  const embeddingAdapter = options.embeddingAdapter || createEmbeddingAdapter(environment);
  const server = new McpServer(
    { name: "brace", version: "0.1.0" },
    {
      instructions: [
        "BRACE is a local-first memory layer.",
        "Search durable memories and imported sources before asking the user to repeat project context.",
        "Keep memory evidence and source excerpts separate, and cite brace-project URIs when available.",
        writesEnabled
          ? "Memory writes are enabled for this process. Store concise durable facts, decisions, lessons, warnings, preferences, or procedures; never raw chain-of-thought or credentials."
          : "This process is read-only. Ask the user to enable BRACE_MCP_WRITE=1 before attempting a memory mutation.",
      ].join(" "),
    },
  );

  server.registerTool(
    "brace_search",
    {
      title: "Search BRACE",
      description: "Search durable memories and imported project sources, preserving separate provenance.",
      inputSchema: z.object({
        query: z.string().min(1).max(2_000),
        scope: z.string().max(200).optional(),
        projectId: z.string().max(200).optional(),
        kinds: z.array(memoryKind).max(9).optional(),
        limit: z.number().int().min(1).max(50).default(12),
      }),
      outputSchema: z.object({
        mode: z.enum(["lexical", "semantic", "hybrid"]),
        embeddingModel: z.string().nullable(),
        memories: z.array(z.record(z.string(), z.unknown())),
        sources: z.array(z.record(z.string(), z.unknown())),
        warning: z.string().nullable(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, scope, projectId, kinds, limit }) => {
      let queryVector = null;
      let warning = null;
      if (embeddingAdapter) {
        try {
          [queryVector] = await embeddingAdapter.embed([query]);
        } catch (error) {
          warning = `Semantic retrieval unavailable; lexical search completed: ${error.message}`;
        }
      }
      const vectorOptions = queryVector
        ? { queryVector, embeddingModel: embeddingAdapter.model }
        : {};
      const memories = store.search(query, { scope, kinds, limit, ...vectorOptions });
      const sources = store.searchSources(query, { projectId, limit, ...vectorOptions });
      const mode = [memories.mode, sources.mode].includes("hybrid")
        ? "hybrid"
        : [memories.mode, sources.mode].includes("semantic")
          ? "semantic"
          : "lexical";
      return jsonResult({
        mode,
        embeddingModel: mode === "lexical" ? null : embeddingAdapter.model,
        memories: memories.results,
        sources: sources.results,
        warning,
      });
    },
  );

  server.registerTool(
    "brace_get_memory",
    {
      title: "Get BRACE memory",
      description: "Read one durable memory with its provenance and evidence.",
      inputSchema: z.object({ id: z.string().min(1).max(200) }),
      outputSchema: z.object({ memory: z.record(z.string(), z.unknown()).nullable() }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => jsonResult({ memory: store.getMemory(id, { includeEvidence: true }) }),
  );

  server.registerTool(
    "brace_list_timeline",
    {
      title: "List BRACE timeline",
      description: "List real memory, decision, project-index, evidence, and skill events in reverse chronological order.",
      inputSchema: z.object({
        projectId: z.string().max(200).optional(),
        before: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
      outputSchema: z.object({ events: z.array(z.record(z.string(), z.unknown())) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input) => jsonResult({ events: store.listTimeline(input) }),
  );

  server.registerTool(
    "brace_get_graph",
    {
      title: "Get BRACE graph",
      description: "Read the provenance-backed project, source, memory, entity, and decision graph.",
      inputSchema: z.object({ scope: z.string().max(200).optional(), limit: z.number().int().min(1).max(2_000).default(500) }),
      outputSchema: z.object({ nodes: z.array(z.record(z.string(), z.unknown())), edges: z.array(z.record(z.string(), z.unknown())) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input) => jsonResult(store.graph(input)),
  );

  server.registerTool(
    "brace_list_projects",
    {
      title: "List BRACE projects",
      description: "List indexed projects without exposing machine-specific root paths.",
      outputSchema: z.object({ projects: z.array(z.record(z.string(), z.unknown())) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => jsonResult({ projects: store.listProjects().map(safeProject) }),
  );

  server.registerTool(
    "brace_list_skills",
    {
      title: "List BRACE skills",
      description: "List installed declarative BRACE skills, status, and approved permissions.",
      outputSchema: z.object({ skills: z.array(z.record(z.string(), z.unknown())) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => jsonResult({
      skills: store.listSkills().map((skill) => ({
        name: skill.name,
        version: skill.version,
        description: skill.manifest.description,
        enabled: skill.enabled,
        permissions: skill.permissions,
      })),
    }),
  );

  server.registerTool(
    "brace_status",
    {
      title: "Get BRACE status",
      description: "Return schema, content counts, semantic availability, and MCP permission mode.",
      outputSchema: z.object({
        schemaVersion: z.number(),
        counts: z.record(z.string(), z.number()),
        semantic: z.object({ enabled: z.boolean(), model: z.string().nullable() }),
        writesEnabled: z.boolean(),
        destructiveEnabled: z.boolean(),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const stats = store.stats();
      const { schemaVersion, ...counts } = stats;
      return jsonResult({
        schemaVersion,
        counts,
        semantic: { enabled: Boolean(embeddingAdapter), model: embeddingAdapter?.model || null },
        writesEnabled,
        destructiveEnabled,
      });
    },
  );

  server.registerResource(
    "brace-status",
    "brace://status",
    { title: "BRACE status", description: "Current local BRACE memory-layer status.", mimeType: "application/json" },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({ stats: store.stats(), writesEnabled, destructiveEnabled }, null, 2),
      }],
    }),
  );

  if (writesEnabled) {
    server.registerTool(
      "brace_remember",
      {
        title: "Remember in BRACE",
        description: "Store one concise durable memory with scope and optional provenance. Exact duplicates reuse the existing record.",
        inputSchema: z.object({
          kind: memoryKind,
          scope: z.string().min(1).max(200).default("global"),
          title: z.string().min(1).max(240),
          summary: z.string().max(600).optional(),
          content: z.string().min(1).max(100_000),
          tags: z.array(z.string().max(80)).max(50).optional(),
          sourceUri: z.string().max(2_000).optional(),
          sourceExcerpt: z.string().max(1_000).optional(),
          confidence: z.number().min(0).max(1).optional(),
          importance: z.number().min(0).max(1).optional(),
        }),
        outputSchema: z.object({
          memory: z.record(z.string(), z.unknown()),
          duplicate: z.boolean(),
          duplicateCandidate: z.record(z.string(), z.unknown()).nullable(),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async (input) => jsonResult(store.createMemory(input)),
    );

    server.registerTool(
      "brace_record_decision",
      {
        title: "Record BRACE decision",
        description: "Record one explicit decision and append its timeline event.",
        inputSchema: z.object({
          projectId: z.string().max(200).optional(),
          title: z.string().min(1).max(240),
          context: z.string().max(50_000).optional(),
          decision: z.string().min(1).max(100_000),
          rationale: z.string().max(50_000).optional(),
          alternatives: z.array(z.string().max(2_000)).max(50).optional(),
          status: z.enum(["proposed", "accepted", "superseded", "rejected"]).default("accepted"),
        }),
        outputSchema: z.object({ decision: z.record(z.string(), z.unknown()) }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async (input) => jsonResult({ decision: store.createDecision(input) }),
    );

    server.registerTool(
      "brace_run_skill",
      {
        title: "Run BRACE skill",
        description: "Run one enabled declarative BRACE skill action through its approved permission set.",
        inputSchema: z.object({
          skill: z.string().min(2).max(63),
          action: z.string().min(2).max(63),
          input: z.record(z.string(), z.unknown()).default({}),
        }),
        outputSchema: z.object({ result: z.record(z.string(), z.unknown()) }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async ({ skill, action, input }) => jsonResult({ result: runSkillAction(store, skill, action, input) }),
    );
  }

  if (writesEnabled && destructiveEnabled) {
    server.registerTool(
      "brace_forget_memory",
      {
        title: "Forget BRACE memory",
        description: "Delete one memory's content, evidence, and embeddings while retaining a non-sensitive audit tombstone.",
        inputSchema: z.object({ id: z.string().min(1).max(200) }),
        outputSchema: z.object({ forgotten: z.boolean() }),
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id }) => jsonResult({ forgotten: store.forgetMemory(id) }),
    );
  }

  return { server, store, ownsStore, writesEnabled, destructiveEnabled };
}

export function serveBraceStdio(options = {}) {
  let active = null;
  const handle = serveStdio(() => {
    active = createBraceMcpServer(options);
    return active.server;
  });
  const close = async () => {
    await handle.close();
    if (active?.ownsStore) active.store.close();
  };
  return { handle, close };
}

if (
  process.env.BRACE_MCP_DIRECT === "1" ||
  (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
) {
  const running = serveBraceStdio();
  console.error("BRACE MCP server is listening on stdio.");
  const shutdown = () => {
    void running.close().finally(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
