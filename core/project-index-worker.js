"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parentPort, workerData } = require("node:worker_threads");
const { sha256 } = require("./memory-store");
const {
  chunkText,
  extractEntities,
  listProjectFiles,
  redactContentSecrets,
} = require("./project-indexer");

if (!parentPort) throw new Error("The project index worker requires a parent port.");

const cancellation = new Int32Array(workerData.cancellation);
const signal = { get aborted() { return Atomics.load(cancellation, 0) === 1; } };

function ensureActive() {
  if (signal.aborted) throw new Error("Project indexing was cancelled.");
}

function waitForAck(index) {
  return new Promise((resolve, reject) => {
    const onMessage = (message) => {
      if (message?.type === "cancel") {
        Atomics.store(cancellation, 0, 1);
        parentPort.off("message", onMessage);
        reject(new Error("Project indexing was cancelled."));
        return;
      }
      if (message?.type === "ack" && message.index === index) {
        parentPort.off("message", onMessage);
        resolve();
      }
    };
    parentPort.on("message", onMessage);
  });
}

async function run() {
  const scan = listProjectFiles(workerData.rootPath, {
    maxFiles: workerData.maxFiles,
    maxFileBytes: workerData.maxFileBytes,
    signal,
  });
  parentPort.postMessage({
    type: "scan",
    total: scan.files.length,
    truncated: scan.truncated,
    ignoredByRule: scan.ignoredByRule,
    skippedLarge: scan.skippedLarge,
    skippedUnsupported: scan.skippedUnsupported,
    errors: scan.errors,
  });
  let skippedBinary = 0;
  let skippedUnsupportedEncoding = 0;
  const readErrors = [];
  for (let index = 0; index < scan.files.length; index += 1) {
    ensureActive();
    const file = scan.files[index];
    let raw;
    try {
      raw = fs.readFileSync(file.absolutePath);
    } catch (error) {
      readErrors.push({ path: file.relativePath, code: String(error?.code || "read-failed") });
      parentPort.postMessage({ type: "progress", phase: "reading", completed: index + 1, total: scan.files.length, readErrors: readErrors.length });
      continue;
    }
    if (raw.includes(0)) {
      skippedBinary += 1;
      parentPort.postMessage({ type: "progress", phase: "reading", completed: index + 1, total: scan.files.length, skippedBinary });
      continue;
    }
    let decoded;
    try {
      decoded = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    } catch {
      skippedUnsupportedEncoding += 1;
      parentPort.postMessage({ type: "progress", phase: "reading", completed: index + 1, total: scan.files.length, skippedUnsupportedEncoding });
      continue;
    }
    ensureActive();
    const scanned = redactContentSecrets(decoded);
    const prepared = {
      relativePath: file.relativePath,
      size: file.size,
      mtimeMs: file.mtimeMs,
      contentHash: sha256(raw),
      mediaType: path.extname(file.relativePath).toLowerCase() === ".md" ? "text/markdown" : "text/plain",
      chunks: chunkText(scanned.value, workerData.chunking || {}),
      entities: extractEntities(scanned.value),
      redacted: scanned.redacted,
      redactionTypes: scanned.findings,
    };
    parentPort.postMessage({ type: "file", index, total: scan.files.length, file: prepared });
    await waitForAck(index);
  }
  ensureActive();
  parentPort.postMessage({
    type: "complete",
    skippedBinary,
    skippedUnsupportedEncoding,
    readErrors,
  });
}

run().catch((error) => {
  parentPort.postMessage({
    type: signal.aborted ? "cancelled" : "error",
    message: String(error?.message || "Project index worker failed.").slice(0, 500),
  });
});
