#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = (relative) => path.join(root, relative);
const read = (relative) => fs.readFileSync(file(relative), "utf8");
const write = (relative, value) => fs.writeFileSync(file(relative), value.replace(/\r\n/g, "\n"));

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Production security patch could not locate: ${label}`);
  }
  return source.replace(search, replacement);
}

function patchMemoryService() {
  let source = read("electron/memory-service.ts");

  if (!source.includes('import ipcSecurityModule from "./ipc-security";')) {
    const connectorImport = [
      'import {',
      '  BraceConnectorService,',
      '  type ConnectorAccess,',
      '  type ConnectorId,',
      '} from "./connector-service";',
      '',
    ].join("\n");
    source = replaceRequired(
      source,
      connectorImport,
      connectorImport +
        'import ipcSecurityModule from "./ipc-security";\n' +
        'import ipcContractsModule from "./ipc-contracts";\n\n',
      "connector-service import block",
    );
  }

  if (!source.includes("const { assertTrustedIpcSender }")) {
    source = replaceRequired(
      source,
      'const { AutomationEngine } = automationModule as any;\n',
      'const { AutomationEngine } = automationModule as any;\n' +
        'const { assertTrustedIpcSender } = ipcSecurityModule as any;\n' +
        'const { validateIpcArguments } = ipcContractsModule as any;\n',
      "automation module destructure",
    );
  }

  const marker = "export function registerBraceMemoryIpc(service: BraceMemoryService) {\n";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("Production security patch could not locate IPC registration.");

  const prefix = source.slice(0, start + marker.length);
  let body = source.slice(start + marker.length);

  if (!body.includes("const trustedHandle =")) {
    const helper = [
      '  const trustedHandle = (channel: string, listener: (event: any, ...args: any[]) => any) => {',
      '    ipcMain.handle(channel, (event, ...args: any[]) => {',
      '      const window = (service as any).getWindow();',
      '      assertTrustedIpcSender(event, {',
      '        expectedWebContentsId: window && !window.isDestroyed()',
      '          ? window.webContents.id',
      '          : undefined,',
      '      });',
      '      const validated = validateIpcArguments(channel, args);',
      '      return listener(event, ...validated);',
      '    });',
      '  };',
      '',
    ].join("\n");
    body = helper + body;
  }

  body = body.replace(/ipcMain\.handle\("brace:/g, 'trustedHandle("brace:');
  source = prefix + body;

  const directPrivileged = source
    .slice(start)
    .match(/ipcMain\.handle\("brace:/g);
  if (directPrivileged) {
    throw new Error("A direct privileged ipcMain.handle registration remains after hardening.");
  }

  write("electron/memory-service.ts", source);
}

function patchEmbeddings() {
  let source = read("core/embedding-adapters.js");

  if (!source.includes('redirect: "error"')) {
    source = replaceRequired(
      source,
      '    const response = await fetch(url, { ...init, signal: controller.signal });\n    const body = await response.text();\n',
      '    const response = await fetch(url, { ...init, redirect: "error", signal: controller.signal });\n' +
        '    const declaredBytes = Number(response.headers.get("content-length") || 0);\n' +
        '    if (declaredBytes > 5_000_000) {\n' +
        '      throw new Error("Embedding provider response exceeded the 5 MB safety limit.");\n' +
        '    }\n' +
        '    const body = await response.text();\n' +
        '    if (Buffer.byteLength(body, "utf8") > 5_000_000) {\n' +
        '      throw new Error("Embedding provider response exceeded the 5 MB safety limit.");\n' +
        '    }\n',
      "embedding fetch",
    );
  }

  if (!source.includes("Embedding provider redirects are not allowed.")) {
    source = replaceRequired(
      source,
      '  } catch (error) {\n    if (error?.name === "AbortError") throw new Error("Embedding request timed out or was cancelled.");\n    throw error;\n',
      '  } catch (error) {\n' +
        '    if (error?.name === "AbortError") throw new Error("Embedding request timed out or was cancelled.");\n' +
        '    const errorText = String(error?.cause?.message || error?.message || "");\n' +
        '    if (/redirect/i.test(errorText)) {\n' +
        '      throw new Error("Embedding provider redirects are not allowed.");\n' +
        '    }\n' +
        '    throw error;\n',
      "embedding error handler",
    );
  }

  write("core/embedding-adapters.js", source);
}

function patchEmbeddingTests() {
  let source = read("tests/embedding-adapters.test.js");
  if (!source.includes('test("embedding requests reject provider redirects"')) {
    source += [
      '',
      'test("embedding requests reject provider redirects", async (context) => {',
      '  const server = http.createServer((_request, response) => {',
      '    response.writeHead(302, { Location: "/redirected" });',
      '    response.end();',
      '  });',
      '  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));',
      '  context.after(() => server.close());',
      '  const address = server.address();',
      '  const adapter = createOllamaEmbeddingAdapter({',
      '    endpoint: `http://127.0.0.1:${address.port}`,',
      '    model: "synthetic-embed",',
      '  });',
      '  await assert.rejects(() => adapter.embed(["alpha"]), /redirect/i);',
      '});',
      '',
      'test("embedding requests reject oversized responses before parsing", async (context) => {',
      '  const server = http.createServer((_request, response) => {',
      '    response.writeHead(200, {',
      '      "Content-Type": "application/json",',
      '      "Content-Length": "5000001",',
      '    });',
      '    response.end("{}");',
      '  });',
      '  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));',
      '  context.after(() => server.close());',
      '  const address = server.address();',
      '  const adapter = createOllamaEmbeddingAdapter({',
      '    endpoint: `http://127.0.0.1:${address.port}`,',
      '    model: "synthetic-embed",',
      '  });',
      '  await assert.rejects(() => adapter.embed(["alpha"]), /5 MB safety limit/);',
      '});',
      '',
    ].join("\n");
  }
  write("tests/embedding-adapters.test.js", source);
}

function patchBoundaryTest() {
  let source = read("tests/electron-boundary.test.js");
  if (!source.includes("privileged IPC registrations validate sender and payload")) {
    source += [
      '',
      'test("privileged IPC registrations validate sender and payload", () => {',
      '  const service = read("electron/memory-service.ts");',
      '  const security = read("electron/ipc-security.js");',
      '  const contracts = read("electron/ipc-contracts.js");',
      '',
      '  assert.match(service, /assertTrustedIpcSender/);',
      '  assert.match(service, /validateIpcArguments/);',
      '  assert.match(service, /const trustedHandle/);',
      '  assert.doesNotMatch(service, /ipcMain\\.handle\\("brace:/);',
      '  assert.match(security, /senderFrame/);',
      '  assert.match(security, /sender\\.mainFrame/);',
      '  assert.match(security, /brain:/);',
      '  assert.match(contracts, /zod/);',
      '  assert.match(contracts, /brace:delete-all/);',
      '  assert.match(contracts, /brace:run-assistant/);',
      '  assert.match(contracts, /brace:prepare-assistant-context/);',
      '  assert.match(contracts, /brace:cancel-project-index/);',
      '  assert.match(contracts, /brace:stage-restore/);',
      '});',
      '',
    ].join("\n");
  }
  write("tests/electron-boundary.test.js", source);
}

patchMemoryService();
patchEmbeddings();
patchEmbeddingTests();
patchBoundaryTest();
process.stdout.write("Applied BRACE production security wiring.\n");
