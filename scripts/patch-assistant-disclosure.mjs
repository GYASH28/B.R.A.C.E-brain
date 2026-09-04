#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/components/brace/brace-app.tsx");
let source = fs.readFileSync(file, "utf8");
const disclosure = "Retrieved context may be sent to the selected provider.";

if (!source.includes(disclosure)) {
  const current = '<div className="ai-boundary"><ShieldCheck className="h-4 w-4" /><span><strong>Every turn has a visible boundary.</strong> Preview the exact memory summaries and source excerpts first. Send consumes that same short-lived capsule once; changing the question or client invalidates it.</span></div>';
  const replacement = '<div className="ai-boundary"><ShieldCheck className="h-4 w-4" /><span><strong>Every turn has a visible boundary.</strong> Preview the exact memory summaries and source excerpts first. Retrieved context may be sent to the selected provider. Send consumes that same short-lived capsule once; changing the question or client invalidates it.</span></div>';
  if (!source.includes(current)) throw new Error("Assistant disclosure patch could not locate the exact-boundary copy.");
  source = source.replace(current, replacement);
}

fs.writeFileSync(file, source.replace(/\r\n/g, "\n"));
process.stdout.write("Preserved explicit Ask BRACE provider disclosure.\n");
