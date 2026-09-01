import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { buildGraphViewModel } from "../src/lib/brace/graph-view-model.ts";

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

