const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Electron renderer is isolated behind a narrow BRACE bridge", () => {
  const main = read("electron/main.ts");
  const preload = read("electron/preload.ts");
  const assets = read("electron/secure-asset-response.js");

  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /webSecurity:\s*true/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /will-attach-webview/);
  assert.match(main, /createSecureAssetResponse/);
  assert.match(main, /url\.hostname !== "app"/);
  assert.match(main, /smokeRendererInteractive/);
  assert.match(main, /data-brace-state/);
  assert.match(assets, /Content-Security-Policy/);
  assert.match(assets, /inlineScriptHashes/);
  assert.doesNotMatch(assets, /script-src[^;]*unsafe-inline/);
  assert.match(main, /candidate\.startsWith/);

  for (const operation of [
    "getBraceSnapshot",
    "searchBrace",
    "createBraceMemory",
    "setBraceMemoryPinned",
    "resolveBraceMemoryReview",
    "forgetBraceMemory",
    "addBraceProject",
    "installBraceSkill",
    "exportBraceData",
    "backupBraceData",
    "deleteAllBraceData",
    "listBraceConnectors",
    "installBraceConnector",
    "runBraceAssistant",
    "clearBraceAssistantHistory",
    "copyBraceText",
    "getBraceAutomations",
    "createBraceAutomation",
    "updateBraceAutomation",
    "setBraceAutomationEnabled",
    "runBraceAutomation",
    "retryBraceAutomationRun",
    "deleteBraceAutomation",
    "setBraceAutomationsPaused",
  ]) {
    assert.match(preload, new RegExp(`${operation}:`));
  }
  assert.doesNotMatch(preload, /shell|exec|spawn|readFile|writeFile|openExternal/);
});

test("desktop storage is external and startup contains no machine path fallback", () => {
  const service = read("electron/memory-service.ts");
  const main = read("electron/main.ts");

  assert.match(service, /options\.dataRoot \|\| defaultDataRoot\(\)/);
  assert.match(service, /brace\.sqlite3/);
  assert.doesNotMatch(main, /BRAIN_VAULT_DIR|REQUESTED_VAULT|LEGACY_VAULT/);
  assert.doesNotMatch(main, /local-api|agent-runtime|backup-manager/);
  assert.match(service, /brace:set-memory-pinned/);
  assert.match(service, /Boolean\(pinned\)/);
});
