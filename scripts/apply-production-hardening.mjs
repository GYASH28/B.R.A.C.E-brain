#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.replace(/\r\n/g, "\n"));
};
const replaceOnce = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Hardening transform failed: ${label}`);
  return source.replace(search, replacement);
};

write("electron/ipc-security.js", `"use strict";

function senderUrl(event) {
  const frameUrl = event?.senderFrame?.url;
  if (typeof frameUrl === "string" && frameUrl) return frameUrl;
  try {
    return String(event?.sender?.getURL?.() || "");
  } catch {
    return "";
  }
}

function isTrustedIpcSender(event, options = {}) {
  const sender = event?.sender;
  const frame = event?.senderFrame;
  if (!sender || !frame) return false;
  if (sender.mainFrame && frame !== sender.mainFrame) return false;
  if (options.expectedWebContentsId !== undefined && sender.id !== options.expectedWebContentsId) return false;

  let parsed;
  try {
    parsed = new URL(senderUrl(event));
  } catch {
    return false;
  }

  const development = options.development ?? process.env.NODE_ENV === "development";
  if (development) {
    return parsed.protocol === "http:" &&
      parsed.hostname === "127.0.0.1" &&
      parsed.port === "3000";
  }
  return parsed.protocol === "brain:" && parsed.hostname === "app";
}

function assertTrustedIpcSender(event, options = {}) {
  if (!isTrustedIpcSender(event, options)) {
    const error = new Error("Rejected untrusted BRACE IPC sender.");
    error.code = "BRACE_UNTRUSTED_IPC_SENDER";
    throw error;
  }
}

module.exports = { assertTrustedIpcSender, isTrustedIpcSender, senderUrl };
`);

write("electron/ipc-contracts.js", `"use strict";

const { z } = require("zod");

const id = z.string().trim().min(1).max(240);
const shortText = z.string().max(2_048);
const confirmation = z.string().max(120);
const boundedUnknown = (maxBytes, label) => z.unknown().superRefine((value, ctx) => {
  let encoded;
  try { encoded = JSON.stringify(value); } catch { encoded = null; }
  if (encoded === undefined || encoded === null || Buffer.byteLength(encoded, "utf8") > maxBytes) {
    ctx.addIssue({ code: "custom", message: `${label} exceeds the local IPC size limit.` });
  }
});
const objectPayload = boundedUnknown(256_000, "IPC payload");
const automationPayload = boundedUnknown(192_000, "Automation payload");

const schemas = new Map([
  ["brace:get-snapshot", z.tuple([])],
  ["brace:initialize-demo", z.tuple([])],
  ["brace:search", z.tuple([z.object({
    query: z.string().trim().min(1).max(12_000),
    scope: z.string().max(500).optional(),
    kinds: z.array(z.string().max(80)).max(24).optional(),
    since: z.string().max(100).optional(),
    projectId: z.string().max(240).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }).passthrough()])],
  ["brace:list-memories", z.tuple([objectPayload.optional()])],
  ["brace:get-memory", z.tuple([id])],
  ["brace:create-memory", z.tuple([objectPayload])],
  ["brace:update-memory", z.tuple([id, objectPayload])],
  ["brace:set-memory-pinned", z.tuple([id, z.boolean()])],
  ["brace:resolve-memory-review", z.tuple([z.object({ leftId: id, rightId: id, outcome: z.enum(["distinct", "keep-left", "keep-right"]) })])],
  ["brace:forget-memory", z.tuple([id])],
  ["brace:add-evidence", z.tuple([id, objectPayload])],
  ["brace:list-timeline", z.tuple([objectPayload.optional()])],
  ["brace:create-decision", z.tuple([objectPayload])],
  ["brace:get-graph", z.tuple([objectPayload.optional()])],
  ["brace:add-project", z.tuple([])],
  ["brace:reindex-project", z.tuple([id])],
  ["brace:install-skill", z.tuple([])],
  ["brace:set-skill-enabled", z.tuple([id, z.boolean()])],
  ["brace:remove-skill", z.tuple([id])],
  ["brace:run-skill", z.tuple([id, shortText, objectPayload])],
  ["brace:set-embedding-config", z.tuple([z.object({
    enabled: z.boolean(),
    endpoint: z.string().trim().max(2_048).optional(),
    model: z.string().trim().max(240).optional(),
  }).strict()])],
  ["brace:export", z.tuple([])],
  ["brace:backup", z.tuple([])],
  ["brace:delete-all", z.tuple([confirmation])],
  ["brace:list-connectors", z.tuple([])],
  ["brace:install-connector", z.tuple([z.enum(["codex", "claude", "antigravity"]), z.enum(["read-only", "read-write", "destructive"])])],
  ["brace:run-assistant", z.tuple([z.object({ client: z.enum(["codex", "claude"]), prompt: z.string().trim().min(1).max(12_000) }).strict()])],
  ["brace:clear-assistant-history", z.tuple([])],
  ["brace:copy-text", z.tuple([z.string().min(1).max(200_000)])],
  ["brace:get-automations", z.tuple([])],
  ["brace:create-automation", z.tuple([automationPayload])],
  ["brace:update-automation", z.tuple([id, automationPayload])],
  ["brace:set-automation-enabled", z.tuple([id, z.boolean()])],
  ["brace:run-automation", z.tuple([id, objectPayload])],
  ["brace:retry-automation-run", z.tuple([id, z.boolean()])],
  ["brace:delete-automation", z.tuple([id])],
  ["brace:set-automations-paused", z.tuple([z.boolean()])],
]);

