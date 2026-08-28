#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceDirectory = path.join(root, "artifacts", "screenshots");
const destinationDirectory = path.join(root, "website", "builds", "brace", "assets");
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
  "app-connections.png",
  "app-settings.png",
];

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

fs.mkdirSync(destinationDirectory, { recursive: true });
for (const name of approved) {
  const source = path.join(sourceDirectory, name);
  const destination = path.join(destinationDirectory, name);
  if (!fs.existsSync(source)) {
    throw new Error(`Run npm run electron:e2e first; missing ${source}`);
  }
  assertPng(source);
  fs.copyFileSync(source, destination);
}

process.stdout.write(`${JSON.stringify({ copied: approved.length, destination: path.relative(root, destinationDirectory) }, null, 2)}\n`);
