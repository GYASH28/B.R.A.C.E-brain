import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { buildGraphViewModel, filterGraphByScope } from "../src/lib/brace/graph-view-model.ts";

function denseGraph(count = 2_500) {
  const types = ["project", "source", "memory", "decision", "entity"];
  const nodes = Array.from({ length: count }, (_, index) => ({
    id: `node-${index}`,
    type: types[index % types.length],
    label: index === count - 1 ? "Needle document" : `Knowledge node ${index}`,
    timestamp: new Date(Date.UTC(2026, 0, 1 + (index % 200))).toISOString(),
  }));
  const edges = [];
  for (let index = 1; index < count; index += 1) {
    edges.push({ id: `edge-${index}`, from: `node-${index}`, to: `node-${Math.floor((index - 1) / 2)}`, relation: "related_to", weight: .8, sourceId: null });
    if (index > 5) edges.push({ id: `cross-${index}`, from: `node-${index}`, to: `node-${index - 5}`, relation: "supports", weight: .6, sourceId: null });
  }
  return { nodes, edges };
}

test("dense Brain projections remain bounded, explicit, and fast", () => {
  const graph = denseGraph();
  const startedAt = performance.now();
  const model = buildGraphViewModel(graph.nodes, graph.edges, {
    detail: "overview",
    activeType: "all",
    query: "",
    selectedId: "node-2499",
  });
  const duration = performance.now() - startedAt;

  assert.ok(duration < 500, `dense projection took ${duration.toFixed(1)}ms`);
  assert.ok(model.nodes.length <= 145, "overview includes at most 140 real nodes plus five explicit clusters");
  assert.ok(model.edges.length <= 420);
  assert.equal(model.totalEligible, 2_500);
  assert.equal(model.hiddenCount, 2_360);
  assert.ok(model.nodes.some((node) => node.id === "node-2499"), "selected node remains visible");
  assert.ok(model.nodes.some((node) => node.isCluster && node.memberCount > 0), "dense tail is represented, not silently dropped");
});

test("ten-thousand-node logical brains remain a bounded renderer projection", () => {
  const graph = denseGraph(10_000);
  const startedAt = performance.now();
  const model = buildGraphViewModel(graph.nodes, graph.edges, {
    detail: "overview",
    activeType: "all",
    query: "",
    selectedId: "node-9999",
  });
  const duration = performance.now() - startedAt;
  assert.ok(duration < 1_000, `10k projection took ${duration.toFixed(1)}ms`);
  assert.ok(model.nodes.length <= 145);
  assert.ok(model.edges.length <= 420);
  assert.equal(model.totalEligible, 10_000);
  assert.ok(model.nodes.some((node) => node.id === "node-9999"));
});

test("Brain search keeps the matching document and its immediate context", () => {
  const graph = denseGraph();
  const model = buildGraphViewModel(graph.nodes, graph.edges, {
    detail: "overview",
    activeType: "all",
    query: "needle document",
    selectedId: null,
  });

  assert.ok(model.nodes.some((node) => node.id === "node-2499"));
  assert.ok(model.totalEligible > 1, "search includes connected context");
  assert.ok(model.totalEligible < 10, "search does not render the unrelated corpus");
  assert.equal(model.hiddenCount, 0);
});

test("Brain type filters preserve explicit counts and selected context", () => {
  const graph = denseGraph(1_000);
  const model = buildGraphViewModel(graph.nodes, graph.edges, {
    detail: "focus",
    activeType: "source",
    query: "",
    selectedId: "node-2",
  });

  assert.equal(model.totalEligible, 201);
  assert.ok(model.nodes.some((node) => node.id === "node-2"), "a selected memory is retained while filtering documents");
  assert.ok(model.nodes.filter((node) => node.id !== "node-2").every((node) => node.type === "source"));
});

test("Brain search exposes ordered direct matches and a truthful empty state", () => {
  const graph = denseGraph(1_000);
  const matches = buildGraphViewModel(graph.nodes, graph.edges, {
    detail: "overview",
    activeType: "source",
    query: "node 22",
    selectedId: "node-2",
  });
  assert.ok(matches.matchIds.length > 0);
  assert.ok(matches.matchIds.every((id) => graph.nodes.find((node) => node.id === id)?.type === "source"));
  assert.ok(matches.nodes.some((node) => matches.matchIds.includes(node.id)));

  const empty = buildGraphViewModel(graph.nodes, graph.edges, {
    detail: "overview",
    activeType: "all",
    query: "there-is-no-such-node",
    selectedId: "node-2",
  });
  assert.deepEqual(empty.matchIds, []);
  assert.equal(empty.nodes.length, 0);
  assert.equal(empty.edges.length, 0);
});

test("Brain project and time scope keeps relevant recent relations only", () => {
  const now = Date.parse("2026-09-05T12:00:00.000Z");
  const nodes = [
    { id: "project-a", type: "project", label: "Alpha", timestamp: "2024-01-01T00:00:00.000Z" },
    { id: "source-a", type: "source", label: "Current brief", projectId: "project-a", timestamp: "2026-09-04T00:00:00.000Z" },
    { id: "memory-a", type: "memory", label: "Current decision", scope: "project:alpha", timestamp: "2026-09-03T00:00:00.000Z" },
    { id: "old-a", type: "memory", label: "Old note", scope: "project:alpha", timestamp: "2025-01-01T00:00:00.000Z" },
    { id: "source-b", type: "source", label: "Other project", projectId: "project-b", timestamp: "2026-09-04T00:00:00.000Z" },
  ];
  const edges = [
    { id: "a", from: "source-a", to: "project-a", relation: "belongs_to", weight: 1, sourceId: null },
    { id: "b", from: "memory-a", to: "source-a", relation: "derived_from", weight: 1, sourceId: "source-a" },
    { id: "old", from: "old-a", to: "source-a", relation: "derived_from", weight: 1, sourceId: "source-a" },
  ];
  const result = filterGraphByScope(nodes, edges, { projectId: "project-a", projectName: "Alpha", timeRange: "7d", now });
  assert.deepEqual(result.nodes.map((node) => node.id), ["project-a", "source-a", "memory-a"]);
  assert.equal(result.edges.length, 2);
});
