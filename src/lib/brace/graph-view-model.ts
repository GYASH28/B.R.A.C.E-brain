import type { GraphEdge, GraphNode } from "./types";

export type GraphDetail = "overview" | "focus" | "all";

export interface GraphDisplayNode extends GraphNode {
  degree: number;
  isCluster?: boolean;
  memberCount?: number;
  showLabel?: boolean;
}

export interface GraphDisplayEdge extends GraphEdge {
  count?: number;
}

export interface GraphViewModel {
  nodes: GraphDisplayNode[];
  edges: GraphDisplayEdge[];
  matchIds: string[];
  totalEligible: number;
  hiddenCount: number;
  clusteredCount: number;
  edgeCount: number;
}

export function filterGraphByScope(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: { projectId: string; projectName?: string; timeRange: string; now?: number },
) {
  const cutoffDays = options.timeRange === "7d" ? 7 : options.timeRange === "30d" ? 30 : options.timeRange === "year" ? 365 : 0;
  const cutoff = cutoffDays ? (options.now ?? Date.now()) - cutoffDays * 86_400_000 : 0;
  const directIds = new Set<string>();
  const recentIds = new Set<string>();
  for (const node of nodes) {
    let belongs = options.projectId === "all" || node.id === options.projectId || node.projectId === options.projectId;
    if (!belongs && node.scope) {
      const scope = node.scope.toLowerCase();
      belongs = scope === `project:${options.projectId}` || Boolean(options.projectName && scope === `project:${options.projectName.toLowerCase()}`);
    }
    if (!belongs && node.sourceUri?.startsWith("brace-project://")) {
      try { belongs = new URL(node.sourceUri).hostname === options.projectId; } catch {}
    }
    const timestamp = new Date(node.timestamp || "").getTime();
    const recent = !cutoff || node.type === "project" || (Number.isFinite(timestamp) && timestamp >= cutoff);
    if (recent) recentIds.add(node.id);
    if (belongs && recent) directIds.add(node.id);
  }
  if (options.projectId !== "all") {
    for (const edge of edges) {
      if (directIds.has(edge.from) && recentIds.has(edge.to)) directIds.add(edge.to);
      if (directIds.has(edge.to) && recentIds.has(edge.from)) directIds.add(edge.from);
    }
  }
  const filteredNodes = nodes.filter((node) => directIds.has(node.id));
  const ids = new Set(filteredNodes.map((node) => node.id));
  return { nodes: filteredNodes, edges: edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) };
}

const NODE_LIMIT: Record<GraphDetail, number> = {
  overview: 140,
  focus: 280,
  all: 520,
};

const EDGE_LIMIT: Record<GraphDetail, number> = {
  overview: 420,
  focus: 900,
  all: 1_600,
};

function nodeTime(node: GraphNode) {
  const value = new Date(node.timestamp || "").getTime();
  return Number.isFinite(value) ? value : 0;
}

/**
 * Builds a bounded, deterministic graph projection for the renderer. The full
 * graph stays in memory and counts remain visible; dense tails become explicit
 * type clusters instead of thousands of SVG elements or silent truncation.
 */
