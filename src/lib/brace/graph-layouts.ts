import type { GraphEdge, GraphNode } from "./types";

export type GraphPreset = "neural" | "rings" | "living" | "orbit" | "flow" | "chronicle";

export interface GraphPoint {
  x: number;
  y: number;
  lane?: string;
}

const WIDTH = 1000;
const HEIGHT = 620;
const TYPE_ORDER: GraphNode["type"][] = [
  "project",
  "source",
  "decision",
  "memory",
  "entity",
];

function hash(value: string) {
  return [...value].reduce(
    (total, character) =>
      ((total << 5) - total + character.charCodeAt(0)) | 0,
    0,
  );
}

function fraction(value: string) {
  return (Math.abs(hash(value)) % 10_000) / 10_000;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function pointOnRing(index: number, total: number, radius: number, phase = 0) {
  const angle = phase + (index / Math.max(1, total)) * Math.PI * 2;
  return {
    x: WIDTH / 2 + Math.cos(angle) * radius,
    y: HEIGHT / 2 + Math.sin(angle) * radius,
  };
}

function layoutRings(nodes: GraphNode[], selectedId: string | null) {
  const map = new Map<string, GraphPoint>();
  const selected = nodes.find((node) => node.id === selectedId);
  const core =
    selected ||
    nodes.find((node) => node.type === "project") ||
    nodes[0];
  if (!core) return map;
  map.set(core.id, { x: WIDTH / 2, y: HEIGHT / 2, lane: "core" });

  const remaining = nodes.filter((node) => node.id !== core.id);
  const ringByType: Record<GraphNode["type"], number> = {
    project: 102,
    source: 178,
    decision: 244,
    memory: 244,
    entity: 286,
  };
  TYPE_ORDER.forEach((type, typeIndex) => {
    const group = remaining.filter((node) => node.type === type);
    group.forEach((node, index) => {
      const point = pointOnRing(
        index,
        group.length,
        ringByType[type],
        typeIndex * 0.58 - Math.PI / 2,
      );
      map.set(node.id, { ...point, lane: type });
    });
  });
  return map;
}

function layoutLiving(nodes: GraphNode[]) {
  const map = new Map<string, GraphPoint>();
  const anchors: Record<GraphNode["type"], GraphPoint> = {
    project: { x: 500, y: 295 },
    source: { x: 245, y: 250 },
    decision: { x: 510, y: 105 },
    memory: { x: 770, y: 295 },
    entity: { x: 500, y: 515 },
  };
  TYPE_ORDER.forEach((type) => {
    const group = nodes.filter((node) => node.type === type);
    group.forEach((node, index) => {
      const anchor = anchors[type];
      const angle = fraction(`${node.id}:angle`) * Math.PI * 2;
      const spread =
        (type === "project" ? 30 : 42) +
        fraction(`${node.id}:spread`) * (type === "entity" ? 125 : 88);
      map.set(node.id, {
        x: clamp(anchor.x + Math.cos(angle) * spread, 75, WIDTH - 75),
        y: clamp(anchor.y + Math.sin(angle) * spread, 65, HEIGHT - 65),
        lane: type,
      });
      if (group.length === 1 && type === "project") {
        map.set(node.id, { x: anchor.x, y: anchor.y, lane: type });
      }
      void index;
    });
  });
  return map;
}

/**
 * A deterministic two-hemisphere map. It gives BRACE a recognisable neural
 * silhouette without pretending that deterministic relations are biological
 * or AI-discovered. Project anchors and the current focus form the central
 * bridge; evidence leans left and durable knowledge leans right.
 */
function layoutNeural(nodes: GraphNode[], selectedId: string | null) {
  const map = new Map<string, GraphPoint>();
  const core = nodes.find((node) => node.id === selectedId) ||
    nodes.find((node) => node.type === "project") ||
    nodes[0];
  if (!core) return map;
  map.set(core.id, { x: WIDTH / 2, y: HEIGHT / 2, lane: "bridge" });

  const lane: Record<GraphNode["type"], { side: -1 | 1 | 0; y: number; spreadX: number; spreadY: number }> = {
    project: { side: 0, y: 310, spreadX: 72, spreadY: 185 },
    source: { side: -1, y: 310, spreadX: 280, spreadY: 235 },
    decision: { side: 1, y: 165, spreadX: 235, spreadY: 120 },
    memory: { side: 1, y: 350, spreadX: 285, spreadY: 205 },
    entity: { side: -1, y: 455, spreadX: 225, spreadY: 120 },
  };
  for (const node of nodes) {
    if (node.id === core.id) continue;
    const config = lane[node.type];
    const angle = fraction(`${node.id}:neural-angle`) * Math.PI * 2;
    const depth = .3 + fraction(`${node.id}:neural-depth`) * .7;
    const side = config.side || (fraction(`${node.id}:hemisphere`) > .5 ? 1 : -1);
    const centerX = 500 + side * 178;
    const x = centerX + Math.cos(angle) * config.spreadX * depth * .62;
    const y = config.y + Math.sin(angle) * config.spreadY * depth;
    // The taper approximates the curved outer edge of a brain silhouette.
    const vertical = Math.abs(y - HEIGHT / 2) / (HEIGHT / 2);
    const outer = 454 - vertical * 118;
    map.set(node.id, {
      x: clamp(x, 500 - outer, 500 + outer),
      y: clamp(y, 55, HEIGHT - 55),
      lane: side < 0 ? "evidence" : "memory",
    });
  }
  return map;
}

function layoutOrbit(
  nodes: GraphNode[],
  edges: GraphEdge[],
  selectedId: string | null,
) {
  const map = new Map<string, GraphPoint>();
  const core =
    nodes.find((node) => node.id === selectedId) ||
    nodes.find((node) => node.type === "project") ||
    nodes[0];
  if (!core) return map;
  map.set(core.id, { x: WIDTH / 2, y: HEIGHT / 2, lane: "core" });
  const neighbors = new Set(
    edges
      .filter((edge) => edge.from === core.id || edge.to === core.id)
      .map((edge) => (edge.from === core.id ? edge.to : edge.from)),
  );
  const direct = nodes.filter((node) => neighbors.has(node.id));
  const distant = nodes.filter(
    (node) => node.id !== core.id && !neighbors.has(node.id),
  );
  direct.forEach((node, index) => {
    map.set(node.id, {
      ...pointOnRing(index, direct.length, 165, -Math.PI / 2),
      lane: "direct",
    });
  });
  distant.forEach((node, index) => {
    map.set(node.id, {
      ...pointOnRing(index, distant.length, 275, -Math.PI / 2 + 0.23),
      lane: "distant",
    });
  });
  return map;
}

function layoutFlow(nodes: GraphNode[]) {
  const map = new Map<string, GraphPoint>();
  const xByType: Record<GraphNode["type"], number> = {
    project: 110,
    source: 300,
    decision: 500,
    memory: 700,
    entity: 890,
  };
  TYPE_ORDER.forEach((type) => {
    const group = nodes.filter((node) => node.type === type);
    group.forEach((node, index) => {
      const y =
        group.length === 1
          ? HEIGHT / 2
          : 82 + index * (456 / Math.max(1, group.length - 1));
      map.set(node.id, { x: xByType[type], y, lane: type });
    });
  });
  return map;
}

function validTime(node: GraphNode) {
  const timestamp = new Date(node.timestamp || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function layoutChronicle(nodes: GraphNode[]) {
  const map = new Map<string, GraphPoint>();
  const known = nodes
    .map((node) => ({ node, time: validTime(node) }))
    .filter((entry): entry is { node: GraphNode; time: number } =>
      Number.isFinite(entry.time),
    );
  const minimum = known.length
    ? Math.min(...known.map((entry) => entry.time))
    : 0;
  const maximum = known.length
    ? Math.max(...known.map((entry) => entry.time))
    : 1;
  const span = Math.max(1, maximum - minimum);
  const unknown = nodes.filter((node) => validTime(node) === null);
  const laneY: Record<GraphNode["type"], number> = {
    project: 90,
    source: 205,
    decision: 315,
    memory: 425,
    entity: 535,
  };
  known.forEach(({ node, time }) => {
    const x = 100 + ((time - minimum) / span) * 790;
    const jitter = (fraction(`${node.id}:time`) - 0.5) * 38;
    map.set(node.id, {
      x,
      y: clamp(laneY[node.type] + jitter, 58, HEIGHT - 58),
      lane: node.type,
    });
  });
  unknown.forEach((node, index) => {
    map.set(node.id, {
      x: 920,
      y: clamp(
        laneY[node.type] +
          (index % 5) * 15 -
          30 +
          (fraction(node.id) - 0.5) * 12,
        58,
        HEIGHT - 58,
      ),
      lane: "undated",
    });
  });
  return map;
}

function relaxCollisions(points: Map<string, GraphPoint>, nodes: GraphNode[]) {
  if (nodes.length < 2) return points;
  const minimumDistance = nodes.length <= 70 ? 46 : nodes.length <= 160 ? 30 : 19;
  const iterations = nodes.length > 320 ? 4 : 7;
  for (let pass = 0; pass < iterations; pass += 1) {
    const buckets = new Map<string, number[]>();
    const cellSize = minimumDistance;
    for (let index = 0; index < nodes.length; index += 1) {
      const point = points.get(nodes[index].id);
      if (!point) continue;
      const key = `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}`;
      const bucket = buckets.get(key) || [];
      bucket.push(index);
      buckets.set(key, bucket);
    }
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      const left = points.get(nodes[leftIndex].id);
      if (!left) continue;
      const cellX = Math.floor(left.x / cellSize);
      const cellY = Math.floor(left.y / cellSize);
      const candidates: number[] = [];
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          candidates.push(...(buckets.get(`${cellX + offsetX}:${cellY + offsetY}`) || []));
        }
      }
      for (const rightIndex of candidates) {
        if (rightIndex <= leftIndex) continue;
        const right = points.get(nodes[rightIndex].id);
        if (!right) continue;
        let dx = right.x - left.x;
        let dy = right.y - left.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minimumDistance) continue;
        if (distance < 0.01) {
          const angle = fraction(`${nodes[leftIndex].id}:${nodes[rightIndex].id}`) * Math.PI * 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = (minimumDistance - distance) * 0.36;
        const unitX = dx / distance;
        const unitY = dy / distance;
        left.x = clamp(left.x - unitX * push, 34, WIDTH - 34);
        left.y = clamp(left.y - unitY * push, 34, HEIGHT - 34);
        right.x = clamp(right.x + unitX * push, 34, WIDTH - 34);
        right.y = clamp(right.y + unitY * push, 34, HEIGHT - 34);
      }
    }
  }
  return points;
}