function validateIpcArguments(channel, args) {
  const schema = schemas.get(channel);
  if (!schema) throw new Error(`No IPC schema registered for ${channel}.`);
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    const error = new Error(`Invalid BRACE IPC request for ${channel}.`);
    error.code = "BRACE_INVALID_IPC_REQUEST";
    throw error;
  }
  return parsed.data;
}

module.exports = { schemas, validateIpcArguments };
`);

let service = read("electron/memory-service.ts");
service = replaceOnce(
  service,
  'import {\n  BraceConnectorService,\n  type ConnectorAccess,\n  type ConnectorId,\n} from "./connector-service";\n',
  'import {\n  BraceConnectorService,\n  type ConnectorAccess,\n  type ConnectorId,\n} from "./connector-service";\nimport ipcSecurityModule from "./ipc-security";\nimport ipcContractsModule from "./ipc-contracts";\n',
  "memory-service imports",
);
service = replaceOnce(
  service,
  'const { AutomationEngine } = automationModule as any;\n',
  'const { AutomationEngine } = automationModule as any;\nconst { assertTrustedIpcSender } = ipcSecurityModule as any;\nconst { validateIpcArguments } = ipcContractsModule as any;\n',
  "memory-service hardening modules",
);
const registerMarker = 'export function registerBraceMemoryIpc(service: BraceMemoryService) {\n';
const registerIndex = service.indexOf(registerMarker);
if (registerIndex < 0) throw new Error("Could not locate IPC registration function.");
const beforeRegister = service.slice(0, registerIndex);
let registerBody = service.slice(registerIndex + registerMarker.length);
registerBody = registerBody.replaceAll("ipcMain.handle(", "trustedHandle(");
service = beforeRegister + registerMarker + `  const trustedHandle = (channel: string, listener: (event: any, ...args: any[]) => any) => {\n    ipcMain.handle(channel, (event, ...args: any[]) => {\n      const window = service["getWindow"]();\n      assertTrustedIpcSender(event, {\n        expectedWebContentsId: window && !window.isDestroyed() ? window.webContents.id : undefined,\n      });\n      const validated = validateIpcArguments(channel, args);\n      return listener(event, ...validated);\n    });\n  };\n` + registerBody;
write("electron/memory-service.ts", service);

let embedding = read("core/embedding-adapters.js");
embedding = replaceOnce(
  embedding,
  '    const response = await fetch(url, { ...init, signal: controller.signal });\n    const body = await response.text();\n',
  '    const response = await fetch(url, { ...init, redirect: "error", signal: controller.signal });\n    const declaredBytes = Number(response.headers.get("content-length") || 0);\n    if (declaredBytes > 5_000_000) throw new Error("Embedding provider response exceeded the 5 MB safety limit.");\n    const body = await response.text();\n    if (Buffer.byteLength(body, "utf8") > 5_000_000) throw new Error("Embedding provider response exceeded the 5 MB safety limit.");\n',
  "embedding response bounds",
);
embedding = replaceOnce(
  embedding,
  '  } catch (error) {\n    if (error?.name === "AbortError") throw new Error("Embedding request timed out or was cancelled.");\n    throw error;\n',
  '  } catch (error) {\n    if (error?.name === "AbortError") throw new Error("Embedding request timed out or was cancelled.");\n    if (/redirect/i.test(String(error?.cause?.message || error?.message || ""))) {\n      throw new Error("Embedding provider redirects are not allowed.");\n    }\n    throw error;\n',
  "embedding redirect error",
);
write("core/embedding-adapters.js", embedding);

let embeddingTests = read("tests/embedding-adapters.test.js");
embeddingTests += `\n\ntest("embedding requests reject provider redirects", async (context) => {\n  const server = http.createServer((_request, response) => {\n    response.writeHead(302, { Location: "/redirected" });\n    response.end();\n  });\n  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));\n  context.after(() => server.close());\n  const address = server.address();\n  const adapter = createOllamaEmbeddingAdapter({ endpoint: \`http://127.0.0.1:\${address.port}\`, model: "synthetic-embed" });\n  await assert.rejects(() => adapter.embed(["alpha"]), /redirect/i);\n});\n\ntest("embedding requests reject oversized responses before parsing", async (context) => {\n  const server = http.createServer((_request, response) => {\n    response.writeHead(200, { "Content-Type": "application/json", "Content-Length": "5000001" });\n    response.end("{}");\n  });\n  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));\n  context.after(() => server.close());\n  const address = server.address();\n  const adapter = createOllamaEmbeddingAdapter({ endpoint: \`http://127.0.0.1:\${address.port}\`, model: "synthetic-embed" });\n  await assert.rejects(() => adapter.embed(["alpha"]), /5 MB safety limit/);\n});\n`;
write("tests/embedding-adapters.test.js", embeddingTests);

write("tests/ipc-security.test.js", `"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { isTrustedIpcSender, assertTrustedIpcSender } = require("../electron/ipc-security");
const { validateIpcArguments } = require("../electron/ipc-contracts");

function eventFor(url, options = {}) {
  const frame = { url };
  const sender = { id: options.id || 7, mainFrame: frame, getURL: () => url };
  return { sender, senderFrame: options.child ? { url } : frame };
}

test("production IPC accepts only the BRACE main frame", () => {
  assert.equal(isTrustedIpcSender(eventFor("brain://app/index.html"), { development: false, expectedWebContentsId: 7 }), true);
  assert.equal(isTrustedIpcSender(eventFor("https://example.com/"), { development: false }), false);
  assert.equal(isTrustedIpcSender(eventFor("brain://evil/index.html"), { development: false }), false);
  assert.equal(isTrustedIpcSender(eventFor("brain://app/index.html", { child: true }), { development: false }), false);
  assert.equal(isTrustedIpcSender(eventFor("brain://app/index.html"), { development: false, expectedWebContentsId: 8 }), false);
  assert.throws(() => assertTrustedIpcSender(eventFor("https://example.com/"), { development: false }), /untrusted/i);
});

test("development IPC remains exact-loopback only", () => {
  assert.equal(isTrustedIpcSender(eventFor("http://127.0.0.1:3000/"), { development: true }), true);
  assert.equal(isTrustedIpcSender(eventFor("http://localhost:3000/"), { development: true }), false);
  assert.equal(isTrustedIpcSender(eventFor("http://127.0.0.1:3001/"), { development: true }), false);
});

test("IPC schemas reject malformed and oversized privileged calls", () => {
  assert.deepEqual(validateIpcArguments("brace:get-snapshot", []), []);
  assert.throws(() => validateIpcArguments("brace:get-snapshot", ["unexpected"]), /Invalid BRACE IPC request/);
  assert.throws(() => validateIpcArguments("brace:run-assistant", [{ client: "codex", prompt: "x".repeat(12_001) }]), /Invalid BRACE IPC request/);
  assert.throws(() => validateIpcArguments("brace:set-embedding-config", [{ enabled: true, endpoint: "http://127.0.0.1:11434", model: "x", extra: true }]), /Invalid BRACE IPC request/);
  assert.throws(() => validateIpcArguments("brace:copy-text", ["x".repeat(200_001)]), /Invalid BRACE IPC request/);
});
`);

const vercelPath = "website/builds/brace/vercel.json";
const vercel = JSON.parse(read(vercelPath));
const securityHeaders = [
  { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Frame-Options", value: "DENY" },
];
vercel.headers = [
  { source: "/(.*)", headers: securityHeaders },
  ...(vercel.headers || []).filter((item) => item.source !== "/(.*)"),
];
write(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`);

write("tests/website-security-headers.test.js", `"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("public website deployment declares restrictive security headers", () => {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../website/builds/brace/vercel.json"), "utf8"));
  const global = config.headers.find((entry) => entry.source === "/(.*)");
  assert.ok(global, "global header rule should exist");
  const headers = Object.fromEntries(global.headers.map((header) => [header.key.toLowerCase(), header.value]));
  assert.match(headers["content-security-policy"], /default-src 'self'/);
  assert.match(headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["x-frame-options"], "DENY");
  assert.ok(headers["permissions-policy"]);
  assert.ok(headers["referrer-policy"]);
});
`);

write("docs/PRODUCTION_AUDIT.md", `# BRACE production audit\n\nBaseline commit: \`769afc901d934bd42d3e123848a961bf88b03a71\`\n\nThis document is the live production-hardening issue register. It distinguishes verified findings from future improvements and records the regression evidence required before an item is considered complete.\n\n| Priority | Subsystem | Finding | Fix / invariant | Regression evidence | Status |\n| --- | --- | --- | --- | --- | --- |\n| P0 | Dependencies | Next.js 16.3.2 was locked below the patched 16.3.3 line for the August 2026 critical advisory. | Upgrade Next.js and eslint-config-next to the current patched stable release and regenerate the lockfile. | npm audit + full verify + Electron E2E. | In progress |\n| P0 | Electron IPC | Privileged IPC handlers did not independently validate caller frame/origin. | Every privileged handler passes through a single main-frame + origin + webContents-id validation gate. | tests/ipc-security.test.js + Electron E2E. | Implemented on hardening branch |\n| P0 | Electron IPC | Runtime payload validation was inconsistent and often relied on TypeScript/\`any\`. | Every registered IPC channel has a bounded runtime Zod tuple schema. | malformed/oversize IPC unit tests + typecheck. | Implemented on hardening branch |\n| P1 | Embeddings | Provider redirects could cross the originally validated endpoint boundary; provider responses had no explicit byte ceiling. | Reject redirects and cap provider responses before parsing. | redirect + oversized response tests. | Implemented on hardening branch |\n| P1 | Website | Public deployment lacked a global browser security-header policy. | Add CSP, nosniff, referrer, permissions and framing restrictions. | website-security-headers test + deployed header verification. | Implemented on hardening branch |\n| P1 | Indexing | Project traversal/read operations are synchronous in the Electron process and can block interaction on large projects. | Move heavy scan/read/chunk work to a bounded worker and stream cancellable progress. | large-project responsiveness + cancellation tests. | Planned |\n| P1 | Indexing | Filename filtering cannot catch credentials stored in ordinary text filenames. | Add .braceignore and best-effort content secret redaction/exclusion before persistence/provider boundaries. | synthetic secret fixtures. | Planned |\n| P1 | Recovery | Backup exists but restore and verified automatic pre-migration recovery are not first-class flows. | Add pre-migration backups, integrity checks and atomic restore. | released-schema migration/restore fixtures. | Planned |\n| P1 | Architecture | Desktop product UI is concentrated in a very large brace-app.tsx and broad store. | Split by product domain without changing behavior; keep global state only where global. | UI E2E + visual regression. | Planned |\n| P2 | Website | Historic versioned CSS/JS assets have accumulated around the static launch surface. | Inventory actual loads, delete proven dead assets and establish reproducible source/build output. | visual/layout/a11y/performance suite. | Planned |\n| P2 | Distribution | Preview artifacts have checksums/SBOM but stable release still needs signing/provenance/upgrade qualification. | Code signing, provenance and previous-release upgrade test before stable label. | release-candidate workflow. | Planned |\n\n## Existing strengths to preserve\n\n- local SQLite + FTS5, WAL, foreign keys and transactional migrations\n- evidence/source provenance separation\n- sandboxed Electron renderer with context isolation and Node disabled\n- read-only-by-default AI/MCP boundaries\n- typed declarative automations instead of arbitrary code execution\n- Windows/Linux CI, E2E, executable MCP smoke, package audit, SHA-256 and CycloneDX SBOM\n- deterministic website accessibility/layout/focus/interaction/performance/visual audits\n\n## Release rule\n\nDo not label BRACE stable production until P0 items are closed and migration/recovery, packaged Windows/Linux, accessibility, security and upgrade-path gates all pass.\n`);

process.stdout.write("Applied BRACE production hardening milestone 1.\n");
