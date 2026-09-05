"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MemoryStore } = require("../core/memory-store");

const root = path.resolve(__dirname, "..");
const serverScript = path.join(root, "scripts", "mcp-server.mjs");

async function connect(context, environment = {}) {
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import("@modelcontextprotocol/client"),
    import("@modelcontextprotocol/client/stdio"),
  ]);
  const client = new Client({ name: "brace-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverScript],
    cwd: root,
    env: { ...process.env, ...environment },
    stderr: "pipe",
  });
  await client.connect(transport);
  context.after(async () => {
    try { await client.close(); } catch {}
  });
  return client;
}

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-mcp-v2-"));
  const databasePath = path.join(directory, "brace.sqlite3");
  context.after(() => fs.rmSync(directory, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  }));
  return { directory, databasePath };
}

test("official MCP v2 stdio server exposes structured read-only memory tools", async (context) => {
  const { databasePath } = fixture(context);
  const seed = new MemoryStore(databasePath);
  const memory = seed.createMemory({
    kind: "decision",
    scope: "project:northstar",
    title: "Keep indexing offline",
    content: "The fictional Northstar project indexes Markdown on the local device.",
    sourceUri: "brace-project://northstar/README.md",
  }).memory;
  seed.close();

  const client = await connect(context, {
    BRACE_DATABASE_PATH: databasePath,
    BRACE_MCP_WRITE: "0",
  });
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name);
  assert.ok(names.includes("brace_search"));
  assert.ok(names.includes("brace_session_start"));
  assert.ok(names.includes("brace_get_memory"));
  assert.ok(names.includes("brace_status"));
  assert.ok(!names.includes("brace_remember"));
  assert.ok(!names.includes("brace_session_handoff"));
  assert.ok(!names.includes("brace_forget_memory"));

  const searched = await client.callTool({
    name: "brace_search",
    arguments: { query: "offline markdown", scope: "project:northstar" },
  });
  assert.equal(searched.structuredContent.mode, "lexical");
  assert.equal(searched.structuredContent.memories[0].id, memory.id);
  assert.match(searched.content[0].text, /Keep indexing offline/);

  const started = await client.callTool({
    name: "brace_session_start",
    arguments: { topic: "offline markdown", scope: "project:northstar" },
  });
  assert.equal(started.structuredContent.retentionAvailable, false);
  assert.equal(started.structuredContent.memories[0].id, memory.id);

  const prompts = await client.listPrompts();
  assert.ok(prompts.prompts.some((prompt) => prompt.name === "brace_memory_compass"));
  const compass = await client.getPrompt({
    name: "brace_memory_compass",
    arguments: { topic: "finish Northstar", retainOutcomes: "true" },
  });
  assert.match(compass.messages[0].content.text, /brace_session_start/);
  assert.match(compass.messages[0].content.text, /read-only/);

  const resource = await client.readResource({ uri: "brace://status" });
  assert.match(resource.contents[0].text, /"schemaVersion": 6/);
  await client.close();
});

test("MCP writes are separately enabled and destructive forgetting remains absent", async (context) => {
  const { databasePath } = fixture(context);
  const client = await connect(context, {
    BRACE_DATABASE_PATH: databasePath,
    BRACE_MCP_WRITE: "1",
    BRACE_MCP_DESTRUCTIVE: "0",
  });
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name);
  assert.ok(names.includes("brace_remember"));
  assert.ok(names.includes("brace_session_handoff"));
  assert.ok(names.includes("brace_record_decision"));
  assert.ok(names.includes("brace_run_skill"));
  assert.ok(!names.includes("brace_forget_memory"));

  const handedOff = await client.callTool({
    name: "brace_session_handoff",
    arguments: {
      topic: "Northstar migration",
      scope: "project:northstar",
      summary: "The migration workflow now has an explicit restart verification step.",
      decisions: ["Keep imported sources canonical."],
      lessons: ["Verify the database after restart."],
      nextActions: ["Run the packaged MCP smoke test."],
    },
  });
  assert.equal(handedOff.structuredContent.memory.kind, "summary");
  assert.match(handedOff.structuredContent.memory.title, /Session handoff/);

  const remembered = await client.callTool({
    name: "brace_remember",
    arguments: {
      kind: "lesson",
      scope: "project:northstar",
      title: "Restart after migrations",
      content: "Verify the local database after every schema migration and process restart.",
      tags: ["storage", "testing"],
    },
  });
  assert.equal(remembered.structuredContent.duplicate, false);
  assert.equal(remembered.structuredContent.memory.kind, "lesson");

  await client.close();
  const stored = new MemoryStore(databasePath);
  assert.equal(stored.stats().memories, 2);
  assert.equal(stored.search("schema migration").results[0].title, "Restart after migrations");
  stored.close();
});

test("destructive MCP mode advertises forgetting with a destructive annotation", async (context) => {
  const { databasePath } = fixture(context);
  const client = await connect(context, {
    BRACE_DATABASE_PATH: databasePath,
    BRACE_MCP_WRITE: "1",
    BRACE_MCP_DESTRUCTIVE: "1",
  });
  const listed = await client.listTools();
  const forget = listed.tools.find((tool) => tool.name === "brace_forget_memory");
  assert.equal(forget.annotations.destructiveHint, true);
  assert.equal(forget.annotations.readOnlyHint, false);
  await client.close();
});