export function graphPositions(
  preset: GraphPreset,
  nodes: GraphNode[],
  edges: GraphEdge[],
  selectedId: string | null,
) {
  const points = preset === "neural"
    ? layoutNeural(nodes, selectedId)
    : preset === "rings"
      ? layoutRings(nodes, selectedId)
    : preset === "living"
      ? layoutLiving(nodes)
      : preset === "flow"
        ? layoutFlow(nodes)
        : preset === "chronicle"
          ? layoutChronicle(nodes)
          : layoutOrbit(nodes, edges, selectedId);
  return relaxCollisions(points, nodes);
}

export type GraphDirection = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/** Find the closest visible node in a requested screen direction. */
export function graphNeighborInDirection(
  nodes: GraphNode[],
  points: Map<string, GraphPoint>,
  currentId: string,
  direction: GraphDirection,
) {
  const origin = points.get(currentId);
  if (!origin) return null;
  const horizontal = direction === "ArrowLeft" || direction === "ArrowRight";
  const sign = direction === "ArrowLeft" || direction === "ArrowUp" ? -1 : 1;
  let best: { id: string; score: number } | null = null;
  for (const node of nodes) {
    if (node.id === currentId) continue;
    const point = points.get(node.id);
    if (!point) continue;
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const primary = (horizontal ? dx : dy) * sign;
    if (primary <= 1) continue;
    const cross = Math.abs(horizontal ? dy : dx);
    const score = primary + cross * 2.35 + (cross / primary) * 90;
    if (!best || score < best.score) best = { id: node.id, score };
  }
  return best?.id || null;
}

export const graphPresetDetails: Array<{
  id: GraphPreset;
  label: string;
  description: string;
  lineage: "Original" | "Public" | "Unified";
}> = [
  {
    id: "neural",
    label: "Neural",
    description: "A two-hemisphere view with evidence and durable knowledge joined through the current focus.",
    lineage: "Unified",
  },
  {
    id: "rings",
    label: "Rings",
    description: "Concentric distance from the selected knowledge core.",
    lineage: "Original",
  },
  {
    id: "living",
    label: "Living",
    description: "Breathing clusters reveal active neighborhoods.",
    lineage: "Original",
  },
  {
    id: "orbit",
    label: "Orbit",
    description: "Direct relationships orbit the selected node.",
    lineage: "Public",
  },
  {
    id: "flow",
    label: "Flow",
    description: "Project to source to decision to durable memory.",
    lineage: "Public",
  },
  {
    id: "chronicle",
    label: "Chronicle",
    description: "Knowledge arranged by its real evolution in time.",
    lineage: "Unified",
  },
];
