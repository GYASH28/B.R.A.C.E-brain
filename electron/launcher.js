"use strict";

const path = require("node:path");

if (process.argv.includes("--mcp")) {
  const serverPath = path.join(__dirname, "..", "mcp", "brace-mcp.cjs");
  Promise.resolve()
    .then(() => require(serverPath))
    .then(({ serveBraceStdio }) => {
      const running = serveBraceStdio();
      process.stderr.write("BRACE MCP server is listening on stdio.\n");
      const shutdown = () => {
        void running.close().finally(() => process.exit(0));
      };
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown startup error";
      process.stderr.write(`BRACE MCP startup failed: ${message}\n`);
      process.exitCode = 1;
    });
} else {
  require("./app-main.js");
}
