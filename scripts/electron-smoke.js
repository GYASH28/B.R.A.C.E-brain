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
const smokeResultPath = path.join(temporaryRoot, "smoke-result.json");

function findLogFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findLogFiles(candidate));
    else if (entry.name.toLowerCase() === "main.log") files.push(candidate);
  }
  return files;
}

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
  stdio: ["ignore", "ignore", "pipe"],
  env: {
    ...process.env,
    BRACE_DATA_DIR: path.join(temporaryRoot, "data"),
    BRACE_SMOKE_RESULT_PATH: smokeResultPath,
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
let stderrOutput = "";
child.stderr.on("data", (chunk) => {
  stderrOutput = `${stderrOutput}${chunk}`.slice(-4_000);
});

const timeout = setTimeout(() => {
  child.kill();
  process.stderr.write("Electron smoke test timed out after 45 seconds.\n");
  process.exitCode = 1;
}, SMOKE_TIMEOUT_MS);

child.on("exit", (code) => {
  clearTimeout(timeout);
  const elapsedMs = Date.now() - startedAt;
  const logPaths = findLogFiles(temporaryRoot);
  const log = logPaths
    .map((logPath) => fs.readFileSync(logPath, "utf8"))
    .join("\n");
  let smokeResult = {};
  try {
    smokeResult = JSON.parse(fs.readFileSync(smokeResultPath, "utf8"));
  } catch {}
  const markerMatches = smokeResult.token === token;
  const ready = (markerMatches && smokeResult.shellReady === true) || log.includes(`Smoke ready ${token}`);
  const loaded = (markerMatches && smokeResult.rendererLoaded === true) || log.includes(`Smoke loaded ${token}`);
  const recent = log.slice(Math.max(0, log.lastIndexOf(token) - 2_000));
  const loadFailed = (markerMatches && smokeResult.loadFailed === true) || recent.includes("Renderer load failed");
  const result = {
    executable,
    elapsedMs,
    processExitCode: code,
    rendererLoaded: loaded,
    shellReady: ready,
    loadFailed,
    logsFound: logPaths.map((logPath) => path.relative(temporaryRoot, logPath)),
    stderr: stderrOutput.trim() || null,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!ready || !loaded || loadFailed || elapsedMs > SMOKE_TIMEOUT_MS) {
    process.exitCode = 1;
  }
  fs.rmSync(temporaryRoot, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
});
