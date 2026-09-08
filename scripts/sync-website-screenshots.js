#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const sourceDirectory = path.join(root, "artifacts", "screenshots");
const destinationDirectory = path.join(root, "website", "builds", "brace", "assets");
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const approved = [
  "app-onboarding.png",
  "app-overview.png",
  "app-memory-review.png",
  "app-recall.png",
  "app-timeline.png",
  "app-graph.png",
  "app-inbox.png",
  "app-ai-workspace.png",
  "app-skills.png",
  "app-automations.png",
  "app-company.png",
  "app-connections.png",
  "app-settings.png",
];

const captureStates = {
  "app-onboarding.png": { route: "/onboarding", state: "welcome" },
  "app-overview.png": { route: "/", state: "overview" },
  "app-memory-review.png": { route: "/memory-review", state: "synthetic-review-queue" },
  "app-recall.png": { route: "/recall", state: "source-backed-result" },
  "app-timeline.png": { route: "/timeline", state: "synthetic-activity" },
  "app-graph.png": { route: "/graph", state: "synthetic-knowledge-graph" },
  "app-inbox.png": { route: "/inbox", state: "synthetic-capture-inbox" },
  "app-ai-workspace.png": { route: "/ai", state: "local-assistant" },
  "app-skills.png": { route: "/skills", state: "skill-library" },
  "app-automations.png": { route: "/automations", state: "guarded-workflows" },
  "app-company.png": { route: "/company", state: "synthetic-company-brief" },
  "app-connections.png": { route: "/connections", state: "read-only-client-setup" },
  "app-settings.png": { route: "/settings", state: "privacy-controls" },
};

function assertPng(filePath) {
  const contents = fs.readFileSync(filePath);
  const signature = contents.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error(`Refusing to publish a non-PNG screenshot: ${filePath}`);
  }
  if (contents.length < 50_000) {
    throw new Error(`Screenshot is unexpectedly small: ${filePath}`);
  }
}

function validateCaptureProvenance(provenance, { name, sha256, width, height }) {
  if (!provenance || typeof provenance !== "object") return false;
  const expectedState = name.replace(/^app-/, "").replace(/\.png$/, "");
  return typeof provenance.capturedAt === "string"
    && !Number.isNaN(Date.parse(provenance.capturedAt))
    && typeof provenance.repositoryRevision === "string"
    && /^[0-9a-f]{40}$/i.test(provenance.repositoryRevision)
    && typeof provenance.workingTreeDirty === "boolean"
    && typeof provenance.appVersion === "string"
    && provenance.workspace === "examples/demo-workspace"
    && provenance.state === expectedState
    && provenance.sha256 === sha256
    && provenance.width === width
    && provenance.height === height;
}

async function main() {
  fs.mkdirSync(destinationDirectory, { recursive: true });
  const revision = childProcess.execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const captures = [];

  for (const name of approved) {
    const source = path.join(sourceDirectory, name);
    const destination = path.join(destinationDirectory, name);
    if (!fs.existsSync(source)) {
      throw new Error(`Run npm run electron:e2e first; missing ${path.relative(root, source)}`);
    }
    assertPng(source);
    fs.copyFileSync(source, destination);
    const contents = fs.readFileSync(destination);
    const metadata = await sharp(contents).metadata();
    const sha256 = crypto.createHash("sha256").update(contents).digest("hex");
    const capturePath = path.join(sourceDirectory, name.replace(/\.png$/, ".capture.json"));
    const provenance = fs.existsSync(capturePath) ? JSON.parse(fs.readFileSync(capturePath, "utf8")) : null;
    if (provenance && !validateCaptureProvenance(provenance, { name, sha256, width: metadata.width, height: metadata.height })) {
      throw new Error(`Capture provenance does not match ${name}; rerun Electron E2E.`);
    }
    captures.push({
      file: name,
      state: captureStates[name].state,
      provenance,
      captureVerified: validateCaptureProvenance(provenance, { name, sha256, width: metadata.width, height: metadata.height }),
      width: metadata.width,
      height: metadata.height,
      bytes: contents.length,
      sha256,
    });
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    appVersion: packageMetadata.version,
    synchronizedFromRevision: revision,
    workspace: "examples/demo-workspace",
    privacy: "Synthetic demo data only. No real user memory is permitted in public captures.",
    viewport: { width: captures[0]?.width || null, height: captures[0]?.height || null },
    captures,
  };
  fs.writeFileSync(path.join(destinationDirectory, "screenshots.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  process.stdout.write(`${JSON.stringify({ copied: approved.length, destination: path.relative(root, destinationDirectory), manifest: "screenshots.manifest.json", revision }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
