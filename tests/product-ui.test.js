const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("product navigation maps to implemented memory workflows", () => {
  const app = read("src/components/brace/brace-app.tsx");
  for (const label of [
    "Overview",
    "Recall",
    "Memories",
    "Timeline",
    "Graph",
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
    "Graph layout",
    "Make the workspace fit you",
    "Stored in your local database",
  ]) {
    assert.match(app, new RegExp(capability, "i"));
  }
  assert.match(app, /ctrlKey.*key\.toLowerCase\(\) === "k"/s);
  assert.match(app, /ctrlKey.*key\.toLowerCase\(\) === "n"/s);
  assert.match(app, /data-node-index/);
  assert.match(styles, /data-motion="calm"/);
  assert.match(styles, /data-contrast="high"/);
});

test("the rejected warm-orange brand palette cannot return", () => {
  const surface = `${read("src/components/brace/brace-app.tsx")}\n${read("src/app/globals.css")}`;
  for (const rejected of ["#ff7043", "#ff7a45", "#ff8c5f", "#ff9a72", "#ff956c", "#ff7850"]) {
    assert.doesNotMatch(surface.toLowerCase(), new RegExp(rejected));
  }
});
