#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "electron/memory-service.ts");
let source = fs.readFileSync(filePath, "utf8");
const before = "    let backups = [];";
const after = "    let backups: Array<{ name: string; bytes: number; modifiedAt: string }> = [];";
if (source.includes(before)) {
  source = source.replace(before, after);
} else if (!source.includes(after)) {
  throw new Error("Restore diagnostics type patch could not locate backup inventory declaration.");
}
fs.writeFileSync(filePath, source.replace(/\r\n/g, "\n"));
