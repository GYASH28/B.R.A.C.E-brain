#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/lib/brace/store.ts");
let source = fs.readFileSync(file, "utf8");
const replaceRequired = (search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Index outcome patch could not locate ${label}.`);
  source = source.replace(search, replacement);
};

if (!source.includes('from "./index-outcome"')) {
  replaceRequired(
    'import { browserPreviewSnapshot, searchBrowserPreview } from "./browser-preview";\n',
    'import { browserPreviewSnapshot, searchBrowserPreview } from "./browser-preview";\nimport { summarizeIndexOutcome } from "./index-outcome";\n',
    "index outcome import",
  );
}
if (!source.includes("summarizeIndexOutcome(result)")) {
  replaceRequired(
    '          set({ notice: "Project indexed. Original files were not changed." });',
    '          set({ notice: summarizeIndexOutcome(result) });',
    "project import notice",
  );
}
if (!source.includes("summarizeIndexOutcome(result, { refresh: true })")) {
  if (!source.includes("result = await api.reindexBraceProject(id)")) {
    replaceRequired(
      '        try { await api.reindexBraceProject(id); } finally { set({ indexTask: null }); }',
      '        let result;\n        try { result = await api.reindexBraceProject(id); } finally { set({ indexTask: null }); }',
      "project reindex result",
    );
  }
  replaceRequired(
    '        set({ notice: "Project index is current." });',
    '        set({ notice: summarizeIndexOutcome(result, { refresh: true }) });',
    "project reindex notice",
  );
}
fs.writeFileSync(file, source.replace(/\r\n/g, "\n"));
process.stdout.write("Applied clear project index outcome reporting.\n");
