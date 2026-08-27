const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("release SBOM root is normalized to the public application identity", () => {
  const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const fixture = {
    bomFormat: "CycloneDX",
    metadata: {
      component: {
        type: "library",
        name: path.basename(root),
        version: packageMetadata.version,
      },
    },
    components: [],
  };
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "normalize-sbom.js")], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify(fixture),
  });

  assert.equal(result.status, 0, result.stderr);
  const normalized = JSON.parse(result.stdout);
  assert.equal(normalized.metadata.component.name, "brace-brain");
  assert.equal(normalized.metadata.component.version, packageMetadata.version);
  assert.equal(normalized.metadata.component.type, "application");
});
