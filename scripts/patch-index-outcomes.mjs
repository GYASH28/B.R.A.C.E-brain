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
replaceRequired(
  '          set({ notice: "Project indexed. Original files were not changed." });\n',
  '          set({ notice: summarizeIndexOutcome(result) });\n',
  "project import notice",
);
replaceRequired(
  '        await api.reindexBraceProject(id);\n        await refresh();\n        set({ notice: "Project index is current." });\n',
  '        const result = await api.reindexBraceProject(id);\n        await refresh();\n        set({ notice: summarizeIndexOutcome(result, { refresh: true }) });\n',
  "project reindex notice",
);
fs.writeFileSync(file, source.replace(/\r\n/g, "\n"));
process.stdout.write("Applied clear project index outcome reporting.\n");
