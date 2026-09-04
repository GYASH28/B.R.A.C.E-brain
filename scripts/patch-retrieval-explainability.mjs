#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "src/components/brace/brace-app.tsx");
let source = fs.readFileSync(file, "utf8");
const replace = (search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Retrieval explainability patch could not locate ${label}.`);
  source = source.replace(search, () => replacement);
};

if (!source.includes('from "@/lib/brace/retrieval-explain"')) {
  replace(
    'import { useBrace, type BraceView } from "@/lib/brace/store";\n',
    'import { useBrace, type BraceView } from "@/lib/brace/store";\n' +
      'import { explainRetrieval } from "@/lib/brace/retrieval-explain";\n',
    "retrieval helper import",
  );
}

if (!source.includes("function RetrievalWhy(")) {
  replace(
    'function MemoryRow({ memory, onClick }: { memory: BraceMemory; onClick: () => void }) {\n',
    'function RetrievalWhy({ retrieval, mode }: { retrieval?: { lexicalRank: number | null; semanticRank: number | null; semanticSimilarity: number | null } | null; mode?: "lexical" | "semantic" | "hybrid" }) {\n' +
      '  if (!retrieval) return null;\n' +
      '  const explanation = explainRetrieval(retrieval, mode);\n' +
      '  return <div className="mt-2 flex min-w-0 items-center gap-2 text-[9px] text-sky-100/42" title={explanation.detail}><span className="rounded border border-sky-300/10 bg-sky-300/[0.04] px-1.5 py-0.5 font-semibold uppercase tracking-[0.08em] text-sky-100/50">Why this result</span><span className="truncate">{explanation.label}</span></div>;\n' +
      '}\n\n' +
      'function MemoryRow({ memory, onClick }: { memory: BraceMemory; onClick: () => void }) {\n',
    "memory row function",
  );
}

if (!source.includes("<RetrievalWhy retrieval={memory.retrieval}")) {
  replace(
    '        <span className="mt-1 block line-clamp-1 text-xs text-white/35">{memory.summary}</span>\n        <span className="mt-2 flex items-center gap-1.5 text-[10px] text-white/25"><FileText className="h-3 w-3" />{shortUri(memory.sourceUri)}</span>\n',
    '        <span className="mt-1 block line-clamp-1 text-xs text-white/35">{memory.summary}</span>\n' +
      '        <RetrievalWhy retrieval={memory.retrieval} />\n' +
      '        <span className="mt-2 flex items-center gap-1.5 text-[10px] text-white/25"><FileText className="h-3 w-3" />{shortUri(memory.sourceUri)}</span>\n',
    "memory retrieval reason",
  );
}

if (!source.includes("<RetrievalWhy retrieval={source.retrieval}")) {
  replace(
    '<div className="mt-3 flex items-center gap-2 font-mono text-[9px] text-sky-200/45"><span className="truncate">{shortUri(source.uri)}</span><span>·</span><span>{searchResult.mode}</span></div></div></div>\n',
    '<RetrievalWhy retrieval={source.retrieval} mode={searchResult.mode} />' +
      '<div className="mt-3 flex items-center gap-2 font-mono text-[9px] text-sky-200/45"><span className="truncate">{shortUri(source.uri)}</span><span>·</span><span>{searchResult.mode}</span></div></div></div>\n',
    "source retrieval reason",
  );
}

fs.writeFileSync(file, source.replace(/\r\n/g, "\n"));
