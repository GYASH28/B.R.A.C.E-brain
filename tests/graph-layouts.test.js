import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { graphPositions, graphPresetDetails } from "../src/lib/brace/graph-layouts.ts";

function nodes(count) {
  const types = ["project", "source", "memory", "decision", "entity"];
  return Array.from({ length: count }, (_, index) => ({
    id: `node-${index}`,
    type: types[index % types.length],
    label: `Node ${index}`,
  }));
}

test("the Neural preset forms two bounded hemispheres around a focus", () => {
  const input = nodes(520);
  const positions = graphPositions("neural", input, [], "node-0");
  assert.equal(positions.size, input.length);
  assert.deepEqual(positions.get("node-0"), { x: 500, y: 310, lane: "bridge" });
  assert.ok([...positions.values()].every((point) => point.x >= 34 && point.x <= 966 && point.y >= 34 && point.y <= 586));
  assert.ok(graphPresetDetails.some((preset) => preset.id === "neural"));
});

test("bounded graph layout stays responsive at the maximum renderer detail", () => {
  const input = nodes(520);
  const startedAt = performance.now();
  const positions = graphPositions("neural", input, [], "node-0");
  const duration = performance.now() - startedAt;
  assert.equal(positions.size, 520);
  assert.ok(duration < 250, `maximum-detail layout took ${duration.toFixed(1)}ms`);
});
