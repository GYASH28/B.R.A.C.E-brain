#!/usr/bin/env node

"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const electronPath = require("electron");

const root = path.resolve(__dirname, "..");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brace-e2e-profile-"));
const sandboxArguments = process.platform === "linux" && process.env.CI
  ? ["--no-sandbox"]
  : [];
let cleaned = false;

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  fs.rmSync(temporaryRoot, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}

const child = spawn(
  electronPath,
  [...sandboxArguments, path.join(__dirname, "electron-e2e.js")],
  {
    cwd: root,
    env: { ...process.env, BRACE_E2E_USER_DATA: temporaryRoot },
    stdio: "inherit",
    windowsHide: true,
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

child.once("error", (error) => {
  cleanup();
  process.stderr.write(`Electron E2E failed to start: ${error.message}\n`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  cleanup();
  if (signal) {
    process.stderr.write(`Electron E2E exited with signal ${signal}.\n`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
