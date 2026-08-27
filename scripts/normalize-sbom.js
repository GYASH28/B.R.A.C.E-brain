#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
let input = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  try {
    const sbom = JSON.parse(input);
    if (!sbom.metadata?.component) {
      throw new Error("npm did not produce a root SBOM component.");
    }
    sbom.metadata.component.name = packageMetadata.name;
    sbom.metadata.component.version = packageMetadata.version;
    sbom.metadata.component.type = "application";
    process.stdout.write(`${JSON.stringify(sbom, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`SBOM normalization failed: ${error.message}\n`);
    process.exitCode = 1;
  }
});
