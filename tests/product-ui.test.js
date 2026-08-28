const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("product navigation maps to implemented memory workflows", () => {
  const app = read("src/components/brace/brace-app.tsx");
  for (const label of [
    "Command center",
    "Knowledge map",
    "Inbox",
    "AI Workspace",
    "Recall",
    "Memory",
    "Timeline",
    "Projects",
    "Skills",
    "Connections",
    "Settings",
  ]) {
    assert.match(app, new RegExp(`label: "${label}"`));
  }
  for (const capability of [
    "Explore synthetic demo",
    "Import a project",
    "Recall with provenance",
    "Record decision",
    "Install manifest",
    "Create SQLite backup",
    "Export portable JSON",
    "Delete all",
  ]) {
    assert.match(app, new RegExp(capability));
  }
  assert.match(app, /function InboxView\(\)/);
  assert.match(app, /function AiWorkspaceView\(\)/);
  assert.match(app, /Retain latest answer/);
  assert.match(app, /No answer becomes durable memory automatically/);
});

test("browser preview is visibly synthetic and desktop mutations do not silently fake success", () => {
  const preview = read("src/lib/brace/browser-preview.ts");
  const store = read("src/lib/brace/store.ts");

  assert.match(preview, /Northstar \(synthetic demo\)/);
  assert.match(preview, /environment: "browser-preview"/);
  assert.match(store, /Memory editing is available in the desktop app/);
  assert.match(store, /Project import is available in the desktop app/);
  assert.match(store, /Skill installation is available in the desktop app/);
});

test("premium workspace interactions remain real, keyboard reachable, and locally persisted", () => {
  const app = read("src/components/brace/brace-app.tsx");
  const styles = read("src/app/globals.css");

  for (const capability of [
    "Command palette",
    "Quick capture",
    "Capture a memory",
    "Keyboard map",
    "Graph preset",
    "Make the workspace fit you",
    "Stored in your local database",
    "Memory intelligence",
    "Keep both as distinct",
    "review queue",
    "LOCAL MEMORY NEEDS ATTENTION",
    "Try again",
  ]) {
    assert.match(app, new RegExp(capability, "i"));
  }
  assert.match(app, /data-brace-state="(?:loading|ready|error)"/);
  assert.match(app, /ctrlKey.*key\.toLowerCase\(\) === "k"/s);
  assert.match(app, /ctrlKey.*key\.toLowerCase\(\) === "n"/s);
  assert.match(app, /data-node-index/);
  assert.match(styles, /data-motion="calm"/);
  assert.match(styles, /data-contrast="high"/);
});

test("knowledge atlas exposes five truthful projections over one real graph", () => {
  const app = read("src/components/brace/brace-app.tsx");
  const layouts = read("src/lib/brace/graph-layouts.ts");
  const memoryStore = read("core/memory-store.js");

  for (const preset of ["rings", "living", "orbit", "flow", "chronicle"]) {
    assert.match(layouts, new RegExp(`id: "${preset}"`));
  }
  assert.match(app, /graphPositions\(layout, nodes, edges, selectedId\)/);
  assert.match(app, /localStorage\.setItem\("brace\.graph-preset"/);
  assert.match(layouts, /timestamp/);
  assert.match(memoryStore, /timestamp:/);
});

test("AI connections are permissioned, guided, and never silently retained", () => {
  const app = read("src/components/brace/brace-app.tsx");
  const connector = read("electron/connector-service.ts");
  const service = read("electron/memory-service.ts");

  for (const client of ["Codex CLI", "Claude Code", "Antigravity", "Any MCP client"]) {
    assert.match(connector, new RegExp(client));
  }
  assert.match(connector, /type ConnectorAccess = "read-only" \| "remember"/);
  assert.match(connector, /execFileAsync/);
  assert.doesNotMatch(connector, /execSync|spawn\([^)]*shell:\s*true/);
  assert.match(connector, /connector-backups/);
  assert.match(connector, /if \(!this\.isConfigured\(id\)\)/);
  assert.match(connector, /did not preserve the BRACE server entry after setup/);
  assert.match(connector, /BRACE_MCP_WRITE/);
  assert.match(connector, /Forgetting remains disabled/);
  assert.match(service, /assistant\.conversations/);
  assert.match(service, /redactSecrets\(prompt\)/);
  assert.match(service, /clipboard\.writeText/);
  assert.match(app, /Retrieved context may be sent to the selected provider/);
  assert.doesNotMatch(app, /connector\.configured \? "Connected"/);
  assert.match(app, /connector\.configured \? "Configured"/);
});

test("the rejected warm-orange brand palette cannot return", () => {
  const surface = `${read("src/components/brace/brace-app.tsx")}\n${read("src/app/globals.css")}`;
  for (const rejected of ["#ff7043", "#ff7a45", "#ff8c5f", "#ff9a72", "#ff956c", "#ff7850"]) {
    assert.doesNotMatch(surface.toLowerCase(), new RegExp(rejected));
  }
});
