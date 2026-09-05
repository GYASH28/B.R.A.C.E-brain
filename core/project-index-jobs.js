"use strict";

const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { assertProjectRoot } = require("./project-indexer");

function runProjectIndexWorker(input, onFile) {
  const rootPath = assertProjectRoot(input.rootPath);
  const cancellation = new SharedArrayBuffer(4);
  const cancelView = new Int32Array(cancellation);
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "project-index-worker.js"), {
      workerData: {
        rootPath,
        maxFiles: input.maxFiles,
        maxFileBytes: input.maxFileBytes,
        chunking: {
          maxCharacters: input.maxCharacters,
          overlapCharacters: input.overlapCharacters,
        },
        cancellation,
      },
    });
    let settled = false;
    let scan = null;
    let processing = Promise.resolve();
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      input.signal?.removeEventListener("abort", cancel);
      callback();
    };
    const cancel = () => {
      Atomics.store(cancelView, 0, 1);
      worker.postMessage({ type: "cancel" });
    };
    input.signal?.addEventListener("abort", cancel, { once: true });
    if (input.signal?.aborted) cancel();
    worker.on("message", (message) => {
      if (message?.type === "scan") {
        scan = message;
        input.onProgress?.({ phase: "scanning", completed: message.total, total: message.total, ...message });
        return;
      }
      if (message?.type === "progress") {
        input.onProgress?.(message);
        return;
      }
      if (message?.type === "file") {
        processing = processing.then(async () => {
          if (settled) return;
          await onFile(message.file, message.index, message.total);
          worker.postMessage({ type: "ack", index: message.index });
        }).catch((error) => {
          cancel();
          finish(() => reject(error));
        });
        return;
      }
      if (message?.type === "complete") {
        processing.then(() => finish(() => resolve({ ...scan, ...message, rootPath })), (error) => finish(() => reject(error)));
        return;
      }
      if (message?.type === "cancelled") {
        finish(() => reject(new Error("Project indexing was cancelled.")));
        return;
      }
      if (message?.type === "error") finish(() => reject(new Error(message.message || "Project index worker failed.")));
    });
    worker.on("error", (error) => finish(() => reject(error)));
    worker.on("exit", (code) => {
      if (!settled && code !== 0) finish(() => reject(new Error(`Project index worker exited with code ${code}.`)));
    });
  });
}

module.exports = { runProjectIndexWorker };
