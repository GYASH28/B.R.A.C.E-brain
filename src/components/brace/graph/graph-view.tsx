"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, ChevronRight, CircleDot, FileSearch, FileText,
  Maximize2, Minimize2, Minus, PanelLeftClose, Plus, RotateCcw, Search, X,
} from "lucide-react";
import { useBrace } from "@/lib/brace/store";
import type { GraphNode } from "@/lib/brace/types";
import {
  graphNeighborInDirection,
  graphPositions,
  graphPresetDetails,
  type GraphPreset,
} from "@/lib/brace/graph-layouts";
import {
  buildGraphViewModel,
  filterGraphByScope,
  type GraphDetail,
  type GraphDisplayEdge,
  type GraphDisplayNode,
} from "@/lib/brace/graph-view-model";

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function shortUri(value?: string | null) {
  if (!value) return "No source attached";
  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).slice(-2).join("/")) || value;
  } catch {
    const parts = value.split(/[\\/]+/).filter(Boolean);
    return parts.slice(-2).join("/");
  }
}

function shortGraphPath(value: string) {
  if (value.startsWith("brace-project://")) return shortUri(value);
  const parts = value.split(/[\\/]+/).filter(Boolean);
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : value;
}

function graphTypePlural(type: GraphNode["type"]) {
  return ({ project: "projects", source: "documents", memory: "memories", decision: "decisions", entity: "ideas" } as const)[type];
}

function EmptyRows({ text }: { text: string }) {
  return <div className="px-5 py-10 text-center text-xs text-white/30">{text}</div>;
}

function GraphSearchControl({ query, matchIds, selectedId, onChange, onNavigate, suffix = "main" }: { query: string; matchIds: string[]; selectedId: string | null; onChange: (value: string) => void; onNavigate: (direction: number) => void; suffix?: string }) {
  const selectedMatch = matchIds.indexOf(selectedId || "");
  const position = matchIds.length ? Math.max(0, selectedMatch) + 1 : 0;
  return (
    <div className="graph-search" data-graph-search={suffix}>
      <Search className="h-4 w-4" />
      <label className="sr-only" htmlFor={`graph-search-${suffix}`}>Find a node</label>
      <input id={`graph-search-${suffix}`} value={query} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && query.trim()) { event.preventDefault(); onNavigate(event.shiftKey ? -1 : 1); } if (event.key === "Escape") onChange(""); }} placeholder="Find a file, memory, decision, or idea…" />
      {query && <span className="graph-search-count" aria-live="polite">{position}/{matchIds.length}</span>}
      {query && matchIds.length > 0 && <div className="graph-search-nav" aria-label="Search matches"><button type="button" onClick={() => onNavigate(-1)} aria-label="Previous graph match"><ArrowLeft className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onNavigate(1)} aria-label="Next graph match"><ArrowRight className="h-3.5 w-3.5" /></button></div>}
      {query && <button type="button" onClick={() => onChange("")} aria-label="Clear graph search"><X className="h-3.5 w-3.5" /></button>}
    </div>
  );
}

