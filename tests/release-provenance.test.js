"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const releaseWorkflow = fs.readFileSync(path.join(root, ".github", "workflows", "release.yml"), "utf8");
const distribution = fs.readFileSync(path.join(root, "docs", "DISTRIBUTION.md"), "utf8");

test("new tagged releases require pinned GitHub/Sigstore provenance", () => {
  assert.match(releaseWorkflow, /id-token:\s*write/);
  assert.match(releaseWorkflow, /attestations:\s*write/);
  assert.match(releaseWorkflow, /artifact-metadata:\s*write/);
  assert.match(
    releaseWorkflow,
    /uses:\s*actions\/attest@1e69f48acb82d1966a394da916b4c1698aa569d6\s*#\s*v4\.2\.2/,
  );
  assert.doesNotMatch(releaseWorkflow, /uses:\s*actions\/attest@v\d+/);
  assert.match(releaseWorkflow, /subject-checksums:\s*release-files\/SHA256SUMS\.txt/);
  assert.match(releaseWorkflow, /steps\.provenance\.outputs\.bundle-path/);
  assert.match(releaseWorkflow, /release-files\/brace-\$\{release_version\}\.provenance\.json/);
});

test("distribution docs distinguish future provenance from the existing 0.7.0 release and publisher signing", () => {
  assert.match(distribution, /published `v0\.7\.0` preview/);
  assert.match(distribution, /0\.7\.0 assets do \*\*not\*\* have a BRACE provenance bundle/);
  assert.match(distribution, /gh attestation verify \.\/BRACE-Setup-X\.Y\.Z\.exe/);
  assert.match(distribution, /--signer-workflow GYASH28\/B\.R\.A\.C\.E-brain\/\.github\/workflows\/release\.yml/);
  assert.match(distribution, /does \*\*not\*\* prove that the binary is Microsoft Authenticode-signed/);
  assert.match(distribution, /does not yet claim code-signing, notarization, or reproducible byte-for-byte builds/);
  assert.match(distribution, /never move or reuse the published `v0\.7\.0` tag/);
});
