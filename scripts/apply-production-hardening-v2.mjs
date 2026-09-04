#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const service = fs.readFileSync(path.join(root, "electron/memory-service.ts"), "utf8");
const contractPath = path.join(root, "electron/ipc-contracts.js");

if (service.includes("const trustedHandle =") && fs.existsSync(contractPath)) {
  let contracts = fs.readFileSync(contractPath, "utf8");
  contracts = contracts.replace(
    'z.enum(["codex", "claude", "antigravity"]), z.enum(["read-only", "read-write", "destructive"])',
    'z.enum(["codex", "claude", "antigravity", "generic"]), z.enum(["read-only", "remember"])',
  );
  fs.writeFileSync(contractPath, contracts);
  process.stdout.write("Hardening already applied; reconciled connector IPC schema.\n");
} else {
  const originalPath = path.join(root, "scripts/apply-production-hardening.mjs");
  let source = fs.readFileSync(originalPath, "utf8");
  source = source.replace(
    'z.enum(["codex", "claude", "antigravity"]), z.enum(["read-only", "read-write", "destructive"])',
    'z.enum(["codex", "claude", "antigravity", "generic"]), z.enum(["read-only", "remember"])',
  );
  const temporary = path.join(root, "scripts/.apply-production-hardening-runtime.mjs");
  fs.writeFileSync(temporary, source);
  try {
    await import(`${pathToFileURL(temporary).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
