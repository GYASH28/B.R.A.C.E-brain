#!/usr/bin/env node

"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

for (const script of ["build-brand-assets.js"]) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