export function buildGraphViewModel(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: {
    detail: GraphDetail;
    activeType: string;
    query: string;
    selectedId: string | null;
  },
): GraphViewModel {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const degree = new Map<string, number>();
  const neighbors = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) continue;
    degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
    if (!neighbors.has(edge.from)) neighbors.set(edge.from, new Set());
    if (!neighbors.has(edge.to)) neighbors.set(edge.to, new Set());
    neighbors.get(edge.from)!.add(edge.to);
    neighbors.get(edge.to)!.add(edge.from);
  }

  const needle = options.query.trim().toLowerCase();
  const matches = new Set(
    needle
      ? nodes
          .filter((node) =>
            (options.activeType === "all" || node.type === options.activeType) &&
            node.label.toLowerCase().includes(needle),
          )
          .map((node) => node.id)
      : [],
  );
  const searchContext = new Set(matches);
  for (const id of matches) {
    for (const neighbor of neighbors.get(id) || []) searchContext.add(neighbor);
  }

  const eligible = nodes.filter((node) => {
    if (needle) return searchContext.has(node.id);
    if (node.id === options.selectedId) return true;
    if (options.activeType !== "all" && node.type !== options.activeType) return false;
    return true;
  });
  const selectedNeighbors = options.selectedId
    ? neighbors.get(options.selectedId) || new Set<string>()
    : new Set<string>();

  const rankScore = new Map(
    eligible.map((node) => [
      node.id,
      (node.id === options.selectedId ? 1_000_000 : 0) +
      (matches.has(node.id) ? 500_000 : 0) +
      (selectedNeighbors.has(node.id) ? 250_000 : 0) +
      (node.type === "project" ? 50_000 : 0) +
      (degree.get(node.id) || 0) * 1_000 +
      Math.floor(nodeTime(node) / 86_400_000),
    ]),
  );
  const ranked = [...eligible].sort((left, right) =>
    (rankScore.get(right.id) || 0) - (rankScore.get(left.id) || 0) ||
    (left.label < right.label ? -1 : left.label > right.label ? 1 : 0),
  );
  const matchIds = ranked.filter((node) => matches.has(node.id)).map((node) => node.id);

  const limit = NODE_LIMIT[options.detail];
  const visible = ranked.slice(0, limit);
  const hidden = ranked.slice(limit);
  const visibleIds = new Set(visible.map((node) => node.id));
  const clusters = new Map<GraphNode["type"], GraphNode[]>();
  for (const node of hidden) {
    const group = clusters.get(node.type) || [];
    group.push(node);
    clusters.set(node.type, group);
  }

  const displayNodes: GraphDisplayNode[] = visible.map((node) => ({
    ...node,
    degree: degree.get(node.id) || 0,
    showLabel:
      node.id === options.selectedId ||
      matches.has(node.id) ||
      selectedNeighbors.has(node.id) ||
      (degree.get(node.id) || 0) >= 4 ||
      visible.length <= 70,
  }));
  const clusterIdByType = new Map<GraphNode["type"], string>();
  for (const [type, members] of clusters) {
    const id = `brace-cluster:${type}`;
    clusterIdByType.set(type, id);
    displayNodes.push({
      id,
      type,
      label: `${members.length.toLocaleString()} more ${type}${members.length === 1 ? "" : "s"}`,
      degree: members.reduce((sum, node) => sum + (degree.get(node.id) || 0), 0),
      isCluster: true,
      memberCount: members.length,
      showLabel: true,
    });
  }

  const projection = new Map<string, string>();
  for (const node of visible) projection.set(node.id, node.id);
  for (const node of hidden) projection.set(node.id, clusterIdByType.get(node.type)!);
  const aggregated = new Map<string, GraphDisplayEdge>();
  for (const edge of edges) {
    const from = projection.get(edge.from);
    const to = projection.get(edge.to);
    if (!from || !to || from === to) continue;
    const key = from < to ? `${from}|${to}` : `${to}|${from}`;
    const current = aggregated.get(key);
    if (current) {
      current.count = (current.count || 1) + 1;
      current.weight = Math.max(current.weight, edge.weight);
      continue;
    }
    aggregated.set(key, {
      ...edge,
      id: `display:${key}`,
      from,
      to,
      count: 1,
    });
  }
  const displayEdges = [...aggregated.values()]
    .sort((left, right) => {
      const leftActive = left.from === options.selectedId || left.to === options.selectedId ? 1 : 0;
      const rightActive = right.from === options.selectedId || right.to === options.selectedId ? 1 : 0;
      return rightActive - leftActive || (right.count || 1) - (left.count || 1) || right.weight - left.weight;
    })
    .slice(0, EDGE_LIMIT[options.detail]);

  return {
    nodes: displayNodes,
    edges: displayEdges,
    matchIds,
    totalEligible: eligible.length,
    hiddenCount: Math.max(0, eligible.length - visible.length),
    clusteredCount: hidden.length,
    edgeCount: edges.length,
  };
}
