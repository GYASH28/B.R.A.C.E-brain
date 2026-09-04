"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { Worker } = require("node:worker_threads");
const esbuild = require("esbuild");
const { MemoryStore } = require("../core/memory-store");

function runWorker(workerPath, workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData });
    worker.on("message", (message) => {
      if (message?.type === "result") resolve(message.result);
      if (message?.type === "error") reject(new Error(message.error));
    });
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`worker exited ${code}`));
    });
  });
}

test("project worker indexes a project through its own SQLite connection", async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-index-worker-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  const projectRoot = path.join(directory, "project");
  const databasePath = path.join(directory, "profile", "brace.sqlite3");
  const workerPath = path.join(directory, "project-index-worker.cjs");
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "README.md"), "# Worker fixture\n\nIndexing happens outside the caller thread.\n");

  const initial = new MemoryStore(databasePath);
  initial.close();

  await esbuild.build({
    entryPoints: [path.resolve(__dirname, "../electron/project-index-worker.ts")],
    outfile: workerPath,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    logLevel: "silent",
  });

  let timerFired = false;
  const timer = setTimeout(() => { timerFired = true; }, 0);
  const result = await runWorker(workerPath, { databasePath, rootPath: projectRoot, embeddingConfig: null });
  clearTimeout(timer);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(timerFired, true, "caller event loop should remain responsive while the worker indexes");
  assert.equal(result.indexed, 1);

  const store = new MemoryStore(databasePath);
  assert.equal(store.searchSources("outside caller thread").results.length, 1);
  store.close();
});