export function GraphView() {
  const { snapshot, graphFocusId, setSelectedMemory, setSearchQuery, search, setView } = useBrace();
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [layout, setLayout] = useState<GraphPreset>("neural");
  const [detail, setDetail] = useState<GraphDetail>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorMode, setInspectorMode] = useState<"dossier" | "index">("dossier");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [projectId, setProjectId] = useState("all");
  const [timeRange, setTimeRange] = useState("all");
  const [focusHistory, setFocusHistory] = useState<string[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("brace.graph-preset") as GraphPreset | null;
    if (saved && graphPresetDetails.some((preset) => preset.id === saved)) setLayout(saved);
    const savedDetail = localStorage.getItem("brace.graph-detail") as GraphDetail | null;
    if (savedDetail && ["overview", "focus", "all"].includes(savedDetail)) setDetail(savedDetail);
    setProjectId(localStorage.getItem("brace.graph-project") || "all");
    setTimeRange(localStorage.getItem("brace.graph-time") || "all");
  }, []);
  useEffect(() => {
    if (!graphFocusId) return;
    setSelectedId(graphFocusId);
    setInspectorOpen(true);
    setInspectorMode("dossier");
  }, [graphFocusId]);
  useEffect(() => {
    document.documentElement.classList.toggle("brace-graph-focus-open", isFullscreen);
    return () => document.documentElement.classList.remove("brace-graph-focus-open");
  }, [isFullscreen]);

  const resetViewport = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);
  const toggleFullscreen = useCallback(() => {
    // An app-level focus surface is dependable in Electron and the browser
    // preview, unlike the browser Fullscreen API which can be denied by the
    // host window or platform policy.
    setIsFullscreen((value) => !value);
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFullscreen();
      }
      if (event.key === "Escape" && isFullscreen) {
        event.preventDefault();
        setIsFullscreen(false);
      }
      if (event.key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(`[data-graph-search="${isFullscreen ? "fullscreen" : "main"}"] input`)?.focus();
      }
      if (event.key === "0") {
        event.preventDefault();
        resetViewport();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen, resetViewport, toggleFullscreen]);

  const graph = snapshot?.graph || { nodes: [], edges: [] };
  const filteredGraph = useMemo(() => filterGraphByScope(graph.nodes, graph.edges, {
    projectId,
    projectName: snapshot?.projects.find((project) => project.id === projectId)?.name,
    timeRange,
  }), [graph.edges, graph.nodes, projectId, snapshot?.projects, timeRange]);
  const defaultSelectedId = filteredGraph.nodes.find((node) => node.type === "project")?.id || filteredGraph.nodes[0]?.id || null;
  const effectiveSelectedId = selectedId || defaultSelectedId;
  const model = useMemo(
    () => buildGraphViewModel(filteredGraph.nodes, filteredGraph.edges, { detail, activeType: type, query, selectedId: effectiveSelectedId }),
    [filteredGraph.nodes, filteredGraph.edges, detail, type, query, effectiveSelectedId],
  );
  const originalById = useMemo(() => new Map(filteredGraph.nodes.map((node) => [node.id, node])), [filteredGraph.nodes]);
  const selectedDisplay = model.nodes.find((node) => node.id === effectiveSelectedId) || model.nodes[0];
  const selected = selectedDisplay?.isCluster ? selectedDisplay : originalById.get(selectedDisplay?.id || "") || selectedDisplay;
  const connectedEdges = selected && !selectedDisplay?.isCluster
    ? filteredGraph.edges.filter((edge) => edge.from === selected.id || edge.to === selected.id)
    : [];
  const connectedNodes = connectedEdges
    .map((edge) => originalById.get(edge.from === selected?.id ? edge.to : edge.from))
    .filter(Boolean) as GraphNode[];
  const nodeCounts = useMemo(() => filteredGraph.nodes.reduce<Record<string, number>>((counts, node) => {
    counts[node.type] = (counts[node.type] || 0) + 1;
    return counts;
  }, {}), [filteredGraph.nodes]);

  const selectLayout = (preset: GraphPreset) => {
    setLayout(preset);
    localStorage.setItem("brace.graph-preset", preset);
    resetViewport();
  };
  const selectDetail = (value: GraphDetail) => {
    setDetail(value);
    localStorage.setItem("brace.graph-detail", value);
  };
  const changeQuery = (value: string) => {
    setQuery(value);
    setSelectedId(null);
  };
  const navigateMatch = (direction: number) => {
    if (!model.matchIds.length) return;
    const currentIndex = model.matchIds.indexOf(selectedDisplay?.id || "");
    const nextIndex = currentIndex < 0
      ? direction > 0 ? 0 : model.matchIds.length - 1
      : (currentIndex + direction + model.matchIds.length) % model.matchIds.length;
    selectNode(model.matchIds[nextIndex]);
    setInspectorOpen(true);
  };
  const selectNode = (id: string) => {
    if (effectiveSelectedId && effectiveSelectedId !== id) {
      setFocusHistory((history) => [...history, effectiveSelectedId].slice(-20));
    }
    setSelectedId(id);
  };
  const goBackFocus = () => {
    const previous = focusHistory.at(-1);
    if (!previous) return;
    setFocusHistory((history) => history.slice(0, -1));
    setSelectedId(previous);
    setInspectorOpen(true);
  };
  const focusSelected = () => {
    if (!selectedDisplay) return;
    const point = graphPositions(layout, model.nodes, model.edges, selectedDisplay.id).get(selectedDisplay.id);
    if (!point) return;
    const targetZoom = Math.max(1.15, zoom);
    setZoom(targetZoom);
    setPan({ x: targetZoom * (500 - point.x), y: targetZoom * (310 - point.y) });
  };
  const unfoldCluster = (id: string) => {
    const cluster = model.nodes.find((node) => node.id === id && node.isCluster);
    if (!cluster) return;
    setSelectedId(id);
    setInspectorOpen(true);
    if (detail === "all") {
      setType(cluster.type);
      setSelectedId(null);
      changeQuery("");
    } else {
      selectDetail(detail === "overview" ? "focus" : "all");
    }
  };
  const openSelected = () => {
    if (!selected) return;
    if (selectedDisplay?.isCluster) {
      if (detail === "all") {
        setType(selected.type);
        setSelectedId(null);
        setQuery("");
      } else {
        selectDetail(detail === "overview" ? "focus" : "all");
      }
      return;
    }
    if (selected.type === "memory") {
      const memory = snapshot?.memories.find((item) => item.id === selected.id);
      if (memory) setSelectedMemory(memory);
      return;
    }
    setSearchQuery(selected.label);
    setView("search");
    void search(selected.label);
  };
  if (!snapshot) return null;

  const provenance = selected?.type === "source"
    ? selected.uri
    : selected?.type === "project"
      ? selected.rootPath
      : selected?.type === "memory"
        ? selected.sourceUri
        : null;
  return (
    <div className="brain-workspace">
      <header className="brain-heading">
        <div><span><i /> LIVE LOCAL MODEL</span><h1>Your Brain</h1><p>Navigate the relationships behind your files, memories, decisions, and ideas.</p></div>
        <div className="brain-heading-stats"><span><strong>{graph.nodes.length.toLocaleString()}</strong> nodes</span><span><strong>{graph.edges.length.toLocaleString()}</strong> relations</span><span><strong>{nodeCounts.source || 0}</strong> documents</span></div>
      </header>

      <div className="graph-toolbar">
        <GraphSearchControl query={query} matchIds={model.matchIds} selectedId={selectedDisplay?.id || null} onChange={changeQuery} onNavigate={navigateMatch} />
        <div className="graph-detail" aria-label="Graph detail level">{(["overview", "focus", "all"] as GraphDetail[]).map((value) => <button key={value} type="button" className={detail === value ? "is-active" : ""} aria-pressed={detail === value} onClick={() => selectDetail(value)}>{value}</button>)}</div>
        <div className="graph-layout graph-layout--five" aria-label="Graph preset layout">
          {graphPresetDetails.map((preset) => <button key={preset.id} type="button" className={layout === preset.id ? "is-active" : ""} aria-pressed={layout === preset.id} onClick={() => selectLayout(preset.id)} title={`${preset.lineage}: ${preset.description}`}>{preset.label}</button>)}
        </div>
      </div>
      <div className="graph-filter-row">
        <div className="graph-filters" aria-label="Filter graph nodes">{["all", "project", "source", "memory", "decision", "entity"].map((item) => <button key={item} type="button" onClick={() => { setType(item); setSelectedId(null); }} className={type === item ? "is-active" : ""} aria-pressed={type === item}><span>{item === "source" ? "documents" : item}</span><small>{item === "all" ? filteredGraph.nodes.length : nodeCounts[item] || 0}</small></button>)}</div>
        <div className="graph-scope-filters">
          <label><span className="sr-only">Project scope</span><select value={projectId} onChange={(event) => { const value = event.target.value; setProjectId(value); setSelectedId(null); setFocusHistory([]); localStorage.setItem("brace.graph-project", value); }}><option value="all">All projects</option>{snapshot.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label><span className="sr-only">Time scope</span><select value={timeRange} onChange={(event) => { const value = event.target.value; setTimeRange(value); setSelectedId(null); setFocusHistory([]); localStorage.setItem("brace.graph-time", value); }}><option value="all">All time</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="year">Last year</option></select></label>
        </div>
        <div className="graph-density-status" role="status"><CircleDot className="h-3.5 w-3.5" /><span>Rendering <strong>{(model.nodes.length - (model.clusteredCount ? new Set(model.nodes.filter((node) => node.isCluster).map((node) => node.type)).size : 0)).toLocaleString()}</strong> of {model.totalEligible.toLocaleString()}</span>{model.hiddenCount > 0 && <em>{model.hiddenCount.toLocaleString()} grouped safely</em>}</div>
      </div>

      <div ref={stageRef} className={`graph-stage ${isFullscreen ? "is-fullscreen" : ""} ${inspectorOpen ? "has-inspector" : "is-canvas-only"}`} aria-label={isFullscreen ? "Brain focus mode" : "Brain graph"}>
        <div className="graph-fullscreen-tools">
          <GraphSearchControl query={query} matchIds={model.matchIds} selectedId={selectedDisplay?.id || null} onChange={changeQuery} onNavigate={navigateMatch} suffix="fullscreen" />
          <div className="graph-detail" aria-label="Fullscreen graph detail level">{(["overview", "focus", "all"] as GraphDetail[]).map((value) => <button key={value} type="button" className={detail === value ? "is-active" : ""} aria-pressed={detail === value} onClick={() => selectDetail(value)}>{value}</button>)}</div>
          <div className="graph-fullscreen-layout"><span>{graphPresetDetails.find((preset) => preset.id === layout)?.label}</span><select value={layout} onChange={(event) => selectLayout(event.target.value as GraphPreset)} aria-label="Fullscreen graph layout">{graphPresetDetails.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></div>
        </div>
        <div className="graph-canvas-wrap">
          <GraphCanvas nodes={model.nodes} edges={model.edges} query={query} zoom={zoom} pan={pan} layout={layout} selectedId={selectedDisplay?.id || null} onSelect={(id) => { selectNode(id); setInspectorOpen(true); setInspectorMode("dossier"); useBrace.setState({ graphFocusId: null }); }} onOpenCluster={unfoldCluster} onPanChange={setPan} onZoomChange={setZoom} />
          {query.trim() && model.matchIds.length === 0 && <div className="graph-empty-state" role="status"><FileSearch className="h-5 w-5" /><strong>No nodes match “{query.trim()}”</strong><p>{type === "all" ? "Try a broader name or clear the search to restore the whole brain." : `No ${graphTypePlural(type as GraphNode["type"])} match this search.`}</p><div><button type="button" className="brace-primary" onClick={() => changeQuery("")}>Clear search</button>{type !== "all" && <button type="button" className="brace-secondary" onClick={() => setType("all")}>Search all types</button>}</div></div>}
          <div className="graph-canvas-actions" aria-label="Brain canvas controls">
            <button type="button" onClick={() => setZoom((value) => Math.max(.45, value - .12))} aria-label="Zoom out"><Minus className="h-4 w-4" /></button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(2.4, value + .12))} aria-label="Zoom in"><Plus className="h-4 w-4" /></button><button type="button" onClick={focusSelected} aria-label="Center selected node" title="Center selected node"><CircleDot className="h-4 w-4" /></button><button type="button" onClick={resetViewport} aria-label="Fit graph to view" title="Fit graph to view (0)"><RotateCcw className="h-4 w-4" /></button><button type="button" onClick={() => setInspectorOpen((value) => !value)} aria-label={inspectorOpen ? "Hide node inspector" : "Show node inspector"}><PanelLeftClose className={`h-4 w-4 ${inspectorOpen ? "" : "rotate-180"}`} /></button><button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit Brain focus mode" : "Open Brain focus mode"} title="Focus mode (F)">{isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
          </div>
          <div className="graph-legend">{[["project", "Project"], ["source", "Document"], ["decision", "Decision"], ["memory", "Memory"], ["entity", "Idea"]].map(([nodeType, label]) => <span key={label}><i data-type={nodeType} />{label}</span>)}<small>Lines are stored provenance and explicit relations—not inferred semantics.</small></div>
          <div className="graph-hint"><CircleDot className="h-3.5 w-3.5" /> Drag to pan · wheel to zoom · arrows follow space · / finds · F focus mode</div>
        </div>
        {inspectorOpen && <aside className="graph-inspector" aria-live="polite">
          <button type="button" className="graph-inspector-close" onClick={() => setInspectorOpen(false)} aria-label="Close node inspector"><X className="h-4 w-4" /></button>
          <div className="graph-inspector-tabs" aria-label="Brain inspector view"><button type="button" className={inspectorMode === "dossier" ? "is-active" : ""} onClick={() => setInspectorMode("dossier")} aria-pressed={inspectorMode === "dossier"}>Node dossier</button><button type="button" className={inspectorMode === "index" ? "is-active" : ""} onClick={() => setInspectorMode("index")} aria-pressed={inspectorMode === "index"}>Node index <small>{model.nodes.filter((node) => !node.isCluster).length}</small></button></div>
          {inspectorMode === "index" ? <div className="graph-node-index" role="list" aria-label="Visible Brain nodes">
            <div className="graph-node-index-intro"><strong>Visible knowledge</strong><p>This keyboard-accessible index mirrors the current graph detail, filters, and search.</p></div>
            {model.nodes.map((node) => <button key={node.id} type="button" role="listitem" className={node.id === selectedDisplay?.id ? "is-active" : ""} onClick={() => { if (node.isCluster) unfoldCluster(node.id); else setSelectedId(node.id); setInspectorMode("dossier"); }}><i data-type={node.type} /><span><strong>{node.label}</strong><small>{node.isCluster ? "Grouped nodes" : node.type === "source" ? "Document" : node.type} · {node.degree.toLocaleString()} signals</small></span><ChevronRight className="ml-auto h-3.5 w-3.5" /></button>)}
          </div> : selected ? <>
            {focusHistory.length > 0 && <button type="button" className="graph-focus-back" onClick={goBackFocus}><ArrowLeft className="h-3.5 w-3.5" />Previous focus</button>}
            <div className="graph-inspector-type"><i data-type={selected.type} />{selectedDisplay?.isCluster ? "dense group" : selected.type === "source" ? "document" : selected.type}</div>
            <h2>{selected.label}</h2>
            <p>{selectedDisplay?.isCluster ? "This group keeps a dense brain fast and legible. Increase detail to unfold more individual nodes." : selected.type === "project" ? "A source-folder anchor. Files stay canonical while their searchable relationships live here." : selected.type === "source" ? "An indexed document with preserved file provenance. BRACE never edits the original." : selected.type === "decision" ? "An explicit choice preserved with its rationale and project context." : selected.type === "memory" ? "Durable context distilled for reliable recall across connected AI tools." : "A named idea extracted from your context so related work is easier to traverse."}</p>
            {provenance && <div className="graph-provenance"><FileText className="h-4 w-4" /><span><small>{selected.type === "project" ? "FOLDER" : "ORIGINAL SOURCE"}</small>{shortGraphPath(provenance)}</span></div>}
            <div className="graph-inspector-stats"><div><span>{selectedDisplay?.isCluster ? "Grouped nodes" : "Direct relations"}</span><strong>{selectedDisplay?.isCluster ? selectedDisplay.memberCount?.toLocaleString() : connectedEdges.length.toLocaleString()}</strong></div><div><span>{selected.type === "source" ? "Passages" : selected.type === "project" ? "Documents" : "Detail"}</span><strong>{selected.type === "source" ? selected.chunkCount?.toLocaleString() || "0" : selected.type === "project" ? selected.sourceCount?.toLocaleString() || "0" : selected.kind || selected.status || selected.entityType || selected.type}</strong></div><div><span>Last signal</span><strong>{formatShortDate(selected.timestamp)}</strong></div></div>
            <div className="graph-inspector-actions"><button type="button" className="brace-primary" onClick={openSelected}>{selectedDisplay?.isCluster ? detail === "all" ? `Isolate ${graphTypePlural(selected.type)}` : "Unfold group" : selected.type === "memory" ? "Open memory" : "Open in search"}<ArrowRight className="h-4 w-4" /></button><button type="button" className="brace-secondary" onClick={() => { setType("all"); setQuery(""); setDetail("focus"); resetViewport(); }}>Explore neighborhood</button></div>
            {!selectedDisplay?.isCluster && <div className="graph-inspector-links">
              <span>CONNECTED TO · {connectedNodes.length.toLocaleString()}</span>
              {connectedNodes.slice(0, 8).map((node) => <button key={node.id} type="button" onClick={() => { selectNode(node.id); useBrace.setState({ graphFocusId: null }); }}><i data-type={node.type} /><span>{node.label}<small>{node.type === "source" ? "document" : node.type}</small></span><ChevronRight className="ml-auto h-3.5 w-3.5" /></button>)}
              {!connectedNodes.length && <small>No direct relationships yet. Reindex the project after adding files.</small>}
            </div>}
          </> : <EmptyRows text="Import a project or capture memory to build your brain." />}
        </aside>}
      </div>
    </div>
  );
}

