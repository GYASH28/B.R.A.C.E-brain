#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const lockPath = path.join(root, "node_modules", ".package-lock.json");
if (!fs.existsSync(lockPath)) {
  throw new Error("Install dependencies with npm ci before running the license audit.");
}

const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const allowed = new Set([
  "(MIT OR CC0-1.0)",
  "(WTFPL OR MIT)",
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "CC-BY-4.0",
  "CC0-1.0",
  "ISC",
  "LGPL-3.0-or-later",
  "MIT",
  "MPL-2.0",
  "Python-2.0",
  "WTFPL",
  "WTFPL OR ISC",
]);
const licenses = new Map();
const violations = [];

for (const [location, metadata] of Object.entries(lock.packages || {})) {
  if (!location) continue;
  const license = String(metadata.license || "UNKNOWN");
  licenses.set(license, (licenses.get(license) || 0) + 1);
  if (!allowed.has(license)) violations.push({ location, license });
}

const report = {
  packages: [...licenses.values()].reduce((sum, count) => sum + count, 0),
  licenses: Object.fromEntries([...licenses].sort(([a], [b]) => a.localeCompare(b))),
  violations,
  note: "LGPL libvips packages are dynamically loaded build-time dependencies of Sharp and are not included in the static Electron payload.",
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (violations.length) process.exitCode = 1;
