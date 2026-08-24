#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const electronPath = require("electron");
const { MemoryStore } = require("../core/memory-store");

async function run() {
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import("@modelcontextprotocol/client"),
    import("@modelcontextprotocol/client/stdio"),
  ]);
  const root = path.resolve(__dirname, "..");
  const packagedExecutable = process.argv[2]
    ? path.resolve(process.argv[2])
    : null;
  if (packagedExecutable && !fs.existsSync(packagedExecutable)) {
    throw new Error(`Packaged executable not found: ${packagedExecutable}`);
  }
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brace-electron-mcp-"));
  const databasePath = path.join(temporaryRoot, "brace.sqlite3");
  const seed = new MemoryStore(databasePath);
  seed.createMemory({
    kind: "decision",
    scope: "project:northstar",
    title: "Packaged MCP shares local memory",
    content: "The synthetic Northstar fixture verifies the Electron executable MCP mode.",
  });
  seed.close();

  const client = new Client({ name: "brace-electron-smoke", version: "1.0.0" });
  const sandboxArguments = process.platform === "linux" ? ["--no-sandbox"] : [];
  const windowsMcpScript = packagedExecutable
    ? path.join(
        path.dirname(packagedExecutable),
        "resources",
        "app.asar",
        "dist",
        "mcp",
        "brace-mcp.cjs",
      )
    : path.join(root, "dist", "mcp", "brace-mcp.cjs");
  const windowsNodeMode =
    process.platform === "win32" || process.env.BRACE_MCP_NODE_MODE_SMOKE === "1";
  const transport = new StdioClientTransport({
    command: packagedExecutable || electronPath,
    args: windowsNodeMode
      ? [windowsMcpScript]
      : packagedExecutable
        ? [...sandboxArguments, "--mcp"]
        : [...sandboxArguments, root, "--mcp"],
    cwd: root,
    env: {
      ...process.env,
      BRACE_DATABASE_PATH: databasePath,
      BRACE_MCP_WRITE: "0",
      ...(windowsNodeMode
        ? { ELECTRON_RUN_AS_NODE: "1", BRACE_MCP_DIRECT: "1" }
        : {}),
    },
    stderr: "pipe",
  });
  let serverStderr = "";
  transport.stderr?.on("data", (chunk) => {
    serverStderr += chunk.toString();
  });

  try {
    try {
      await client.connect(transport);
    } catch (error) {
      const detail = serverStderr.trim();
      throw new Error(
        `Electron MCP connection failed${detail ? `: ${detail}` : "."}`,
        { cause: error },
      );
    }
    const result = await client.callTool({
      name: "brace_search",
      arguments: { query: "Electron executable MCP" },
    });
    const memory = result.structuredContent?.memories?.[0];
    if (memory?.title !== "Packaged MCP shares local memory") {
      throw new Error("Electron MCP mode did not return the seeded local memory.");
    }
    process.stdout.write(`${JSON.stringify({
      connected: true,
      readOnly: true,
      executable: packagedExecutable ? "packaged" : "source",
      databaseIsTemporary: databasePath.startsWith(temporaryRoot),
      result: memory.title,
    }, null, 2)}\n`);
  } finally {
    try { await client.close(); } catch {}
    fs.rmSync(temporaryRoot, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