export function GraphCanvas({ nodes, edges, query, zoom, pan, layout, selectedId, onSelect, onOpenCluster, onPanChange, onZoomChange, compact = false }: { nodes: GraphDisplayNode[]; edges: GraphDisplayEdge[]; query: string; zoom: number; pan: { x: number; y: number }; layout: GraphPreset; selectedId: string | null; onSelect: (id: string) => void; onOpenCluster?: (id: string) => void; onPanChange: (pan: { x: number; y: number }) => void; onZoomChange: (zoom: number) => void; compact?: boolean }) {
  const positions = useMemo(() => graphPositions(layout, nodes, edges, selectedId), [layout, nodes, edges, selectedId]);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const color = (nodeType: string) => ({ project: "#1478d4", source: "#44a0ed", decision: "#7f62d9", memory: "#0b9b7a", entity: "#5d748d" }[nodeType] || "#fff");
  const selectedNeighborIds = useMemo(() => new Set(edges.filter((edge) => edge.from === selectedId || edge.to === selectedId).flatMap((edge) => [edge.from, edge.to])), [edges, selectedId]);
  const dense = nodes.length > 160;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hovered = nodes.find((node) => node.id === hoveredId) || null;
  const hoveredPoint = hovered ? positions.get(hovered.id) : null;
  const needle = query.trim().toLowerCase();
  const beginPan = (event: React.PointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest(".graph-node")) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: pan.x, originY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePan = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onPanChange({ x: drag.current.originX + (event.clientX - drag.current.startX) * (1000 / rect.width), y: drag.current.originY + (event.clientY - drag.current.startY) * (620 / rect.height) });
  };
  const endPan = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };
  return (
    <svg viewBox="0 0 1000 620" className={`graph-svg ${compact ? "is-compact" : ""}`} data-preset={layout} data-density={dense ? "dense" : "normal"} role="img" aria-label={`${nodes.length} visible knowledge nodes and ${edges.length} visible relationships in ${layout} layout`} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onWheel={(event) => { event.preventDefault(); onZoomChange(Math.max(.45, Math.min(2.4, zoom + (event.deltaY > 0 ? -.08 : .08)))); }}>
      <defs><radialGradient id="graph-vignette"><stop offset="0" stopColor="#dff0ff" stopOpacity=".92" /><stop offset=".55" stopColor="#eef7ff" stopOpacity=".42" /><stop offset="1" stopColor="#f8fbff" stopOpacity="0" /></radialGradient><pattern id="graph-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(9,102,199,.06)" strokeWidth="1" /></pattern></defs>
      <rect width="1000" height="620" fill="url(#graph-vignette)" /><rect width="1000" height="620" fill="url(#graph-grid)" />
      {layout === "rings" && <g className="graph-rings" aria-hidden="true"><circle cx="500" cy="310" r="102" /><circle cx="500" cy="310" r="178" /><circle cx="500" cy="310" r="244" /><circle cx="500" cy="310" r="286" /></g>}
      {layout === "neural" && <g className="graph-neural-field" aria-hidden="true"><path d="M488 116C422 55 285 62 190 151C95 240 99 393 197 486C278 562 416 555 488 499" /><path d="M512 116C578 55 715 62 810 151C905 240 901 393 803 486C722 562 584 555 512 499" /><path className="graph-neural-bridge" d="M488 135C512 181 486 224 512 266C486 307 512 351 488 397C512 438 498 474 512 497" /></g>}
      {layout === "chronicle" && <g className="graph-chronicle-lanes" aria-hidden="true">{[[90,"PROJECT"],[205,"DOCUMENT"],[315,"DECISION"],[425,"MEMORY"],[535,"IDEA"]].map(([y,label]) => <g key={label}><line x1="76" x2="936" y1={y} y2={y} /><text x="82" y={Number(y) - 10}>{label}</text></g>)}</g>}
      <g transform={`translate(${pan.x} ${pan.y}) translate(${500 - 500 * zoom} ${310 - 310 * zoom}) scale(${zoom})`} className="graph-world">
        {edges.map((edge, index) => { const from = positions.get(edge.from); const to = positions.get(edge.to); if (!from || !to) return null; const active = edge.from === selectedId || edge.to === selectedId; const straight = layout === "flow" || layout === "chronicle"; const curve = straight ? 0 : (index % 2 ? 1 : -1) * Math.min(38, Math.hypot(to.x - from.x, to.y - from.y) * .08); const midX = (from.x + to.x) / 2; const midY = (from.y + to.y) / 2; const dx = to.x - from.x; const dy = to.y - from.y; const length = Math.max(1, Math.hypot(dx, dy)); const controlX = midX - (dy / length) * curve; const controlY = midY + (dx / length) * curve; const path = `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`; return <g key={edge.id} className={active ? "graph-edge is-active" : "graph-edge"}><path d={path} style={{ "--edge-strength": Math.max(.12, edge.weight) } as React.CSSProperties} />{active && !compact && <text x={controlX} y={controlY - 8} textAnchor="middle">{edge.relation.replaceAll("_", " ")}{(edge.count || 1) > 1 ? ` ×${edge.count}` : ""}</text>}</g>; })}
        {nodes.map((node, index) => {
          const position = positions.get(node.id);
          if (!position) return null;
          const baseRadius = dense ? (node.type === "project" ? 9 : 5.5) : node.type === "project" ? 22 : node.type === "memory" || node.type === "decision" ? 16 : 13;
          const radius = node.isCluster ? Math.max(19, Math.min(34, 16 + Math.log2(node.memberCount || 2) * 2.4)) : baseRadius;
          const selected = node.id === selectedId;
          const related = selectedNeighborIds.has(node.id);
          const matching = Boolean(needle && node.label.toLowerCase().includes(needle));
          const showLabel = !compact && (node.showLabel || selected || related);
          const core = node.isCluster
            ? <circle className="graph-node-core graph-cluster-core" r={radius} />
            : node.type === "project"
              ? <rect className="graph-node-core" x={-radius} y={-radius} width={radius * 2} height={radius * 2} rx={dense ? 3 : 7} />
              : node.type === "decision"
                ? <path className="graph-node-core" d={`M 0 ${-radius} L ${radius} 0 L 0 ${radius} L ${-radius} 0 Z`} />
                : node.type === "memory"
                  ? <path className="graph-node-core" d={`M ${-radius * .86} ${-radius * .5} L 0 ${-radius} L ${radius * .86} ${-radius * .5} L ${radius * .86} ${radius * .5} L 0 ${radius} L ${-radius * .86} ${radius * .5} Z`} />
                  : <circle className={`graph-node-core ${node.type === "entity" ? "is-entity" : ""}`} r={radius} />;
          return (
            <g key={node.id} data-node-index={index} transform={`translate(${position.x} ${position.y})`} className={`graph-node ${layout === "living" && !dense ? "is-living" : ""} ${selected ? "is-selected" : ""} ${related ? "is-related" : ""} ${matching ? "is-match" : ""} ${node.isCluster ? "is-cluster" : ""}`} role="button" tabIndex={selected ? 0 : -1} aria-label={`${node.isCluster ? "group" : node.type}: ${node.label}`} onPointerEnter={() => setHoveredId(node.id)} onPointerLeave={() => setHoveredId((value) => value === node.id ? null : value)} onFocus={() => setHoveredId(node.id)} onBlur={() => setHoveredId((value) => value === node.id ? null : value)} onClick={(event) => { event.stopPropagation(); onSelect(node.id); }} onDoubleClick={(event) => { if (!node.isCluster || !onOpenCluster) return; event.stopPropagation(); onOpenCluster(node.id); }} onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (node.isCluster && onOpenCluster) onOpenCluster(node.id); else onSelect(node.id); }
              if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
                event.preventDefault();
                const nextId = graphNeighborInDirection(nodes, positions, node.id, event.key as "ArrowRight" | "ArrowDown" | "ArrowLeft" | "ArrowUp");
                if (!nextId) return;
                const next = nodes.findIndex((candidate) => candidate.id === nextId);
                onSelect(nextId);
                requestAnimationFrame(() => document.querySelector<SVGGElement>(`[data-node-index="${next}"]`)?.focus());
              }
            }} style={{ "--node-color": color(node.type), "--node-delay": `${Math.min(index, 24) * 18}ms`, "--living-delay": `${-(index % 7) * .72}s` } as React.CSSProperties}>
              <circle className="graph-node-wave" r={radius + 18} /><circle className="graph-node-halo" r={radius + (dense ? 4 : 10)} />{core}<circle className="graph-node-dot" r={dense && !node.isCluster ? 2 : node.type === "project" ? 5 : 3.5} />
              {node.isCluster && <text className="graph-cluster-count" y="4" textAnchor="middle">{node.memberCount}</text>}
              {showLabel && <><text className="graph-node-label" y={radius + 21} textAnchor="middle">{node.label.length > 30 ? `${node.label.slice(0, 29)}…` : node.label}</text>{!dense && <text className="graph-node-type" y={radius + 34} textAnchor="middle">{node.type === "source" ? "document" : node.type}</text>}</>}
            </g>
          );
        })}
        {hovered && hoveredPoint && !compact && hovered.id !== selectedId && <g className="graph-node-tooltip" transform={`translate(${hoveredPoint.x} ${hoveredPoint.y - 34})`} pointerEvents="none"><rect x={-110} y={-34} width="220" height="42" rx="10" /><text className="graph-node-tooltip-type" y={-18} textAnchor="middle">{hovered.type === "source" ? "DOCUMENT" : hovered.type.toUpperCase()}</text><text className="graph-node-tooltip-label" y={-3} textAnchor="middle">{hovered.label.length > 34 ? `${hovered.label.slice(0, 33)}…` : hovered.label}</text></g>}
      </g>
    </svg>
  );
}
