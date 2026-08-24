#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const outputDirectory = path.join(root, "dist", "electron");
const mcpOutputDirectory = path.join(root, "dist", "mcp");

async function build() {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.rmSync(mcpOutputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.mkdirSync(mcpOutputDirectory, { recursive: true });
  const shared = {
    bundle: true,
    platform: "node",
    target: "node22",
    external: ["electron"],
    sourcemap: false,
    legalComments: "none",
    logLevel: "info",
  };

  await esbuild.build({
    ...shared,
    entryPoints: [path.join(root, "electron", "main.ts")],
    outfile: path.join(outputDirectory, "app-main.js"),
    format: "cjs",
  });
  await esbuild.build({
    entryPoints: [path.join(root, "electron", "launcher.js")],
    outfile: path.join(outputDirectory, "main.js"),
    bundle: false,
    platform: "node",
    target: "node22",
    format: "cjs",
    legalComments: "none",
    logLevel: "info",
  });
  await esbuild.build({
    ...shared,
    entryPoints: [path.join(root, "electron", "memory-service.ts")],
    outfile: path.join(outputDirectory, "memory-service.js"),
    format: "cjs",
  });
  await esbuild.build({
    ...shared,
    entryPoints: [path.join(root, "electron", "preload.ts")],
    outfile: path.join(outputDirectory, "preload.js"),
    format: "cjs",
  });
  await esbuild.build({
    entryPoints: [path.join(root, "scripts", "mcp-server.mjs")],
    outfile: path.join(mcpOutputDirectory, "brace-mcp.cjs"),
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    define: { "import.meta.url": '"brace-bundled:"' },
    sourcemap: false,
    legalComments: "none",
    logLevel: "info",
  });
}

build().catch((error) => {
  process.stderr.write(`Electron build failed: ${error.message}\n`);
  process.exitCode = 1;
});
