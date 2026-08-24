#!/usr/bin/env node

"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const SMOKE_TIMEOUT_MS = 45_000;
const defaultExecutables =
  process.platform === "win32"
    ? [
        path.join(
          root,
          "dist",
          "installer",
          "win-unpacked",
          "BRACE.exe",
        ),
      ]
    : [
        path.join(
          root,
          "dist",
          "installer",
          "linux-unpacked",
          "brace",
        ),
      ];
const executable = path.resolve(
  process.argv[2] || defaultExecutables.find(fs.existsSync) || defaultExecutables[0],
);
const token = `smoke-${Date.now()}-${process.pid}`;
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brace-package-smoke-"));
const configRoot = path.join(temporaryRoot, "config");
const logPaths = ["brace-brain", "BRACE", "brace"].map((directory) =>
  path.join(configRoot, directory, "logs", "main.log"),
);

if (!fs.existsSync(executable)) {
  throw new Error(`Packaged executable not found: ${executable}`);
}

const startedAt = Date.now();
const childArguments = [
  ...(process.platform === "linux" ? ["--no-sandbox"] : []),
  `--smoke-token=${token}`,
];
const child = spawn(executable, childArguments, {
  cwd: path.dirname(executable),
  windowsHide: true,
  stdio: "ignore",
  env: {
    ...process.env,
    BRACE_DATA_DIR: path.join(temporaryRoot, "data"),
    ...(process.platform === "win32"
      ? {
          APPDATA: configRoot,
          LOCALAPPDATA: path.join(temporaryRoot, "local-app-data"),
        }
      : {
          XDG_CONFIG_HOME: configRoot,
          XDG_DATA_HOME: path.join(temporaryRoot, "xdg-data"),
          XDG_CACHE_HOME: path.join(temporaryRoot, "cache"),
        }),
  },
});

const timeout = setTimeout(() => {
  child.kill();
  process.stderr.write("Electron smoke test timed out after 45 seconds.\n");
  process.exitCode = 1;
}, SMOKE_TIMEOUT_MS);

child.on("exit", (code) => {
  clearTimeout(timeout);
  const elapsedMs = Date.now() - startedAt;
  const log = logPaths
    .filter(fs.existsSync)
    .map((logPath) => fs.readFileSync(logPath, "utf8"))
    .join("\n");
  const ready = log.includes(`Smoke ready ${token}`);
  const loaded = log.includes(`Smoke loaded ${token}`);
  const recent = log.slice(Math.max(0, log.lastIndexOf(token) - 2_000));
  const loadFailed = recent.includes("Renderer load failed");
  const result = {
    executable,
    elapsedMs,
    processExitCode: code,
    rendererLoaded: loaded,
    shellReady: ready,
    loadFailed,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!ready || !loaded || loadFailed || elapsedMs > SMOKE_TIMEOUT_MS) {
    process.exitCode = 1;
  }
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});
