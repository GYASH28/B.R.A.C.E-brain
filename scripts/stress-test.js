"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { MemoryStore } = require("../core/memory-store");

const recordCount = Math.max(1_000, Number(process.env.BRACE_STRESS_RECORDS) || 5_000);
const searchCount = Math.max(100, Number(process.env.BRACE_STRESS_SEARCHES) || 500);
const thresholds = {
  createTotalMs: 120_000,
  searchP95Ms: 200,
  searchP99Ms: 400,
  boundedReadMs: 2_000,
  exportMs: 10_000,
  restartMs: 3_000,
  rssGrowthMb: 256,
};

function elapsed(start) {
  return performance.now() - start;
}

function percentile(values, quantile) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * quantile))];
}

function round(value) {
  return Number(value.toFixed(2));
}

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-stress-"));
  const databasePath = path.join(directory, "brace.sqlite3");
  const backupPath = path.join(directory, "backup", "brace.sqlite3");
  const startRss = process.memoryUsage().rss;
  let store;
  let peer;
  let restored;

  try {
    store = new MemoryStore(databasePath);
    const ids = [];
    const createStart = performance.now();
    for (let index = 0; index < recordCount; index += 1) {
      const project = index % 25;
      const result = store.createMemory({
        kind: ["fact", "decision", "lesson", "procedure", "warning"][index % 5],
        scope: `project:synthetic-${project}`,
        title: `Synthetic operating note ${index}`,
        summary: `Bounded fixture ${index} for long-running project ${project}.`,
        content: `Synthetic evidence record ${index}. Retrieval marker-${index % 97}. This is generated in a temporary stress profile.`,
        tags: ["synthetic", `project-${project}`, `batch-${index % 10}`],
        confidence: 0.5 + ((index % 50) / 100),
        importance: (index % 100) / 100,
      });
      ids.push(result.memory.id);
    }
    const createTotalMs = elapsed(createStart);
    assert.equal(store.stats().memories, recordCount);

    for (const id of ids.slice(0, 20)) store.setMemoryPinned(id, true);
    assert.equal(store.listMemories({ pinned: true, limit: 100 }).length, 20);

    const searchSamples = [];
    for (let index = 0; index < searchCount; index += 1) {
      const sampleStart = performance.now();
      const result = store.search(`synthetic marker-${index % 97}`, { limit: 20 });
      searchSamples.push(elapsed(sampleStart));
      assert.equal(result.mode, "lexical");
      assert.ok(result.results.length > 0);
    }

    const readStart = performance.now();
    const bounded = store.listMemories({ limit: 500 });
    const graph = store.graph({ limit: 500 });
    const boundedReadMs = elapsed(readStart);
    assert.equal(bounded.length, 500);
    assert.ok(graph.nodes.length <= 2_000);

    for (let index = 0; index < 250; index += 1) {
      const id = ids[index];
      store.touchMemory(id);
      store.setMemoryPinned(id, index % 3 === 0);
      if (index % 10 === 0) {
        const current = store.getMemory(id);
        store.updateMemory(id, { summary: `${current.summary} Reviewed ${index}.` });
      }
    }

    const secret = ["gh", "p_", "stressfixture", "1234567890abcdef"].join("");
    const hostile = store.createMemory({
      kind: "not-a-real-kind",
      title: "Malformed input remains bounded\u0000",
      content: `access_token=${secret} ${"x".repeat(220_000)}`,
      tags: [null, 42, "synthetic"],
    }).memory;
    assert.ok(hostile.content.length <= 200_000);
    assert.doesNotMatch(hostile.content, /ghp_/);
    assert.match(hostile.content, /REDACTED/);

    peer = new MemoryStore(databasePath);
    assert.equal(peer.stats().memories, recordCount + 1);
    const peerMemory = peer.createMemory({
      kind: "fact",
      title: "Concurrent profile writer",
      content: "A second WAL connection can append while the primary profile remains readable.",
    }).memory;
    assert.equal(store.getMemory(peerMemory.id).title, "Concurrent profile writer");
    assert.equal(store.db.prepare("PRAGMA quick_check").get().quick_check, "ok");

    const exportStart = performance.now();
    const exported = store.exportData();
    const exportMs = elapsed(exportStart);
    assert.equal(exported.memories.length, recordCount + 2);

    const backup = await store.backup(backupPath);
    assert.ok(backup.bytes > 0);
    restored = new MemoryStore(backupPath);
    assert.equal(restored.stats().memories, recordCount + 2);
    assert.equal(restored.stats().pinnedMemories, store.stats().pinnedMemories);
    assert.equal(restored.db.prepare("PRAGMA quick_check").get().quick_check, "ok");
    restored.close();
    restored = null;

    peer.close();
    peer = null;
    store.close();
    store = null;

    const restartStart = performance.now();
    store = new MemoryStore(databasePath);
    const restartMs = elapsed(restartStart);
    assert.equal(store.stats().memories, recordCount + 2);
    assert.ok(store.listMemories({ pinned: true, limit: 500 }).length > 0);
    assert.equal(store.db.prepare("PRAGMA quick_check").get().quick_check, "ok");

    const report = {
      corpus: { memories: recordCount + 2, searches: searchCount, churnOperations: 775 },
      timingsMs: {
        createTotal: round(createTotalMs),
        searchP50: round(percentile(searchSamples, 0.5)),
        searchP95: round(percentile(searchSamples, 0.95)),
        searchP99: round(percentile(searchSamples, 0.99)),
        boundedRead: round(boundedReadMs),
        export: round(exportMs),
        restart: round(restartMs),
      },
      rssGrowthMb: round((process.memoryUsage().rss - startRss) / 1024 / 1024),
      checks: [
        "large-corpus-create",
        "lexical-search-latency",
        "bounded-list-and-graph",
        "update-pin-touch-churn",
        "malformed-input-redaction",
        "two-connection-wal",
        "backup-restore",
        "restart-persistence",
        "sqlite-quick-check",
      ],
    };

    assert.ok(createTotalMs < thresholds.createTotalMs, `creation took ${round(createTotalMs)}ms`);
    assert.ok(percentile(searchSamples, 0.95) < thresholds.searchP95Ms, `search p95 exceeded ${thresholds.searchP95Ms}ms`);
    assert.ok(percentile(searchSamples, 0.99) < thresholds.searchP99Ms, `search p99 exceeded ${thresholds.searchP99Ms}ms`);
    assert.ok(boundedReadMs < thresholds.boundedReadMs, `bounded read took ${round(boundedReadMs)}ms`);
    assert.ok(exportMs < thresholds.exportMs, `export took ${round(exportMs)}ms`);
    assert.ok(restartMs < thresholds.restartMs, `restart took ${round(restartMs)}ms`);
    assert.ok(report.rssGrowthMb < thresholds.rssGrowthMb, `RSS grew ${report.rssGrowthMb}MB`);
    process.stdout.write(`${JSON.stringify({ ok: true, thresholds, ...report }, null, 2)}\n`);
  } finally {
    try { restored?.close(); } catch {}
    try { peer?.close(); } catch {}
    try { store?.close(); } catch {}
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

main().catch((error) => {
  process.stderr.write(`BRACE stress gate failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
