"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  Box,
  Brain,
  Check,
  Copy,
  ChevronRight,
  CircleDot,
  Clock3,
  CalendarClock,
  CloudOff,
  Code2,
  Command,
  CornerDownLeft,
  Database,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  FolderInput,
  FolderSync,
  GitBranch,
  HardDrive,
  Info,
  Inbox,
  KeyRound,
  Keyboard,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  MessageSquareText,
  Pause,
  Pin,
  PinOff,
  Play,
  Maximize2,
  Minus,
  Network,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Tags,
  Trash2,
  X,
  Zap,
  Workflow,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useBrace, type BraceView } from "@/lib/brace/store";
import type {
  BraceConnector,
  BraceAutomation,
  BraceAutomationAction,
  BraceAutomationCondition,
  BraceAutomationRun,
  BraceAutomationTemplate,
  BraceMemory,
  BraceProject,
  BraceSkill,
  GraphEdge,
  GraphNode,
  TimelineEvent,
} from "@/lib/brace/types";
import {
  graphPositions,
  graphPresetDetails,
  type GraphPreset,
} from "@/lib/brace/graph-layouts";

const nav: Array<{ view: BraceView; label: string; icon: LucideIcon }> = [
  { view: "home", label: "Command center", icon: LayoutDashboard },
  { view: "graph", label: "Knowledge map", icon: Network },
  { view: "inbox", label: "Inbox", icon: Inbox },
  { view: "assistant", label: "AI Workspace", icon: MessageSquareText },
  { view: "search", label: "Recall", icon: Search },
  { view: "memories", label: "Memory", icon: Brain },
  { view: "timeline", label: "Timeline", icon: Clock3 },
  { view: "projects", label: "Projects", icon: FolderInput },
  { view: "skills", label: "Skills", icon: Zap },
  { view: "automations", label: "Automations", icon: Workflow },
  { view: "connections", label: "Connections", icon: GitBranch },
  { view: "settings", label: "Settings", icon: Settings },
];

const kindTone: Record<string, string> = {
  project: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  decision: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  lesson: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  preference: "border-pink-400/20 bg-pink-400/10 text-pink-200",
  summary: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
  hypothesis: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200",
  fact: "border-slate-400/20 bg-slate-400/10 text-slate-200",
  procedure: "border-indigo-400/20 bg-indigo-400/10 text-indigo-200",
};

function formatDate(value?: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function shortUri(value: string | null) {
  if (!value) return "Unsourced memory";
  try {
    return decodeURIComponent(value.replace(/^brace-project:\/\/[^/]+\//, ""));
  } catch {
    return value;
  }
}

function applyUiPreference(key: "density" | "motion" | "contrast", value: string) {
  document.documentElement.dataset[key] = value;
}

export function BraceApp() {
  const {
    view,
    snapshot,
    selectedMemory,
    loading,
    operation,
    error,
    notice,
    bootstrap,
    setView,
    setSelectedMemory,
    clearMessage,
  } = useBrace();
  const [collapsed, setCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("brace.ui") || "{}");
      if (saved.density) document.documentElement.dataset.density = saved.density;
      if (saved.motion) document.documentElement.dataset.motion = saved.motion;
      if (saved.contrast) document.documentElement.dataset.contrast = saved.contrast;
    } catch {
      localStorage.removeItem("brace.ui");
    }
  }, []);

  useEffect(() => {
    if (!notice || error) return;
    const timer = window.setTimeout(clearMessage, 6_000);
    return () => window.clearTimeout(timer);
  }, [notice, error, clearMessage]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.matches("input, textarea, select, [contenteditable='true']");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setQuickCaptureOpen(true);
        return;
      }
      if (!editing && event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (!editing && event.key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("#brace-global-search")?.focus();
        return;
      }
      if (!editing && event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        useBrace.getState().navigateHistory(-1);
        return;
      }
      if (!editing && event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        useBrace.getState().navigateHistory(1);
        return;
      }
      if (!editing && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const destination = nav[Number(event.key) - 1];
        if (destination) setView(destination.view);
        return;
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setQuickCaptureOpen(false);
        setShortcutsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setView]);

  if (loading) return <LoadingScreen />;
  if (!snapshot) {
    return <StartupFailure error={error} onRetry={() => void bootstrap()} />;
  }

  const isEmpty = snapshot.environment === "desktop" &&
    snapshot.stats.projects === 0 && snapshot.stats.memories === 0;
  if (isEmpty) return <Onboarding />;

  return (
    <div data-brace-state="ready" className="brace-app flex h-[100dvh] overflow-hidden text-[#f4f1eb]">
      <RainGlass />
      <div className="brace-ambient" aria-hidden="true"><i /><i /><i /></div>
      <aside
        className={`brace-sidebar relative z-20 flex shrink-0 flex-col transition-[width] duration-300 ${collapsed ? "w-[76px]" : "w-[238px]"}`}
      >
        <div className="flex h-[76px] items-center px-5">
          <button
            type="button"
            onClick={() => setView("home")}
            className={`flex min-w-0 items-center ${collapsed ? "mx-auto" : "gap-3"}`}
            aria-label="Open BRACE overview"
          >
            <BraceMark />
            {!collapsed && (
              <span className="min-w-0 text-left">
                <span className="block text-[15px] font-semibold tracking-[0.22em]">BRACE</span>
                <span className="mt-0.5 block text-[9px] uppercase tracking-[0.18em] text-white/35">One memory. Every AI.</span>
              </span>
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="BRACE navigation">
          {nav.map((item) => {
            const active = view === item.view || (item.view === "memories" && view === "review");
            const Icon = item.icon;
            const badge = item.view === "memories"
              ? snapshot.memoryQuality.pendingReview
              : item.view === "automations"
                ? snapshot.automations?.runs.filter((run) => run.status === "failed").length || 0
                : 0;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => setView(item.view)}
                className={`brace-nav-item group relative flex h-11 w-full items-center rounded-xl text-[13px] font-medium ${
                  collapsed ? "justify-center" : "gap-3 px-3"
                } ${active ? "is-active text-white" : "text-white/45 hover:text-white/80"}`}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
              >
                {active && <span className="brace-nav-signal" />}
                <Icon className={`h-[17px] w-[17px] shrink-0 ${active ? "text-[#9bdcff]" : "text-white/34 group-hover:text-white/65"}`} strokeWidth={1.8} />
                {!collapsed && <span>{item.label}</span>}
                {badge > 0 && <span className="brace-nav-badge" aria-label={`${badge} items need attention`}>{badge > 99 ? "99+" : badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3">
          {!collapsed && (
            <div className="brace-local-status mb-2 rounded-xl px-3 py-3">
              <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-200/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Local database active
              </div>
              <p className="mt-1 text-[10px] text-white/32">No telemetry · no account</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={`flex h-9 w-full items-center rounded-lg text-white/35 hover:bg-white/[0.04] hover:text-white/70 ${collapsed ? "justify-center" : "gap-3 px-3"}`}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Header onCommand={() => setCommandOpen(true)} onQuickCapture={() => setQuickCaptureOpen(true)} />
        {snapshot.environment === "browser-preview" && (
          <div className="flex items-center gap-2 border-b border-sky-300/10 bg-sky-300/[0.05] px-5 py-2 text-[11px] text-sky-100/70">
            <Info className="h-3.5 w-3.5" />
            Synthetic browser preview — desktop actions and persistent SQLite storage are disabled here.
          </div>
        )}
        {(error || notice) && (
          <div className={`flex items-center gap-3 border-b px-5 py-2.5 text-xs ${error ? "border-rose-400/15 bg-rose-400/[0.07] text-rose-100" : "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-100"}`} role={error ? "alert" : "status"}>
            {error ? <Info className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
            <span className="flex-1">{error || notice}</span>
            <button type="button" onClick={clearMessage} className="rounded p-1 hover:bg-white/5" aria-label="Dismiss message"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <main key={view} className="brace-main min-h-0 flex-1 overflow-y-auto">
          {view === "home" && <Overview />}
          {view === "inbox" && <InboxView />}
          {view === "assistant" && <AiWorkspaceView />}
          {view === "search" && <SearchView />}
          {view === "memories" && <MemoriesView />}
          {view === "review" && <MemoryReviewView />}
          {view === "timeline" && <TimelineView />}
          {view === "graph" && <GraphView />}
          {view === "projects" && <ProjectsView />}
          {view === "skills" && <SkillsView />}
          {view === "automations" && <AutomationsView />}
          {view === "connections" && <ConnectionsView />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>

      {selectedMemory && <MemoryDetail memory={selectedMemory} onClose={() => setSelectedMemory(null)} />}
      {commandOpen && <CommandPalette onClose={() => setCommandOpen(false)} onQuickCapture={() => { setCommandOpen(false); setQuickCaptureOpen(true); }} onShortcuts={() => { setCommandOpen(false); setShortcutsOpen(true); }} />}
      {quickCaptureOpen && <QuickCapture onClose={() => setQuickCaptureOpen(false)} />}
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
      {operation && (
        <div className="fixed bottom-5 right-5 z-[80] flex items-center gap-3 rounded-xl border border-white/10 bg-[#171b20]/95 px-4 py-3 text-xs text-white/75 shadow-2xl backdrop-blur" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin text-[#7dd3fc]" />
          {operation}
        </div>
      )}
    </div>
  );
}

function RainGlass() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let pointerX = -1_000;
    let pointerY = -1_000;
    let seed = 173;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const drops = Array.from({ length: window.innerWidth < 820 ? 28 : 54 }, () => ({
      x: random(),
      y: random(),
      radius: 1.5 + random() * 5,
      speed: .000025 + random() * .000055,
      drift: (random() - .5) * .00002,
      tail: 10 + random() * 42,
    }));
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.4);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const point = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
    };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const drop of drops) {
        if (!reduced) {
          drop.y += drop.speed * 16;
          drop.x += drop.drift * 16;
          if (drop.y > 1.08) drop.y = -.08;
          if (drop.x < -.05) drop.x = 1.05;
          if (drop.x > 1.05) drop.x = -.05;
        }
        const x = drop.x * width;
        const y = drop.y * height;
        const proximity = Math.max(0, 1 - Math.hypot(x - pointerX, y - pointerY) / 220);
        const radius = drop.radius * (1 + proximity * .7);
        const lens = context.createRadialGradient(x - radius * .35, y - radius * .45, .2, x, y, radius * 2.2);
        lens.addColorStop(0, `rgba(255,255,255,${.34 + proximity * .2})`);
        lens.addColorStop(.28, "rgba(255,255,255,.13)");
        lens.addColorStop(.72, "rgba(210,210,210,.04)");
        lens.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = lens;
        context.beginPath();
        context.ellipse(x, y, radius * .82, radius * 1.35, .08, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = `rgba(255,255,255,${.09 + proximity * .12})`;
        context.lineWidth = .7;
        context.stroke();
        if (drop.radius < 3.3) {
          context.beginPath();
          context.moveTo(x, y - radius);
          context.lineTo(x - .5, y - drop.tail);
          context.strokeStyle = "rgba(255,255,255,.04)";
          context.stroke();
        }
      }
      if (!reduced && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const handleVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) draw();
    };
    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", point, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", point);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
  return <canvas ref={canvasRef} className="brace-rain" aria-hidden="true" />;
}

function BraceMark() {
  return (
    <span className="brace-mark relative flex h-10 w-10 shrink-0 items-center justify-center">
      <img src="/logo.svg" alt="" width="40" height="40" draggable={false} />
    </span>
  );
}

function LoadingScreen() {
  return (
    <div data-brace-state="loading" className="brace-opening" role="status" aria-live="polite">
      <div className="brace-opening-orbits" aria-hidden="true"><i /><i /><i /></div>
      <div className="brace-opening-copy">
        <div className="mx-auto mb-6"><BraceMark /></div>
        <span>LOCAL MEMORY STARTUP</span>
        <h1>Bringing your context<br />into focus.</h1>
        <div className="brace-opening-track" aria-hidden="true"><i /></div>
        <p>Opening the encrypted local index. No network request is required.</p>
      </div>
      <div className="brace-opening-steps" aria-hidden="true"><span><i />App shell</span><span><i />Local database</span><span><i />Memory graph</span></div>
    </div>
  );
}

function StartupFailure({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-brace-state="error" className="brace-opening" role="alert">
      <div className="brace-opening-orbits" aria-hidden="true"><i /><i /><i /></div>
      <div className="brace-opening-copy">
        <div className="mx-auto mb-6"><BraceMark /></div>
        <span>LOCAL MEMORY NEEDS ATTENTION</span>
        <h1>BRACE could not open<br />your local index.</h1>
        <p>{error || "The desktop runtime did not return a valid memory snapshot."}</p>
        <button type="button" onClick={onRetry} className="brace-primary mx-auto mt-7 h-11 px-5">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
        <p className="mt-4 text-[11px] text-white/35">Your source files were not changed.</p>
      </div>
    </div>
  );
}

function Onboarding() {
  const { initializeDemo, addProject, operation, error, clearMessage } = useBrace();
  return (
    <div data-brace-state="ready" className="brace-onboarding relative flex min-h-[100dvh] overflow-hidden text-[#eef7ff]">
      <div className="brace-onboarding-light pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-7 py-8 lg:px-12">
        <header className="flex items-center gap-3">
          <BraceMark />
          <div>
            <div className="text-sm font-semibold tracking-[0.22em]">BRACE</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-white/35">One memory. Every AI.</div>
          </div>
        </header>
        <div className="grid flex-1 items-center gap-14 py-14 lg:grid-cols-[1.08fr_.92fr]">
          <section>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-[11px] font-medium text-emerald-100/75">
              <ShieldCheck className="h-3.5 w-3.5" /> Local-first by default
            </div>
            <h1 className="max-w-2xl text-balance text-5xl font-medium leading-[1.02] tracking-[-0.055em] sm:text-6xl">
              Stop re-explaining your work to every AI.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/52">
              BRACE turns project files, decisions, and durable context into one private memory layer your AI tools can share.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button type="button" onClick={() => void addProject()} className="brace-primary h-11 px-5">
                <FolderInput className="h-4 w-4" /> Import a project
              </button>
              <button type="button" onClick={() => void initializeDemo()} className="brace-secondary h-11 px-5">
                <Sparkles className="h-4 w-4 text-[#9bdcff]" /> Explore synthetic demo
              </button>
            </div>
            {error && (
              <div className="mt-5 flex max-w-xl items-start gap-3 rounded-xl border border-rose-400/15 bg-rose-400/[0.06] p-4 text-sm text-rose-100" role="alert">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <button type="button" onClick={clearMessage} aria-label="Dismiss error"><X className="h-4 w-4" /></button>
              </div>
            )}
            <p className="mt-6 flex items-center gap-2 text-[11px] text-white/32">
              <CloudOff className="h-3.5 w-3.5" /> No account, telemetry, or automatic cloud upload.
            </p>
          </section>
          <section className="relative">
            <div className="absolute -inset-8 rounded-full bg-sky-300/5 blur-3xl" />
            <div className="brace-onboarding-window relative overflow-hidden rounded-3xl p-3">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 pb-3 pt-1 text-[10px] text-white/30"><span className="h-2 w-2 rounded-full bg-sky-300" /><span className="h-2 w-2 rounded-full bg-violet-300" /><span className="h-2 w-2 rounded-full bg-emerald-300" /><span className="ml-2">How BRACE works</span></div>
              <div className="space-y-2 p-3">
                <OnboardingStep number="01" icon={FolderInput} title="Connect work" text="Choose a specific project folder. Originals stay where they are." />
                <OnboardingStep number="02" icon={Database} title="Build local memory" text="BRACE indexes sources, decisions, evidence, and relationships into SQLite." />
                <OnboardingStep number="03" icon={GitBranch} title="Connect every AI" text="MCP clients retrieve the same provenance-backed context." />
              </div>
            </div>
          </section>
        </div>
      </div>
      {operation && <div className="fixed bottom-5 right-5 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0d1828] px-4 py-3 text-xs text-white/70"><LoaderCircle className="h-4 w-4 animate-spin text-[#7dd3fc]" />{operation}</div>}
    </div>
  );
}

function OnboardingStep({ number, icon: Icon, title, text }: { number: string; icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="grid grid-cols-[42px_42px_1fr] items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <span className="font-mono text-[10px] text-white/25">{number}</span>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-[#9bdcff]"><Icon className="h-[18px] w-[18px]" /></span>
      <div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-white/40">{text}</p></div>
    </div>
  );
}

function Header({ onCommand, onQuickCapture }: { onCommand: () => void; onQuickCapture: () => void }) {
  const { view, viewHistory, viewHistoryIndex, navigateHistory, setView, setSearchQuery, search, searchQuery, snapshot } = useBrace();
  const currentLabel = nav.find((item) => item.view === view)?.label || (view === "review" ? "Review queue" : "BRACE");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void search();
  };
  return (
    <header className="brace-header flex h-[76px] shrink-0 items-center gap-4 px-5" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
      <div className="brace-history-controls" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button type="button" onClick={() => navigateHistory(-1)} disabled={viewHistoryIndex === 0} aria-label="Go to previous workspace" title="Back · Alt + Left"><ArrowLeft className="h-4 w-4" /></button>
        <button type="button" onClick={() => navigateHistory(1)} disabled={viewHistoryIndex >= viewHistory.length - 1} aria-label="Go to next workspace" title="Forward · Alt + Right"><ArrowRight className="h-4 w-4" /></button>
      </div>
      <form onSubmit={submit} className="relative w-full max-w-xl" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          id="brace-global-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onFocus={() => setView("search")}
          placeholder="Recall a decision, source, or lesson…"
          className="brace-command h-11 w-full rounded-xl pl-10 pr-16 text-sm text-white outline-none placeholder:text-white/25"
        />
        <button type="button" onClick={onCommand} className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[9px] text-white/35 hover:text-white/70" aria-label="Open command palette"><Command className="h-3 w-3" />Ctrl K</button>
      </form>
      <div className="ml-auto flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button type="button" onClick={onQuickCapture} className="brace-secondary brace-header-capture h-10 px-3.5" aria-label="Quick capture" aria-keyshortcuts="Control+N Meta+N"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Quick capture</span></button>
        <div className="brace-workspace-context hidden items-center gap-2 rounded-lg px-2.5 py-2 lg:flex">
          <span>{currentLabel}</span><i />
          <strong>{snapshot?.stats.memories ?? 0}</strong><small>memories</small>
        </div>
      </div>
    </header>
  );
}

function CommandPalette({ onClose, onQuickCapture, onShortcuts }: { onClose: () => void; onQuickCapture: () => void; onShortcuts: () => void }) {
  const { setView } = useBrace();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("brace.recent-commands") || "[]"); } catch { return []; }
  });
  const commands = useMemo(() => [
    ...nav.map((item, index) => ({
      id: item.view,
      label: item.label,
      detail: `Open ${item.label.toLowerCase()}`,
      category: "Workspace",
      icon: item.icon,
      key: String(index + 1),
      run: () => { setView(item.view); onClose(); },
    })),
    { id: "capture", label: "Capture a memory", detail: "Save durable context from anywhere", category: "Action", icon: Plus, key: "Ctrl N", run: onQuickCapture },
    { id: "shortcuts", label: "Keyboard map", detail: "See every shortcut", category: "Help", icon: Keyboard, key: "?", run: onShortcuts },
  ], [onClose, onQuickCapture, onShortcuts, setView]);
  const filtered = useMemo(() => {
    const needles = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = needles.length
      ? commands.filter((item) => needles.every((needle) => `${item.label} ${item.detail} ${item.category}`.toLowerCase().includes(needle)))
      : commands;
    return [...matches].sort((left, right) => {
      const leftIndex = recent.indexOf(left.id);
      const rightIndex = recent.indexOf(right.id);
      if (leftIndex === -1 && rightIndex === -1) return 0;
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
  }, [commands, query, recent]);
  const execute = (item: (typeof commands)[number]) => {
    const next = [item.id, ...recent.filter((id) => id !== item.id)].slice(0, 5);
    setRecent(next);
    localStorage.setItem("brace.recent-commands", JSON.stringify(next));
    item.run();
  };

  useEffect(() => setActive(0), [query]);

  return (
    <div className="brace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="brace-command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="command-palette-search">
          <Command className="h-4 w-4" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(filtered.length - 1, value + 1)); }
              if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
              if (event.key === "Enter" && filtered[active]) { event.preventDefault(); execute(filtered[active]); }
            }}
            placeholder="Go somewhere or start an action…"
            aria-label="Search commands"
          />
          <kbd>ESC</kbd>
        </div>
        <div className="command-palette-context"><span>{query ? `${filtered.length} matching commands` : recent.length ? "Recent commands first" : "Every workspace and action"}</span><small>Type multiple words to narrow</small></div>
        <div className="command-palette-list" role="listbox" aria-label="Available commands">
          {filtered.map((item, index) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" role="option" aria-selected={index === active} className={index === active ? "is-active" : ""} onMouseEnter={() => setActive(index)} onClick={() => execute(item)}><span><Icon className="h-4 w-4" /></span><span><strong>{item.label}</strong><small>{item.category} · {item.detail}</small></span><kbd>{item.key}</kbd></button>;
          })}
          {!filtered.length && <div className="command-empty">No matching command. Try “graph” or “capture”.</div>}
        </div>
        <footer><span><CornerDownLeft className="h-3 w-3" /> run</span><span>↑↓ move</span><span>Everything stays local</span></footer>
      </section>
    </div>
  );
}

function QuickCapture({ onClose }: { onClose: () => void }) {
  const { createMemory, snapshot } = useBrace();
  const draft = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("brace.capture-draft") || "{}"); } catch { return {}; }
  }, []);
  const [title, setTitle] = useState(String(draft.title || ""));
  const [content, setContent] = useState(String(draft.content || ""));
  const [kind, setKind] = useState(String(draft.kind || localStorage.getItem("brace.last-memory-kind") || "fact"));
  const [scope, setScope] = useState(String(draft.scope || "global"));
  const [tags, setTags] = useState(String(draft.tags || ""));
  const hasDraft = Boolean(draft.title || draft.content);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!title && !content && !tags) sessionStorage.removeItem("brace.capture-draft");
      else sessionStorage.setItem("brace.capture-draft", JSON.stringify({ title, content, kind, scope, tags }));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [title, content, kind, scope, tags]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createMemory({ title, content, summary: content.slice(0, 400), kind, scope, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), confidence: 0.75, importance: 0.6 });
    if (!useBrace.getState().error) {
      sessionStorage.removeItem("brace.capture-draft");
      localStorage.setItem("brace.last-memory-kind", kind);
      onClose();
    }
  };
  return (
    <div className="brace-dialog-backdrop brace-dialog-backdrop--side" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="quick-capture-sheet" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="quick-capture-title">
        <header><div><span>LOCAL QUICK CAPTURE</span><h1 id="quick-capture-title">Keep the part that matters.</h1></div><button type="button" onClick={onClose} aria-label="Close quick capture"><X className="h-4 w-4" /></button></header>
        <p>Save one durable claim. BRACE keeps it separate from source evidence and available to connected AI clients.{hasDraft && <span className="capture-restored"><RefreshCw className="h-3 w-3" /> Session draft restored</span>}</p>
        <div className="quick-capture-fields">
          <div className="capture-label"><label htmlFor="quick-title">Memory title</label><span>{title.length}/240</span></div>
          <input id="quick-title" autoFocus required maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A specific point future-you can recognize" />
          <div className="capture-label"><label htmlFor="quick-content">What should BRACE remember?</label><span>{content.length.toLocaleString()} characters</span></div>
          <textarea id="quick-content" required maxLength={100_000} value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") event.currentTarget.form?.requestSubmit(); }} placeholder="Keep it concise. Do not store credentials or raw private transcripts." />
          <div className="capture-kind-chips" role="group" aria-label="Common memory types">{[["fact", "Fact"], ["decision", "Decision"], ["lesson", "Lesson"], ["warning", "Warning"], ["procedure", "Procedure"]].map(([value, label]) => <button key={value} type="button" className={kind === value ? "is-active" : ""} aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</button>)}</div>
          <div className="quick-capture-meta">
            <label>Type<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="fact">Fact</option><option value="project">Project context</option><option value="decision">Decision</option><option value="lesson">Lesson</option><option value="warning">Warning</option><option value="preference">Preference</option><option value="procedure">Procedure</option></select></label>
            <label>Scope<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="global">Global</option>{snapshot?.projects.map((project) => <option key={project.id} value={`project:${project.id}`}>{project.name}</option>)}</select></label>
          </div>
          <label htmlFor="quick-tags">Tags <span className="normal-case tracking-normal text-white/20">comma separated</span></label>
          <input id="quick-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="architecture, follow-up" />
        </div>
        <footer><span><ShieldCheck className="h-4 w-4" /> Session draft · ⌘↵ saves</span><div><button type="button" onClick={onClose} className="brace-secondary">Close</button><button type="submit" className="brace-primary">Save memory <CornerDownLeft className="h-3.5 w-3.5" /></button></div></footer>
      </form>
    </div>
  );
}

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    ["Ctrl / ⌘ K", "Open command palette"],
    ["Ctrl / ⌘ N", "Quick capture"],
    ["/", "Focus global recall"],
    ["Alt + ← / →", "Move through workspace history"],
    ["Ctrl / ⌘ ↵", "Save from quick capture"],
    ["1 — 9", "Open a workspace view"],
    ["↑ ↓", "Move through commands or graph nodes"],
    ["Enter", "Open the selected command or node"],
    ["Esc", "Close the active layer"],
    ["?", "Show this keyboard map"],
  ];
  return (
    <div className="brace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="shortcuts-sheet" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
        <header><div><span>KEYBOARD MAP</span><h1 id="shortcuts-title">Move at the speed of recall.</h1></div><button type="button" onClick={onClose} aria-label="Close keyboard map"><X className="h-4 w-4" /></button></header>
        <div>{shortcuts.map(([keys, action]) => <p key={keys}><kbd>{keys}</kbd><span>{action}</span></p>)}</div>
      </section>
    </div>
  );
}

function Page({ eyebrow, title, description, actions, children }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="brace-page mx-auto w-full max-w-[1500px] px-5 py-7 lg:px-9 lg:py-10">
      <div className="brace-page-heading mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          {eyebrow && <div className="brace-eyebrow mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8edcff]"><span />{eyebrow}</div>}
          <h1 className="text-[clamp(2rem,3vw,3.2rem)] font-medium leading-[1.02] tracking-[-0.055em] text-[#faf7f1]">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/42">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

function Overview() {
  const { snapshot, setView, setSelectedMemory } = useBrace();
  if (!snapshot) return null;
  const stats = [
    ["memories", snapshot.stats.memories, Brain],
    ["sources", snapshot.stats.sources, FileText],
    ["decisions", snapshot.stats.decisions, GitBranch],
    ["relations", snapshot.stats.relations, Network],
  ] as const;
  const featured = snapshot.memories.find((memory) => memory.pinned) || snapshot.memories[0];
  return (
    <Page eyebrow="Local working set" title="Continue from what mattered." description="A compact field record of decisions, evidence, and unfinished context—kept on this machine and ready for the next tool.">
      <section className="brace-hero-grid">
        <button type="button" onClick={() => featured && setSelectedMemory(featured)} className="brace-memory-signal group text-left" disabled={!featured}>
          <div className="memory-signal-orbit" aria-hidden="true"><span /><span /><span /></div>
          <div className="relative z-10 max-w-xl">
            <span className="signal-status"><i /> {featured?.pinned ? "PINNED / WORKING SET" : "LOCAL RECORD / READY"}</span>
            <h2>{featured?.title || "Your first durable memory will surface here."}</h2>
            <p>{featured?.summary || "Import a project or remember something important to begin."}</p>
            <span className="signal-source"><FileText className="h-3.5 w-3.5" />{featured ? shortUri(featured.sourceUri) : "Waiting for local context"}</span>
          </div>
          {featured && <span className="signal-open">Inspect memory <ArrowRight className="h-4 w-4" /></span>}
        </button>

        <div className="brace-vitals" aria-label="Memory health">
          <div className="vitals-heading"><span>LOCAL INDEX</span><strong>{snapshot.memoryQuality.pendingReview ? "Review ready" : "Healthy"} <i /></strong></div>
          {stats.map(([label, value, Icon], index) => (
            <button key={label} type="button" onClick={() => setView(index === 0 ? "memories" : index === 2 ? "timeline" : index === 3 ? "graph" : "projects")} className="vital-row">
              <span><Icon className="h-4 w-4" />{label}</span><strong>{value.toLocaleString()}</strong><i style={{ "--vital": `${Math.min(100, 28 + value * 12)}%` } as React.CSSProperties} />
            </button>
          ))}
          <button type="button" onClick={() => setView("review")} className="vital-row">
            <span><Archive className="h-4 w-4" />review queue</span>
            <strong>{snapshot.memoryQuality.pendingReview.toLocaleString()}</strong>
            <i style={{ "--vital": `${snapshot.memoryQuality.pendingReview ? 72 : 100}%` } as React.CSSProperties} />
          </button>
          <button type="button" onClick={() => setView("search")} className="vitals-recall"><Search className="h-4 w-4" /> Ask your memory <ArrowRight className="ml-auto h-4 w-4" /></button>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.22fr_.78fr]">
        <section className="brace-card brace-card--lift overflow-hidden">
          <SectionHeading title={snapshot.stats.pinnedMemories ? "Pinned working context" : "High-signal memory"} action="Open memory" onAction={() => setView("memories")} />
          <div className="divide-y divide-white/[0.055]">
            {snapshot.memories.slice(0, 4).map((memory) => <MemoryRow key={memory.id} memory={memory} onClick={() => setSelectedMemory(memory)} />)}
            {snapshot.memories.length === 0 && <EmptyRows text="No durable memories yet." />}
          </div>
        </section>
        <section className="brace-card brace-card--lift overflow-hidden">
          <SectionHeading title="Memory pulse" action="Full timeline" onAction={() => setView("timeline")} />
          <div className="brace-timeline-flow px-5 pb-5">
            {snapshot.timeline.slice(0, 5).map((event, index) => <TimelineMini key={event.id} event={event} last={index === Math.min(4, snapshot.timeline.length - 1)} />)}
            {snapshot.timeline.length === 0 && <EmptyRows text="New memories and decisions will appear here." />}
          </div>
        </section>
      </div>

      <div className="brace-action-ribbon mt-5">
        <button type="button" onClick={() => setView("connections")}><Code2 className="h-5 w-5" /><span><strong>Connect your AI</strong><small>Read-only MCP by default</small></span><ArrowRight className="ml-auto h-4 w-4" /></button>
        <span className="ribbon-divider" />
        <div><ShieldCheck className="h-5 w-5" /><span><strong>Private by architecture</strong><small>Local SQLite · no account · no telemetry</small></span></div>
      </div>
    </Page>
  );
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.055] px-5 py-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action && <button type="button" onClick={onAction} className="text-[11px] font-medium text-[#8edcff] hover:text-[#d7f3ff]">{action} <span aria-hidden>→</span></button>}
    </div>
  );
}

function EmptyRows({ text }: { text: string }) {
  return <div className="px-5 py-10 text-center text-xs text-white/30">{text}</div>;
}

function MemoryRow({ memory, onClick }: { memory: BraceMemory; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-white/[0.025]">
      <span className={`mt-0.5 rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${kindTone[memory.kind]}`}>{memory.kind}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-white/88">{memory.title}</span>
        <span className="mt-1 block line-clamp-1 text-xs text-white/35">{memory.summary}</span>
        <span className="mt-2 flex items-center gap-1.5 text-[10px] text-white/25"><FileText className="h-3 w-3" />{shortUri(memory.sourceUri)}</span>
      </span>
      {memory.pinned ? <Pin className="mt-3 h-3.5 w-3.5 rotate-45 text-[#b7f36b]" aria-label="Pinned memory" /> : <ChevronRight className="mt-3 h-4 w-4 text-white/12 group-hover:text-white/40" />}
    </button>
  );
}

function TimelineMini({ event, last }: { event: TimelineEvent; last: boolean }) {
  return (
    <div className="relative flex gap-3 pt-4">
      <div className="relative flex w-4 shrink-0 justify-center">
        {!last && <span className="absolute bottom-[-16px] top-2 w-px bg-white/[0.07]" />}
        <span className={`relative mt-1 h-2 w-2 rounded-full ${event.eventType.startsWith("decision") ? "bg-violet-300" : "bg-[#7dd3fc]"}`} />
      </div>
      <div className="min-w-0 pb-1"><div className="truncate text-xs font-medium text-white/74">{event.title}</div><div className="mt-1 text-[10px] text-white/28">{formatDate(event.occurredAt)}</div></div>
    </div>
  );
}

function InboxView() {
  const { snapshot, createMemory, createDecision, setView } = useBrace();
  const [mode, setMode] = useState<"capture" | "decision">("capture");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scope, setScope] = useState("global");
  const [rationale, setRationale] = useState("");
  if (!snapshot) return null;
  const recentCaptures = snapshot.memories
    .filter((memory) => memory.tags.includes("inbox"))
    .slice(0, 8);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "capture") {
      await createMemory({
        title,
        content,
        summary: content.slice(0, 400),
        kind: "summary",
        scope,
        tags: ["inbox"],
        confidence: 0.64,
        importance: 0.55,
      });
    } else {
      await createDecision({
        title,
        context: content,
        decision: content,
        rationale,
        projectId: scope.startsWith("project:") ? scope.slice(8) : undefined,
        status: "accepted",
      });
    }
    if (!useBrace.getState().error) {
      setTitle("");
      setContent("");
      setRationale("");
    }
  };
  return (
    <Page eyebrow="Safe local capture" title="Inbox" description="Catch a thought, name a decision, or clear a memory review without rewriting an imported source file.">
      <div className="grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
        <section className="inbox-composer">
          <div className="inbox-mode" role="group" aria-label="Inbox capture type">
            <button type="button" className={mode === "capture" ? "is-active" : ""} aria-pressed={mode === "capture"} onClick={() => setMode("capture")}><Inbox className="h-4 w-4" />Capture</button>
            <button type="button" className={mode === "decision" ? "is-active" : ""} aria-pressed={mode === "decision"} onClick={() => setMode("decision")}><GitBranch className="h-4 w-4" />Decision</button>
          </div>
          <form onSubmit={submit}>
            <label htmlFor="inbox-title">{mode === "capture" ? "What should future-you recognize?" : "Name the decision"}</label>
            <input id="inbox-title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={mode === "capture" ? "A concise, recognisable title" : "The choice we made"} />
            <label htmlFor="inbox-content">{mode === "capture" ? "Capture" : "Decision and context"}</label>
            <textarea id="inbox-content" required value={content} onChange={(event) => setContent(event.target.value)} placeholder={mode === "capture" ? "Keep the useful outcome—not a raw transcript or credential." : "What was chosen, under which constraints, and what changed?"} />
            {mode === "decision" && <><label htmlFor="inbox-rationale">Rationale</label><textarea id="inbox-rationale" value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Why this option won" className="is-compact" /></>}
            <div className="inbox-composer-foot">
              <label>Scope<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="global">Global</option>{snapshot.projects.map((project) => <option key={project.id} value={`project:${project.id}`}>{project.name}</option>)}</select></label>
              <button type="submit" className="brace-primary h-10 px-4">{mode === "capture" ? "Send to inbox" : "Record decision"}<CornerDownLeft className="h-3.5 w-3.5" /></button>
            </div>
          </form>
        </section>
        <div className="space-y-5">
          <section className="brace-card overflow-hidden">
            <SectionHeading title="Review queue" action="Open review" onAction={() => setView("review")} />
            <div className="review-pulse"><span>{snapshot.memoryQuality.pendingReview}</span><div><strong>overlap {snapshot.memoryQuality.pendingReview === 1 ? "pair" : "pairs"}</strong><small>BRACE never auto-merges a near duplicate.</small></div><ArrowRight className="ml-auto h-4 w-4" /></div>
          </section>
          <section className="brace-card overflow-hidden">
            <SectionHeading title="Recent inbox captures" action="All memory" onAction={() => setView("memories")} />
            {recentCaptures.map((memory) => <MemoryRow key={memory.id} memory={memory} onClick={() => useBrace.getState().setSelectedMemory(memory)} />)}
            {!recentCaptures.length && <EmptyRows text="Your local inbox is clear." />}
          </section>
        </div>
      </div>
    </Page>
  );
}

function AiWorkspaceView() {
  const { snapshot, connectors, runAssistant, clearAssistantHistory, createMemory, setView } = useBrace();
  const available = connectors.filter((connector) => (connector.id === "codex" || connector.id === "claude") && connector.detected);
  const [client, setClient] = useState<"codex" | "claude">("codex");
  const [prompt, setPrompt] = useState("");
  const history = snapshot?.assistant?.history || [];
  const latest = history[history.length - 1];
  useEffect(() => {
    if (!available.some((connector) => connector.id === client) && available[0]) {
      setClient(available[0].id as "codex" | "claude");
    }
  }, [available, client]);
  if (!snapshot) return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await runAssistant(client, prompt);
    if (!useBrace.getState().error) setPrompt("");
  };
  const retain = async () => {
    if (!latest) return;
    await createMemory({
      kind: "summary",
      scope: "global",
      title: `AI handoff: ${latest.prompt.slice(0, 120)}`,
      summary: latest.response.slice(0, 500),
      content: latest.response.slice(0, 100_000),
      tags: ["ai-handoff", latest.client],
      confidence: 0.68,
      importance: 0.6,
    });
  };
  return (
    <div className="ai-workspace">
      <header className="ai-workspace-head">
        <div><div className="brace-eyebrow"><span />Original workspace, safer core</div><h1>AI Workspace</h1><p>BRACE recalls local context first, then sends only the approved capsule through your installed AI client.</p></div>
        <div className="ai-runtime-state"><span className={available.length ? "is-online" : ""} /><div><strong>{available.length ? `${available.length} local client${available.length === 1 ? "" : "s"} ready` : "No runnable client detected"}</strong><small>Read-only agent workspace · persistent local history</small></div></div>
      </header>
      <div className="ai-boundary"><ShieldCheck className="h-4 w-4" /><span><strong>Every turn has a visible boundary.</strong> BRACE previews how many memory and source records will be sent. Retrieved context may be sent to the selected provider. Imported projects cannot be edited from this surface.</span></div>
      <div className="ai-workspace-grid">
        <section className="ai-thread" aria-live="polite">
          <div className="ai-thread-toolbar"><span>LOCAL CONVERSATION HISTORY</span>{history.length > 0 && <button type="button" onClick={() => void clearAssistantHistory()}><Trash2 className="h-3.5 w-3.5" />Clear</button>}</div>
          <div className="ai-thread-scroll">
            {history.map((turn) => <article key={turn.id} className="ai-turn"><div className="ai-turn-user"><span>YOU</span><p>{turn.prompt}</p></div><div className="ai-turn-assistant"><span><Sparkles className="h-3.5 w-3.5" />{turn.client} · {turn.context.mode} · {turn.context.memoryCount} memories · {turn.context.sourceCount} sources</span><p>{turn.response}</p></div></article>)}
            {!history.length && <div className="ai-empty"><div className="ai-empty-orb"><i /><i /><Sparkles className="h-5 w-5" /></div><h2>Ask with your memory attached.</h2><p>Try “What decisions already constrain this project?” or “Summarize the lessons that matter before I continue.”</p></div>}
          </div>
          <form onSubmit={submit} className="ai-composer">
            <textarea required value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask BRACE with your durable context…" disabled={!available.length} />
            <div><label><span className="sr-only">AI client</span><select value={client} onChange={(event) => setClient(event.target.value as "codex" | "claude")} disabled={!available.length}>{available.map((connector) => <option key={connector.id} value={connector.id}>{connector.name}</option>)}</select></label><span>Context is selected locally before the provider boundary.</span><button type="submit" disabled={!available.length || !prompt.trim()} className="brace-primary">Send<CornerDownLeft className="h-3.5 w-3.5" /></button></div>
          </form>
        </section>
        <aside className="ai-context-rail">
          <section><span>LAST CONTEXT CAPSULE</span>{latest ? <><strong>{latest.context.memoryCount + latest.context.sourceCount}</strong><p>{latest.context.memoryCount} durable memories<br />{latest.context.sourceCount} source excerpts<br />{latest.context.embeddingModel || "Lexical retrieval"}</p></> : <p>No turn prepared yet.</p>}</section>
          <section><span>DURABLE RETENTION</span><h2>History is not memory.</h2><p>BRACE keeps this chat local. No answer becomes durable memory automatically; you explicitly choose the useful outcome.</p><button type="button" onClick={() => void retain()} disabled={!latest}><Brain className="h-4 w-4" />Retain latest answer</button></section>
          <section><span>CLIENT CONNECTIONS</span>{connectors.filter((connector) => connector.id !== "generic").map((connector) => <div key={connector.id}><i className={connector.configured ? "is-online" : connector.detected ? "is-detected" : ""} /><strong>{connector.name}</strong><small>{connector.configured ? "Configured" : connector.detected ? "Detected" : "Not installed"}</small></div>)}<button type="button" onClick={() => setView("connections")}><GitBranch className="h-4 w-4" />Open connection studio</button></section>
        </aside>
      </div>
    </div>
  );
}

function SearchView() {
  const { searchQuery, setSearchQuery, search, searchResult, setSelectedMemory, snapshot } = useBrace();
  const [range, setRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [savedRecalls, setSavedRecalls] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("brace.saved-recalls") || "[]").filter((value: unknown) => typeof value === "string").slice(0, 12); } catch { return []; }
  });
  const rangeOptions = [
    { id: "today" as const, label: "Today" },
    { id: "7d" as const, label: "7 days" },
    { id: "30d" as const, label: "30 days" },
    { id: "all" as const, label: "All time" },
  ];
  const sinceFor = (value: typeof range) => {
    if (value === "all") return null;
    const since = new Date();
    if (value === "today") since.setHours(0, 0, 0, 0);
    if (value === "7d") since.setTime(since.getTime() - (7 * 24 * 60 * 60 * 1_000));
    if (value === "30d") since.setTime(since.getTime() - (30 * 24 * 60 * 60 * 1_000));
    return since.toISOString();
  };
  const recall = (query?: string, selectedRange = range) => void search(query, { since: sinceFor(selectedRange) });
  const submit = (event: FormEvent) => { event.preventDefault(); recall(); };
  const selectRange = (selectedRange: typeof range) => {
    setRange(selectedRange);
    if (searchQuery.trim()) recall(undefined, selectedRange);
  };
  const suggestedQueries = [
    "What decisions constrain this project?",
    "What warnings should I remember?",
    "What did I learn from recent work?",
  ];
  const persistSaved = (queries: string[]) => {
    const next = [...new Set(queries.map((query) => query.trim()).filter(Boolean))].slice(0, 12);
    setSavedRecalls(next);
    try { localStorage.setItem("brace.saved-recalls", JSON.stringify(next)); } catch {}
  };
  const saveCurrentRecall = () => {
    if (searchQuery.trim()) persistSaved([searchQuery, ...savedRecalls]);
  };
  return (
    <Page eyebrow="Retrieval" title="Recall with provenance." description="Search durable memory and source chunks separately. BRACE never presents generated context as a source file.">
      <form onSubmit={submit} className="relative max-w-4xl">
        <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="What did we decide about imported project files?" className="h-14 w-full rounded-2xl border border-white/[0.1] bg-white/[0.04] pl-14 pr-28 text-[15px] outline-none placeholder:text-white/23 focus:border-[#7dd3fc]/45" autoFocus />
        <button type="submit" className="brace-primary absolute right-2 top-2 h-10 px-4">Recall</button>
      </form>
      <div className="recall-range mt-3 flex flex-wrap items-center gap-2 text-[10px] text-white/30">
        <span className="mr-1 flex items-center gap-1.5 text-white/40"><CalendarClock className="h-3.5 w-3.5" />Time scope</span>
        {rangeOptions.map((option) => (
          <button key={option.id} type="button" onClick={() => selectRange(option.id)} aria-pressed={range === option.id} className={range === option.id ? "is-active" : ""}>{option.label}</button>
        ))}
        <span className="rounded-full border border-white/[0.08] px-2.5 py-1">{snapshot?.semantic.enabled ? "Hybrid retrieval ready" : "Lexical retrieval"}</span>
        <span>Optional semantic ranking runs only when you enable a local embedding model.</span>
      </div>
      <div className="saved-recall-strip mt-3" aria-label="Saved recall questions">
        <span><Bookmark className="h-3.5 w-3.5" />Saved recalls</span>
        <div>{savedRecalls.map((query) => <span key={query}><button type="button" onClick={() => { setSearchQuery(query); recall(query); }}>{query}</button><button type="button" onClick={() => persistSaved(savedRecalls.filter((saved) => saved !== query))} aria-label={`Remove saved recall: ${query}`}><X className="h-3 w-3" /></button></span>)}{!savedRecalls.length && <small>Keep recurring questions one click away on this device.</small>}</div>
        <button type="button" onClick={saveCurrentRecall} disabled={!searchQuery.trim() || savedRecalls.includes(searchQuery.trim())}>Save current</button>
      </div>

      {searchResult ? (
        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          <section className="brace-card overflow-hidden">
            <SectionHeading title={`Memory · ${searchResult.memories.length}`} />
            <div className="divide-y divide-white/[0.055]">
              {searchResult.memories.map((memory) => <MemoryRow key={memory.id} memory={memory} onClick={() => setSelectedMemory(memory)} />)}
              {!searchResult.memories.length && <EmptyRows text="No durable memory matched this query." />}
            </div>
          </section>
          <section className="brace-card overflow-hidden">
            <SectionHeading title={`Source evidence · ${searchResult.sources.length}`} />
            <div className="divide-y divide-white/[0.055]">
              {searchResult.sources.map((source) => (
                <article key={source.id} className="px-5 py-4">
                  <div className="flex items-start gap-3"><FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" /><div className="min-w-0"><h3 className="truncate text-[13px] font-medium">{source.heading || source.title}</h3><p className="mt-1.5 line-clamp-3 text-xs leading-5 text-white/40">{source.content}</p><div className="mt-3 flex items-center gap-2 font-mono text-[9px] text-sky-200/45"><span className="truncate">{shortUri(source.uri)}</span><span>·</span><span>{searchResult.mode}</span></div></div></div>
                </article>
              ))}
              {!searchResult.sources.length && <EmptyRows text="No indexed source chunk matched this query." />}
            </div>
          </section>
          {searchResult.warning && <p className="xl:col-span-2 flex items-center gap-2 text-xs text-amber-200/65"><Info className="h-3.5 w-3.5" />{searchResult.warning}</p>}
        </div>
      ) : (
        <div className="recall-empty mt-14 max-w-2xl rounded-2xl border border-dashed border-white/[0.09] p-9 text-center"><BookOpen className="mx-auto h-6 w-6 text-white/20" /><p className="mt-3 text-sm text-white/38">Try a question, exact term, tag, or decision title.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{suggestedQueries.map((query) => <button key={query} type="button" onClick={() => { setSearchQuery(query); recall(query); }}>{query}</button>)}</div></div>
      )}
    </Page>
  );
}

function MemoriesView() {
  const { snapshot, setSelectedMemory, setView } = useBrace();
  const [composerOpen, setComposerOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"updated" | "confidence" | "importance" | "title">("updated");
  if (!snapshot) return null;
  const needle = query.trim().toLowerCase();
  const memories = snapshot.memories
    .filter((memory) => filter === "all" || (filter === "pinned" ? memory.pinned : memory.kind === filter))
    .filter((memory) => !needle || `${memory.title} ${memory.summary} ${memory.tags.join(" ")} ${memory.scope}`.toLowerCase().includes(needle))
    .sort((left, right) => sort === "title"
      ? left.title.localeCompare(right.title)
      : sort === "confidence"
        ? right.confidence - left.confidence
        : sort === "importance"
          ? right.importance - left.importance
          : new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  return (
    <Page eyebrow="Durable context" title="Memory" description="Concise facts, lessons, procedures, warnings, and preferences—kept separate from raw source material." actions={<><button type="button" aria-label="Open memory review queue" onClick={() => setView("review")} className="brace-secondary h-10 px-4"><Archive className="h-4 w-4" />Review queue{snapshot.memoryQuality.pendingReview > 0 && <span className="rounded-full bg-sky-300/15 px-1.5 py-0.5 text-[9px] text-sky-100">{snapshot.memoryQuality.pendingReview}</span>}</button><button type="button" onClick={() => setComposerOpen((value) => !value)} className="brace-primary h-10 px-4"><Plus className="h-4 w-4" />Remember</button></>}>
      {composerOpen && <MemoryComposer onClose={() => setComposerOpen(false)} />}
      <div className="memory-toolbelt mb-4">
        <label><Search className="h-4 w-4" /><span className="sr-only">Filter memories</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by title, tag, scope…" /></label>
        <div className="memory-kind-filter" role="group" aria-label="Filter memories by type">{["all", "pinned", "project", "decision", "lesson", "warning", "preference", "fact", "procedure"].map((kind) => (
          <button key={kind} type="button" onClick={() => setFilter(kind)} aria-pressed={filter === kind} className={filter === kind ? "is-active" : ""}>{kind}</button>
        ))}</div>
        <label className="memory-sort"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="updated">Recently updated</option><option value="importance">Importance</option><option value="confidence">Confidence</option><option value="title">Title A–Z</option></select></label>
      </div>
      <div className="memory-result-line"><span>{memories.length} of {snapshot.memories.length} memories</span>{(query || filter !== "all") && <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button>}</div>
      <div className="brace-memory-grid grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {memories.map((memory) => (
          <button key={memory.id} type="button" onClick={() => setSelectedMemory(memory)} className="brace-card brace-memory-card group flex min-h-48 flex-col p-5 text-left hover:border-white/[0.13]">
            <div className="flex items-start justify-between gap-3"><span className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${kindTone[memory.kind]}`}>{memory.kind}</span><span className="flex items-center gap-2 text-[10px] text-white/22">{memory.pinned && <Pin className="h-3 w-3 rotate-45 text-[#b7f36b]" aria-label="Pinned" />}{Math.round(memory.confidence * 100)}% confidence</span></div>
            <h2 className="mt-4 text-[15px] font-semibold leading-5 text-white/90">{memory.title}</h2>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/38">{memory.summary}</p>
            <div className="mt-auto flex items-end justify-between gap-3 pt-5"><div className="min-w-0"><div className="flex flex-wrap gap-1">{memory.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-white/[0.045] px-1.5 py-0.5 text-[9px] text-white/32">#{tag}</span>)}</div><div className="mt-2 flex items-center gap-2 truncate text-[9px] text-white/22"><span>{shortUri(memory.sourceUri)}</span><i /> <span>{formatDate(memory.updatedAt)}</span></div></div><ChevronRight className="h-4 w-4 shrink-0 text-white/12 group-hover:text-white/45" /></div>
          </button>
        ))}
      </div>
      {!memories.length && <div className="brace-card py-16 text-center text-sm text-white/32">No memories in this category.</div>}
    </Page>
  );
}

function MemoryReviewView() {
  const { snapshot, resolveMemoryReview, setSelectedMemory, setView, operation } = useBrace();
  if (!snapshot) return null;
  const quality = snapshot.memoryQuality;
  return (
    <Page
      eyebrow="Memory intelligence"
      title="Keep your memory precise."
      description="BRACE flags likely overlap without auto-merging. You decide which memory becomes canonical, or confirm that both express distinct truths."
      actions={<button type="button" onClick={() => setView("memories")} className="brace-secondary h-10 px-4"><Brain className="h-4 w-4" />Back to memory</button>}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <QualityMetric label="Needs review" value={quality.pendingReview} detail="Potentially overlapping pairs" tone={quality.pendingReview ? "attention" : "good"} />
        <QualityMetric label="Provenance linked" value={`${quality.linkedPercent}%`} detail={`${quality.linked} of ${quality.active} active memories`} tone="neutral" />
        <QualityMetric label="High confidence" value={`${quality.highConfidencePercent}%`} detail={`${quality.highConfidence} at 80% or above`} tone="neutral" />
      </div>

      {quality.candidates.length ? (
        <div className="space-y-4" aria-label="Memory review queue">
          {quality.candidates.map((candidate, index) => (
            <article key={candidate.pairKey} className="brace-card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-300/15 bg-sky-300/[0.06] font-mono text-[10px] text-sky-100/65">{String(index + 1).padStart(2, "0")}</span>
                  <div><h2 className="text-sm font-semibold">Possible overlap</h2><p className="mt-0.5 text-[10px] text-white/30">{candidate.signal === "captured-overlap" ? "Detected during capture" : "Detected by local content comparison"}</p></div>
                </div>
                <span className="rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-2.5 py-1 text-[10px] font-medium text-violet-100/65">{Math.round(candidate.similarity * 100)}% lexical overlap</span>
              </header>
              <div className="grid lg:grid-cols-2">
                <ReviewMemory
                  side="left"
                  memory={candidate.left}
                  onInspect={() => setSelectedMemory(candidate.left)}
                  onKeep={() => void resolveMemoryReview({ leftId: candidate.left.id, rightId: candidate.right.id, outcome: "keep-left" })}
                  disabled={Boolean(operation)}
                />
                <ReviewMemory
                  side="right"
                  memory={candidate.right}
                  onInspect={() => setSelectedMemory(candidate.right)}
                  onKeep={() => void resolveMemoryReview({ leftId: candidate.left.id, rightId: candidate.right.id, outcome: "keep-right" })}
                  disabled={Boolean(operation)}
                />
              </div>
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-white/[0.012] px-5 py-3">
                <p className="max-w-2xl text-[10px] leading-5 text-white/28">Choosing a canonical memory keeps both records in SQLite; the other leaves active recall as superseded.</p>
                <button
                  type="button"
                  disabled={Boolean(operation)}
                  onClick={() => void resolveMemoryReview({ leftId: candidate.left.id, rightId: candidate.right.id, outcome: "distinct" })}
                  className="brace-secondary h-9 px-3 disabled:opacity-40"
                >
                  <CircleDot className="h-3.5 w-3.5" />Keep both as distinct
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <section className="brace-card py-20 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200"><Check className="h-6 w-6" /></span>
          <h2 className="mt-5 text-lg font-semibold">Review queue is clear.</h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-white/35">No unresolved near-duplicate pairs are active. BRACE will surface new candidates here instead of merging them silently.</p>
          <button type="button" onClick={() => setView("memories")} className="brace-primary mx-auto mt-6 h-10 px-4"><Plus className="h-4 w-4" />Capture a memory</button>
        </section>
      )}
    </Page>
  );
}

function QualityMetric({ label, value, detail, tone }: { label: string; value: string | number; detail: string; tone: "attention" | "good" | "neutral" }) {
  const color = tone === "attention" ? "text-amber-200" : tone === "good" ? "text-emerald-200" : "text-sky-100";
  return <div className="brace-card p-4"><p className="brace-label">{label}</p><strong className={`mt-2 block text-2xl font-medium tracking-[-0.04em] ${color}`}>{value}</strong><p className="mt-1 text-[10px] text-white/28">{detail}</p></div>;
}

function ReviewMemory({ side, memory, onInspect, onKeep, disabled }: { side: "left" | "right"; memory: BraceMemory; onInspect: () => void; onKeep: () => void; disabled: boolean }) {
  return (
    <section className={`p-5 ${side === "right" ? "border-t border-white/[0.06] lg:border-l lg:border-t-0" : ""}`}>
      <div className="flex items-center justify-between gap-3"><span className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${kindTone[memory.kind]}`}>{memory.kind}</span><span className="text-[10px] text-white/25">{Math.round(memory.confidence * 100)}% confidence</span></div>
      <h3 className="mt-4 text-[15px] font-semibold leading-5 text-white/90">{memory.title}</h3>
      <p className="mt-2 min-h-15 text-xs leading-5 text-white/40">{memory.summary}</p>
      <div className="mt-4 flex items-center gap-2 text-[10px] text-white/24"><FileText className="h-3 w-3" /><span className="truncate">{shortUri(memory.sourceUri)}</span><span>·</span><span>{formatDate(memory.updatedAt)}</span></div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={onKeep} disabled={disabled} aria-label={`Keep ${memory.title} as canonical`} className="brace-primary h-9 px-3 disabled:opacity-40"><Check className="h-3.5 w-3.5" />Keep this memory</button>
        <button type="button" onClick={onInspect} className="brace-secondary h-9 px-3">Inspect</button>
      </div>
    </section>
  );
}

function MemoryComposer({ onClose }: { onClose: () => void }) {
  const { createMemory, snapshot } = useBrace();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("fact");
  const [scope, setScope] = useState("global");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createMemory({ title, content, summary: content.slice(0, 400), kind, scope, confidence: 0.75, importance: 0.6 });
    if (!useBrace.getState().error) onClose();
  };
  return (
    <form onSubmit={submit} className="brace-card mb-5 grid gap-4 p-5 lg:grid-cols-[170px_1fr_auto]">
      <div><label className="brace-label" htmlFor="memory-kind">Type</label><select id="memory-kind" value={kind} onChange={(event) => setKind(event.target.value)} className="brace-input mt-2"><option value="fact">Fact</option><option value="project">Project context</option><option value="lesson">Lesson</option><option value="warning">Warning</option><option value="preference">Preference</option><option value="procedure">Procedure</option><option value="hypothesis">Hypothesis</option><option value="summary">Summary</option></select></div>
      <div className="space-y-3"><div><label className="brace-label" htmlFor="memory-title">Title</label><input id="memory-title" value={title} onChange={(event) => setTitle(event.target.value)} className="brace-input mt-2" placeholder="A durable, specific statement" required /></div><div><label className="brace-label" htmlFor="memory-content">What should every AI remember?</label><textarea id="memory-content" value={content} onChange={(event) => setContent(event.target.value)} className="brace-input mt-2 min-h-28 resize-y py-3" placeholder="Keep it concise. Do not store passwords, raw transcripts, or chain-of-thought." required /></div><div><label className="brace-label" htmlFor="memory-scope">Scope</label><select id="memory-scope" value={scope} onChange={(event) => setScope(event.target.value)} className="brace-input mt-2"><option value="global">Global</option>{snapshot?.projects.map((project) => <option key={project.id} value={`project:${project.id}`}>{project.name}</option>)}</select></div></div>
      <div className="flex gap-2 lg:flex-col"><button type="submit" className="brace-primary h-10 px-4">Save</button><button type="button" onClick={onClose} className="brace-secondary h-10 px-4">Cancel</button></div>
    </form>
  );
}

function TimelineView() {
  const { snapshot } = useBrace();
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  if (!snapshot) return null;
  const filteredEvents = snapshot.timeline.filter((event) => {
    const family = event.eventType.split(".")[0];
    const matchesType = type === "all" || family === type;
    const needle = query.trim().toLowerCase();
    return matchesType && (!needle || `${event.title} ${event.summary} ${event.eventType}`.toLowerCase().includes(needle));
  });
  return (
    <Page eyebrow="Change over time" title="Timeline & decisions" description="An auditable history of explicit decisions, memory changes, evidence, and indexing events." actions={<button type="button" onClick={() => setFormOpen((value) => !value)} className="brace-primary h-10 px-4"><GitBranch className="h-4 w-4" />Record decision</button>}>
      {formOpen && <DecisionComposer onClose={() => setFormOpen(false)} />}
      <div className="timeline-toolbelt mx-auto mb-4 max-w-4xl"><label><Search className="h-4 w-4" /><span className="sr-only">Filter timeline</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an event or decision…" /></label><div role="group" aria-label="Filter timeline by event type">{[["all", "All"], ["memory", "Memory"], ["decision", "Decisions"], ["project", "Projects"], ["evidence", "Evidence"]].map(([value, label]) => <button key={value} type="button" className={type === value ? "is-active" : ""} aria-pressed={type === value} onClick={() => setType(value)}>{label}</button>)}</div><span>{filteredEvents.length} events</span></div>
      <div className="brace-card brace-timeline-card mx-auto max-w-4xl overflow-hidden px-5 py-3 sm:px-8">
        {filteredEvents.map((event, index) => (
          <article key={event.id} className="relative grid grid-cols-[28px_1fr] gap-4 py-5">
            {index !== filteredEvents.length - 1 && <span className="absolute bottom-[-20px] left-[13px] top-8 w-px bg-white/[0.07]" />}
            <span className={`relative mt-1.5 h-3 w-3 rounded-full border-[3px] border-[#101927] ${event.eventType.startsWith("decision") ? "bg-violet-300 shadow-[0_0_0_3px_rgba(196,181,253,.1)]" : "bg-[#7dd3fc] shadow-[0_0_0_3px_rgba(125,211,252,.1)]"}`} />
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-white/28">{event.eventType.replaceAll(".", " · ")}</span><span className="text-[10px] text-white/20">{formatDate(event.occurredAt)}</span></div><h2 className="mt-2 text-[15px] font-semibold text-white/88">{event.title}</h2><p className="mt-1.5 max-w-2xl text-xs leading-5 text-white/40">{event.summary}</p></div>
          </article>
        ))}
        {!filteredEvents.length && <div className="py-14 text-center"><Clock3 className="mx-auto h-5 w-5 text-white/20" /><p className="mt-3 text-xs text-white/32">No timeline events match these filters.</p><button type="button" onClick={() => { setType("all"); setQuery(""); }} className="mt-4 text-[11px] text-sky-200/70">Reset timeline filters</button></div>}
      </div>
    </Page>
  );
}

function DecisionComposer({ onClose }: { onClose: () => void }) {
  const { createDecision, snapshot } = useBrace();
  const [projectId, setProjectId] = useState(snapshot?.projects[0]?.id || "");
  const [title, setTitle] = useState("");
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createDecision({ projectId: projectId || null, title, decision, rationale, status: "accepted" });
    if (!useBrace.getState().error) onClose();
  };
  return (
    <form onSubmit={submit} className="brace-card mx-auto mb-5 max-w-4xl space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="brace-label" htmlFor="decision-project">Project</label><select id="decision-project" value={projectId} onChange={(event) => setProjectId(event.target.value)} className="brace-input mt-2"><option value="">Global</option>{snapshot?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div><div><label className="brace-label" htmlFor="decision-title">Decision title</label><input id="decision-title" value={title} onChange={(event) => setTitle(event.target.value)} className="brace-input mt-2" required /></div></div>
      <div><label className="brace-label" htmlFor="decision-text">Decision</label><textarea id="decision-text" value={decision} onChange={(event) => setDecision(event.target.value)} className="brace-input mt-2 min-h-24 py-3" required /></div>
      <div><label className="brace-label" htmlFor="decision-rationale">Rationale</label><textarea id="decision-rationale" value={rationale} onChange={(event) => setRationale(event.target.value)} className="brace-input mt-2 min-h-20 py-3" /></div>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="brace-secondary h-10 px-4">Cancel</button><button type="submit" className="brace-primary h-10 px-4">Record</button></div>
    </form>
  );
}

function GraphView() {
  const { snapshot } = useBrace();
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [layout, setLayout] = useState<GraphPreset>("rings");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem("brace.graph-preset") as GraphPreset | null;
    if (saved && graphPresetDetails.some((preset) => preset.id === saved)) {
      setLayout(saved);
    }
  }, []);
  const selectLayout = (preset: GraphPreset) => {
    setLayout(preset);
    localStorage.setItem("brace.graph-preset", preset);
  };
  if (!snapshot) return null;
  const selected = snapshot.graph.nodes.find((node) => node.id === selectedId) || snapshot.graph.nodes.find((node) => node.type === "project") || snapshot.graph.nodes[0];
  const connectedEdges = selected ? snapshot.graph.edges.filter((edge) => edge.from === selected.id || edge.to === selected.id) : [];
  const connectedNodes = connectedEdges.map((edge) => snapshot.graph.nodes.find((node) => node.id === (edge.from === selected?.id ? edge.to : edge.from))).filter(Boolean) as GraphNode[];
  return (
    <Page eyebrow="Living relationships" title="Knowledge atlas" description="Travel one memory graph through the two original maps, the two public maps, and a new time-based Chronicle.">
      <div className="graph-toolbar">
        <label className="graph-search"><Search className="h-4 w-4" /><span className="sr-only">Find a node</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a memory, source, or entity…" /></label>
        <div className="graph-layout graph-layout--five" aria-label="Graph preset">
          {graphPresetDetails.map((preset) => <button key={preset.id} type="button" className={layout === preset.id ? "is-active" : ""} aria-pressed={layout === preset.id} onClick={() => selectLayout(preset.id)} title={`${preset.lineage}: ${preset.description}`}>{preset.label}</button>)}
        </div>
        <div className="graph-filters" aria-label="Filter graph nodes">{["all", "project", "source", "memory", "decision", "entity"].map((item) => <button key={item} type="button" onClick={() => setType(item)} className={type === item ? "is-active" : ""} aria-pressed={type === item}>{item}</button>)}</div>
        <div className="graph-zoom" aria-label="Graph zoom controls"><button type="button" onClick={() => setZoom((value) => Math.max(.72, value - .12))} aria-label="Zoom out"><Minus className="h-4 w-4" /></button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(1.45, value + .12))} aria-label="Zoom in"><Plus className="h-4 w-4" /></button><button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom"><Maximize2 className="h-4 w-4" /></button></div>
      </div>
      <div className="graph-stage">
        <div className="graph-canvas-wrap">
          <GraphCanvas nodes={snapshot.graph.nodes} edges={snapshot.graph.edges} activeType={type} query={query} zoom={zoom} layout={layout} selectedId={selected?.id || null} onSelect={setSelectedId} />
          <div className="graph-legend">{[["project", "Project"], ["source", "Source"], ["decision", "Decision"], ["memory", "Memory"], ["entity", "Entity"]].map(([nodeType, label]) => <span key={label}><i data-type={nodeType} />{label}</span>)}</div>
          <div className="graph-hint"><CircleDot className="h-3.5 w-3.5" /> {graphPresetDetails.find((preset) => preset.id === layout)?.description} · use arrow keys to travel</div>
        </div>
        <aside className="graph-inspector" aria-live="polite">
          {selected ? <>
            <div className="graph-inspector-type"><i data-type={selected.type} />{selected.type}</div>
            <h2>{selected.label}</h2>
            <p>{selected.type === "project" ? "The anchor for imported context. Original files remain canonical." : selected.type === "source" ? "Indexed evidence from an imported source. BRACE does not edit the original." : selected.type === "decision" ? "An explicit choice preserved with its rationale and project context." : selected.type === "memory" ? "Durable context distilled for reliable recall across connected AI tools." : "A named idea extracted to make related context easier to traverse."}</p>
            <div className="graph-inspector-stat"><span>Direct relations</span><strong>{connectedEdges.length}</strong></div>
            <div className="graph-inspector-links">
              <span>CONNECTED TO</span>
              {connectedNodes.slice(0, 5).map((node) => <button key={node.id} type="button" onClick={() => setSelectedId(node.id)}><i data-type={node.type} /><span>{node.label}<small>{node.type}</small></span><ChevronRight className="ml-auto h-3.5 w-3.5" /></button>)}
              {!connectedNodes.length && <small>No direct relationships in this view.</small>}
            </div>
          </> : <EmptyRows text="Add or import context to build your graph." />}
        </aside>
      </div>
    </Page>
  );
}

function GraphCanvas({ nodes, edges, activeType, query, zoom, layout, selectedId, onSelect }: { nodes: GraphNode[]; edges: GraphEdge[]; activeType: string; query: string; zoom: number; layout: GraphPreset; selectedId: string | null; onSelect: (id: string) => void }) {
  const positions = useMemo(() => graphPositions(layout, nodes, edges, selectedId), [layout, nodes, edges, selectedId]);
  const color = (nodeType: string) => ({ project: "#7dd3fc", source: "#60a5fa", decision: "#c4b5fd", memory: "#6ee7b7", entity: "#cbd5e1" }[nodeType] || "#fff");
  const filteredEdges = edges.filter((edge) => positions.has(edge.from) && positions.has(edge.to));
  const normalizedQuery = query.trim().toLowerCase();
  const isVisible = (node: GraphNode) => (activeType === "all" || node.type === activeType) && (!normalizedQuery || node.label.toLowerCase().includes(normalizedQuery));
  const selectedNeighborIds = new Set(filteredEdges.filter((edge) => edge.from === selectedId || edge.to === selectedId).flatMap((edge) => [edge.from, edge.to]));
  return (
    <svg viewBox="0 0 1000 620" className="graph-svg" data-preset={layout} role="img" aria-label={`${nodes.length} knowledge nodes and ${filteredEdges.length} relationships in ${layout} layout`}>
      <defs><filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter><radialGradient id="graph-vignette"><stop offset="0" stopColor="#17212a" stopOpacity=".7" /><stop offset="1" stopColor="#070a0d" stopOpacity="0" /></radialGradient><pattern id="graph-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(255,255,255,.035)" strokeWidth="1" /></pattern></defs>
      <rect width="1000" height="620" fill="url(#graph-vignette)" /><rect width="1000" height="620" fill="url(#graph-grid)" />
      {layout === "rings" && <g className="graph-rings" aria-hidden="true"><circle cx="500" cy="310" r="102" /><circle cx="500" cy="310" r="178" /><circle cx="500" cy="310" r="244" /><circle cx="500" cy="310" r="286" /></g>}
      {layout === "chronicle" && <g className="graph-chronicle-lanes" aria-hidden="true">{[[90,"PROJECT"],[205,"SOURCE"],[315,"DECISION"],[425,"MEMORY"],[535,"ENTITY"]].map(([y,label]) => <g key={label}><line x1="76" x2="936" y1={y} y2={y} /><text x="82" y={Number(y) - 10}>{label}</text></g>)}</g>}
      <g transform={`translate(${500 - 500 * zoom} ${310 - 310 * zoom}) scale(${zoom})`} className="graph-world">
        {filteredEdges.map((edge, index) => { const from = positions.get(edge.from)!; const to = positions.get(edge.to)!; const active = edge.from === selectedId || edge.to === selectedId; const straight = layout === "flow" || layout === "chronicle"; const curve = straight ? 0 : (index % 2 ? 1 : -1) * Math.min(38, Math.hypot(to.x - from.x, to.y - from.y) * .08); const midX = (from.x + to.x) / 2; const midY = (from.y + to.y) / 2; const dx = to.x - from.x; const dy = to.y - from.y; const length = Math.max(1, Math.hypot(dx, dy)); const controlX = midX - (dy / length) * curve; const controlY = midY + (dx / length) * curve; const path = `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`; return <g key={edge.id} className={active ? "graph-edge is-active" : "graph-edge"}><path d={path} /><circle r="2.4" fill={active ? "#9bdcff" : "rgba(255,255,255,.28)"}><animateMotion dur={`${5 + index % 4}s`} repeatCount="indefinite" path={path} /></circle>{active && <text x={controlX} y={controlY - 8} textAnchor="middle">{edge.relation.replaceAll("_", " ")}</text>}</g>; })}
        {nodes.map((node, index) => { const position = positions.get(node.id); if (!position) return null; const radius = node.type === "project" ? 22 : node.type === "memory" || node.type === "decision" ? 16 : 13; const selected = node.id === selectedId; const visible = isVisible(node); const related = selectedNeighborIds.has(node.id); const core = node.type === "project" ? <rect className="graph-node-core" x={-radius} y={-radius} width={radius * 2} height={radius * 2} rx="7" /> : node.type === "decision" ? <path className="graph-node-core" d={`M 0 ${-radius} L ${radius} 0 L 0 ${radius} L ${-radius} 0 Z`} /> : node.type === "memory" ? <path className="graph-node-core" d={`M ${-radius * .86} ${-radius * .5} L 0 ${-radius} L ${radius * .86} ${-radius * .5} L ${radius * .86} ${radius * .5} L 0 ${radius} L ${-radius * .86} ${radius * .5} Z`} /> : <circle className={`graph-node-core ${node.type === "entity" ? "is-entity" : ""}`} r={radius} />; return <g key={node.id} data-node-index={index} transform={`translate(${position.x} ${position.y})`} className={`graph-node ${layout === "living" ? "is-living" : ""} ${selected ? "is-selected" : ""} ${visible ? "is-visible" : "is-dimmed"} ${related ? "is-related" : ""}`} role="button" tabIndex={selected ? 0 : -1} aria-label={`${node.type}: ${node.label}`} onClick={() => onSelect(node.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(node.id); } if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) { event.preventDefault(); const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1; const next = (index + direction + nodes.length) % nodes.length; onSelect(nodes[next].id); requestAnimationFrame(() => document.querySelector<SVGGElement>(`[data-node-index="${next}"]`)?.focus()); } }} style={{ "--node-color": color(node.type), "--node-delay": `${index * 42}ms`, "--living-delay": `${-(index % 7) * .72}s` } as React.CSSProperties}><circle className="graph-node-wave" r={radius + 18} /><circle className="graph-node-halo" r={radius + 10} />{core}<circle className="graph-node-dot" r={node.type === "project" ? 5 : 3.5} /><text className="graph-node-label" y={radius + 26} textAnchor="middle">{node.label.length > 28 ? `${node.label.slice(0, 27)}…` : node.label}</text><text className="graph-node-type" y={radius + 39} textAnchor="middle">{node.type}</text></g>; })}
      </g>
    </svg>
  );
}

function ProjectsView() {
  const { snapshot, addProject, reindexProject } = useBrace();
  if (!snapshot) return null;
  return (
    <Page eyebrow="Source context" title="Projects" description="BRACE reads supported text files into a local index. It never moves, edits, or follows symlinks out of the selected folder." actions={<button type="button" onClick={() => void addProject()} className="brace-primary h-10 px-4"><FolderInput className="h-4 w-4" />Import folder</button>}>
      <div className="grid gap-4 lg:grid-cols-2">
        {snapshot.projects.map((project) => <ProjectCard key={project.id} project={project} onReindex={() => void reindexProject(project.id)} />)}
      </div>
      {!snapshot.projects.length && <div className="brace-card py-16 text-center"><FolderInput className="mx-auto h-6 w-6 text-white/20" /><p className="mt-3 text-sm text-white/35">Import a specific project folder to begin.</p></div>}
      <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs leading-5 text-white/35"><ShieldCheck className="mr-2 inline h-4 w-4 text-emerald-300/70" />Ignored by default: credentials, environment files, databases, logs, dependencies, build output, caches, and symlink targets.</div>
    </Page>
  );
}

function ProjectCard({ project, onReindex }: { project: BraceProject; onReindex: () => void }) {
  return (
    <article className="brace-card brace-project-card p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300"><Box className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="truncate text-[15px] font-semibold">{project.name}</h2><p className="mt-1 truncate text-[10px] text-white/25" title={project.root_path}>{project.root_path}</p></div><button type="button" onClick={onReindex} className="brace-secondary h-9 px-3" aria-label={`Reindex ${project.name}`}><RefreshCw className="h-3.5 w-3.5" />Reindex</button></div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.055] pt-4 text-[10px]"><div><span className="block text-white/25">Last indexed</span><span className="mt-1 block text-white/55">{formatDate(project.last_indexed_at)}</span></div><div><span className="block text-white/25">Ownership</span><span className="mt-1 block text-emerald-200/65">Originals unchanged</span></div></div></article>
  );
}

function SkillsView() {
  const { snapshot, toggleSkill, installSkill } = useBrace();
  if (!snapshot) return null;
  return (
    <Page eyebrow="Declarative extensions" title="BRACE Skills" description="Small, permission-scoped workflows that can read or write only the capabilities declared in their manifest. No arbitrary shell or JavaScript execution." actions={<button type="button" onClick={() => void installSkill()} className="brace-primary h-10 px-4"><PackagePlus className="h-4 w-4" />Install manifest</button>}>
      <div className="grid gap-4 lg:grid-cols-2">
        {snapshot.skills.map((skill) => <SkillCard key={skill.name} skill={skill} onToggle={(enabled) => void toggleSkill(skill.name, enabled)} />)}
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3"><SafetyFact icon={KeyRound} title="Explicit permissions" text="Every requested capability is shown before installation." /><SafetyFact icon={Archive} title="Installed disabled" text="Third-party skills stay off until you enable them." /><SafetyFact icon={ShieldCheck} title="Integrity checked" text="A checksum detects manifest changes after install." /></div>
    </Page>
  );
}

function SkillCard({ skill, onToggle }: { skill: BraceSkill; onToggle: (enabled: boolean) => void }) {
  return (
    <article className="brace-card brace-skill-card p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200"><Zap className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold">{skill.displayName}</h2><span className="font-mono text-[9px] text-white/20">v{skill.version}</span></div><p className="mt-1.5 text-xs leading-5 text-white/38">{skill.description}</p></div><button type="button" role="switch" aria-checked={skill.enabled} onClick={() => onToggle(!skill.enabled)} className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${skill.enabled ? "border-emerald-300/25 bg-emerald-300/25" : "border-white/10 bg-white/5"}`}><span className={`absolute top-[3px] h-4 w-4 rounded-full transition-transform ${skill.enabled ? "translate-x-[21px] bg-emerald-200" : "translate-x-[3px] bg-white/35"}`} /></button></div><div className="mt-5 border-t border-white/[0.055] pt-4"><div className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-white/25">Permissions</div><div className="flex flex-wrap gap-1.5">{skill.permissions.map((permission) => <span key={permission} className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 font-mono text-[9px] text-white/38">{permission}</span>)}</div></div></article>
  );
}

function SafetyFact({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="rounded-xl border border-white/[0.06] p-4"><Icon className="h-4 w-4 text-white/35" /><h3 className="mt-3 text-xs font-semibold">{title}</h3><p className="mt-1 text-[11px] leading-5 text-white/32">{text}</p></div>;
}

const automationTriggerLabels: Record<string, string> = {
  manual: "Manual launch",
  "schedule.interval": "Repeating interval",
  "schedule.daily": "Daily schedule",
  "memory.created": "Memory created",
  "decision.created": "Decision recorded",
  "project.indexed": "Project indexed",
  "session.handoff": "AI session handoff",
};

const automationActionLabels: Record<string, string> = {
  "memory.create": "Create durable memory",
  "decision.create": "Record a decision",
  "memory.search": "Search local memory",
  "memory.quality_scan": "Scan memory quality",
  "timeline.digest": "Build timeline brief",
  "project.reindex": "Refresh project index",
  "skill.run": "Run a BRACE skill",
};

const automationPermissionLabels: Record<string, string> = {
  "memory:read": "Read memory",
  "memory:write": "Write memory",
  "source:read": "Read source index",
  "source:write": "Refresh source index",
  "decision:write": "Write decisions",
  "timeline:read": "Read timeline",
  "project:read": "Read project metadata",
  "skill:run": "Run enabled skills",
};

function automationSchedule(automation: BraceAutomation) {
  if (automation.trigger.type === "schedule.interval") {
    const minutes = Number(automation.trigger.config.intervalMinutes || 0);
    if (minutes % 10080 === 0) return `Every ${minutes / 10080}w`;
    if (minutes % 1440 === 0) return `Every ${minutes / 1440}d`;
    if (minutes % 60 === 0) return `Every ${minutes / 60}h`;
    return `Every ${minutes}m`;
  }
  if (automation.trigger.type === "schedule.daily") {
    return `At ${String(automation.trigger.config.time || "09:00")} local time`;
  }
  return automationTriggerLabels[automation.trigger.type] || automation.trigger.type;
}

function AutomationsView() {
  const {
    snapshot,
    saveAutomation,
    toggleAutomation,
    runAutomation,
    retryAutomation,
    deleteAutomation,
    pauseAutomations,
  } = useBrace();
  const automations = snapshot?.automations;
  const definitions = automations?.definitions || [];
  const runs = automations?.runs || [];
  const [selectedId, setSelectedId] = useState(definitions[0]?.id || "");
  const [builder, setBuilder] = useState<{
    source?: BraceAutomation | BraceAutomationTemplate;
    existingId?: string;
  } | null>(null);
  const [runFilter, setRunFilter] = useState("all");
  const [expandedRun, setExpandedRun] = useState<string | null>(runs[0]?.id || null);
  const selected = definitions.find((automation) => automation.id === selectedId) || definitions[0] || null;
  const visibleRuns = runs.filter((run) => runFilter === "all" || run.status === runFilter).slice(0, 30);
  const successful = runs.filter((run) => run.status === "success").length;
  const failed = runs.filter((run) => run.status === "failed").length;

  useEffect(() => {
    if (selectedId && definitions.some((automation) => automation.id === selectedId)) return;
    setSelectedId(definitions[0]?.id || "");
  }, [definitions, selectedId]);

  if (!snapshot || !automations) return null;
  return (
    <Page
      eyebrow="Local orchestration"
      title="Automation studio"
      description="Compose private memory workflows from typed triggers, conditions, and actions. Every run is inspectable; arbitrary scripts and hidden network calls are impossible."
      actions={
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void pauseAutomations(!automations.paused)} className={`brace-secondary h-10 px-4 ${automations.paused ? "automation-resume" : ""}`}>
            {automations.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {automations.paused ? "Resume all" : "Pause all"}
          </button>
          <button type="button" onClick={() => setBuilder({})} className="brace-primary h-10 px-4"><Plus className="h-4 w-4" />Create automation</button>
        </div>
      }
    >
      <section className={`automation-pulse ${automations.paused ? "is-paused" : ""}`} aria-label="Automation runtime status">
        <div className="automation-pulse-orbit" aria-hidden="true"><i /><i /><i /></div>
        <div><span><i />{automations.paused ? "AUTOMATIC TRIGGERS PAUSED" : "LOCAL AUTOMATION RUNTIME ACTIVE"}</span><h2>{definitions.filter((item) => item.enabled).length} recipes listening.</h2><p>Schedules and BRACE events execute on this device while the desktop app is open. Manual previews remain available when paused.</p></div>
        <dl><div><dt>Recipes</dt><dd>{definitions.length}</dd></div><div><dt>Successful</dt><dd>{successful}</dd></div><div><dt>Attention</dt><dd className={failed ? "text-rose-200" : ""}>{failed}</dd></div></dl>
      </section>

      {automations.schedulerError && (
        <div className="automation-warning" role="alert"><Info className="h-4 w-4" /><div><strong>Scheduler needs attention</strong><span>{automations.schedulerError.message}</span></div><small>{formatDate(automations.schedulerError.occurredAt)}</small></div>
      )}

      <section className="mt-5">
        <div className="mb-3 flex items-end justify-between gap-4"><div><span className="brace-label">Blueprints</span><p className="mt-1 text-[11px] text-white/30">Start from a safe recipe, inspect it, then choose when to enable it.</p></div><span className="text-[9px] text-white/22">No code · no cloud</span></div>
        <div className="automation-template-strip">
          {automations.templates.map((template) => (
            <button key={template.id} type="button" onClick={() => setBuilder({ source: template })} className="automation-template">
              <span><WandSparkles className="h-4 w-4" /></span><strong>{template.name}</strong><small>{template.description}</small><em>Use blueprint <ArrowRight className="h-3 w-3" /></em>
            </button>
          ))}
        </div>
      </section>

      <div className="automation-studio mt-5">
        <section className="automation-library" aria-label="Saved automations">
          <div className="automation-panel-head"><div><span>SAVED RECIPES</span><strong>{definitions.length}</strong></div><button type="button" onClick={() => setBuilder({})} aria-label="Create automation"><Plus className="h-4 w-4" /></button></div>
          <div className="automation-library-scroll">
            {!definitions.length && <div className="automation-empty"><Workflow className="h-6 w-6" /><strong>No recipes yet</strong><p>Choose a blueprint or build a private local workflow from scratch.</p><button type="button" onClick={() => setBuilder({})}>Build the first recipe</button></div>}
            {definitions.map((automation) => {
              const active = selected?.id === automation.id;
              const lastRun = runs.find((run) => run.automationId === automation.id);
              return (
                <button key={automation.id} type="button" onClick={() => setSelectedId(automation.id)} className={`automation-library-row ${active ? "is-active" : ""}`} aria-pressed={active}>
                  <span className={`automation-recipe-light ${automation.enabled && !automations.paused ? "is-live" : ""}`} />
                  <span><strong>{automation.name}</strong><small>{automationSchedule(automation)}</small></span>
                  <em className={lastRun ? `is-${lastRun.status}` : ""}>{lastRun?.status || "never run"}</em>
                </button>
              );
            })}
          </div>
        </section>

        <section className="automation-inspector" aria-label="Automation recipe">
          {!selected && <div className="automation-inspector-empty"><Workflow className="h-8 w-8" /><h2>Choose a recipe to inspect</h2><p>Every trigger, condition, action, permission, and run remains visible.</p></div>}
          {selected && (
            <>
              <header className="automation-inspector-head">
                <div><span>RECIPE · V{selected.version}</span><h2>{selected.name}</h2><p>{selected.description || "No description yet."}</p></div>
                <button type="button" role="switch" aria-checked={selected.enabled} onClick={() => void toggleAutomation(selected.id, !selected.enabled)} className={`automation-master-switch ${selected.enabled ? "is-on" : ""}`}><i /><span>{selected.enabled ? "Enabled" : "Paused"}</span></button>
              </header>
              <div className="automation-recipe-spine">
                <AutomationRecipeNode number="WHEN" icon={CalendarClock} title={automationTriggerLabels[selected.trigger.type]} detail={automationSchedule(selected)} tone="trigger" />
                <div className="automation-spine-link"><i /><span>{selected.conditions.length ? `${selected.conditionLogic.toUpperCase()} · ${selected.conditions.length} condition${selected.conditions.length === 1 ? "" : "s"}` : "Always continue"}</span></div>
                {selected.conditions.length > 0 && <AutomationRecipeNode number="IF" icon={SlidersHorizontal} title={selected.conditions.map((condition) => `${condition.field} ${condition.operator.replaceAll("_", " ")} ${String(condition.value)}`).join(` ${selected.conditionLogic.toUpperCase()} `)} detail="Evaluated against the event payload at run time" tone="condition" />}
                {selected.actions.map((action, index) => (
                  <div key={`${action.type}-${index}`}>
                    <div className="automation-spine-link"><i /><span>{index ? "THEN CONTINUE" : "THEN DO"}</span></div>
                    <AutomationRecipeNode number={String(index + 1).padStart(2, "0")} icon={action.type === "skill.run" ? Zap : action.type === "project.reindex" ? FolderSync : Brain} title={automationActionLabels[action.type]} detail={AutomationActionSummary({ action, projects: snapshot.projects, skills: snapshot.skills })} tone="action" />
                  </div>
                ))}
              </div>
              <div className="automation-permissions"><ShieldCheck className="h-4 w-4" /><div><span>CAPABILITY ENVELOPE</span><p>{selected.permissions.map((permission) => automationPermissionLabels[permission] || permission).join(" · ")}</p></div></div>
              <footer className="automation-inspector-actions">
                <button type="button" onClick={() => void runAutomation(selected.id, true)} className="brace-secondary h-10 px-3"><FileSearch className="h-4 w-4" />Preview</button>
                <button type="button" onClick={() => void runAutomation(selected.id)} className="brace-primary h-10 px-4"><Play className="h-4 w-4" />Run now</button>
                <button type="button" onClick={() => setBuilder({ source: selected, existingId: selected.id })} className="brace-secondary ml-auto h-10 px-3"><SlidersHorizontal className="h-4 w-4" />Edit</button>
                <button type="button" onClick={() => void deleteAutomation(selected.id)} className="automation-delete" aria-label={`Delete ${selected.name}`}><Trash2 className="h-4 w-4" /></button>
              </footer>
            </>
          )}
        </section>
      </div>

      <section className="automation-runs mt-5">
        <div className="automation-runs-head"><div><span className="brace-label">Execution traces</span><p>Immutable recipe snapshots, step outputs, skips, failures, and retries.</p></div><div role="group" aria-label="Filter automation runs">{["all", "success", "failed", "skipped", "preview"].map((status) => <button key={status} type="button" className={runFilter === status ? "is-active" : ""} aria-pressed={runFilter === status} onClick={() => setRunFilter(status)}>{status}</button>)}</div></div>
        {!visibleRuns.length && <div className="automation-run-empty"><TimerReset className="h-5 w-5" />No {runFilter === "all" ? "automation" : runFilter} runs yet.</div>}
        <div className="automation-run-list">
          {visibleRuns.map((run) => <AutomationRunRow key={run.id} run={run} expanded={expandedRun === run.id} onExpand={() => setExpandedRun(expandedRun === run.id ? null : run.id)} onRetry={(dry) => void retryAutomation(run.id, dry)} />)}
        </div>
      </section>
      {builder && <AutomationBuilder source={builder.source} existingId={builder.existingId} projects={snapshot.projects} skills={snapshot.skills} onClose={() => setBuilder(null)} onSave={async (value) => { const saved = await saveAutomation(value, builder.existingId); if (saved) { setSelectedId(saved.id); setBuilder(null); } }} />}
    </Page>
  );
}

function AutomationRecipeNode({ number, icon: Icon, title, detail, tone }: { number: string; icon: LucideIcon; title: string; detail: string; tone: "trigger" | "condition" | "action" }) {
  return <div className={`automation-recipe-node is-${tone}`}><span className="automation-node-number">{number}</span><span className="automation-node-icon"><Icon className="h-4 w-4" /></span><div><strong>{title}</strong><small>{detail}</small></div><ChevronRight className="ml-auto h-4 w-4" /></div>;
}

function AutomationActionSummary({ action, projects, skills }: { action: BraceAutomationAction; projects: BraceProject[]; skills: BraceSkill[] }) {
  const config = action.config;
  if (action.type === "memory.create") return String(config.title || "Create a templated memory");
  if (action.type === "decision.create") return String(config.title || "Record a templated decision");
  if (action.type === "memory.search") return `Query: ${String(config.query || "trigger title")}`;
  if (action.type === "memory.quality_scan") return config.scope ? `Scope: ${String(config.scope)}` : "Inspect the full active memory set";
  if (action.type === "timeline.digest") return `${String(config.windowHours || 24)}h window · ${String(config.title || "Activity brief")}`;
  if (action.type === "project.reindex") return projects.find((project) => project.id === config.projectId)?.name || "Selected project";
  if (action.type === "skill.run") return `${skills.find((skill) => skill.name === config.name)?.displayName || String(config.name || "Skill")} · ${String(config.action || "action")}`;
  return "Typed local action";
}

function AutomationRunRow({ run, expanded, onExpand, onRetry }: { run: BraceAutomationRun; expanded: boolean; onExpand: () => void; onRetry: (dryRun: boolean) => void }) {
  return (
    <article className={`automation-run is-${run.status} ${expanded ? "is-expanded" : ""}`}>
      <button type="button" className="automation-run-summary" onClick={onExpand} aria-expanded={expanded}>
        <i /><span><strong>{run.automationName}</strong><small>{automationTriggerLabels[run.triggerType] || run.triggerType} · {formatDate(run.startedAt)}</small></span><em>{run.status}</em><code>{run.durationMs === null ? "—" : `${run.durationMs}ms`}</code><ChevronRight className="h-4 w-4" />
      </button>
      {expanded && <div className="automation-run-trace"><div className="automation-run-snapshot"><span>RECIPE SNAPSHOT</span><strong>v{String(run.automationSnapshot.version || "?")}</strong><small>{run.retryOf ? `Retry of ${run.retryOf.slice(0, 8)}` : run.dryRun ? "No mutations executed" : "Original definition preserved"}</small></div>{run.steps.map((step, index) => <div key={index} className={`automation-run-step is-${String(step.status || "success")}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{automationActionLabels[String(step.type)] || String(step.type || "Step")}</strong><small>{String(step.detail || (step.output ? JSON.stringify(step.output) : step.input ? `Preview: ${JSON.stringify(step.input)}` : "Completed"))}</small></div><em>{String(step.status || "success")}</em></div>)}{run.error && <div className="automation-run-error"><Info className="h-4 w-4" />{run.error}</div>}<footer><button type="button" onClick={() => onRetry(true)}><FileSearch className="h-3.5 w-3.5" />Preview retry</button><button type="button" onClick={() => onRetry(false)}><RotateCcw className="h-3.5 w-3.5" />Retry now</button></footer></div>}
    </article>
  );
}

function defaultAutomationAction(type: BraceAutomationAction["type"]): BraceAutomationAction {
  const configs: Record<string, Record<string, unknown>> = {
    "memory.create": { kind: "summary", scope: "global", title: "New automated memory", summary: "Created by an enabled local recipe.", content: "Describe what BRACE should retain.", tags: ["automation"], confidence: 0.8, importance: 0.65 },
    "decision.create": { projectId: "", title: "Automated decision", context: "", decision: "", rationale: "" },
    "memory.search": { query: "{{trigger.title}}", scope: "", limit: 8 },
    "memory.quality_scan": { scope: "" },
    "timeline.digest": { title: "BRACE activity brief", scope: "global", windowHours: 24 },
    "project.reindex": { projectId: "" },
    "skill.run": { name: "", action: "", input: {} },
  };
  return { type, config: configs[type] };
}

function AutomationBuilder({ source, existingId, projects, skills, onClose, onSave }: { source?: BraceAutomation | BraceAutomationTemplate; existingId?: string; projects: BraceProject[]; skills: BraceSkill[]; onClose: () => void; onSave: (input: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState(source?.name || "");
  const [description, setDescription] = useState(source?.description || "");
  const [triggerType, setTriggerType] = useState<BraceAutomation["trigger"]["type"]>(source?.trigger.type || "manual");
  const [intervalMinutes, setIntervalMinutes] = useState(Number(source?.trigger.config.intervalMinutes || 60));
  const [dailyTime, setDailyTime] = useState(String(source?.trigger.config.time || "09:00"));
  const [days, setDays] = useState<number[]>(Array.isArray(source?.trigger.config.daysOfWeek) ? source.trigger.config.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6]);
  const [conditionLogic, setConditionLogic] = useState<"and" | "or">(source?.conditionLogic || "and");
  const [conditions, setConditions] = useState<BraceAutomationCondition[]>(source?.conditions ? structuredClone(source.conditions) : []);
  const [actions, setActions] = useState<BraceAutomationAction[]>(source?.actions ? structuredClone(source.actions) : [defaultAutomationAction("memory.quality_scan")]);
  const [saving, setSaving] = useState(false);
  const permissions = [...new Set(actions.flatMap((action) => ({
    "memory.create": ["memory:write"], "decision.create": ["decision:write"], "memory.search": ["memory:read", "source:read"], "memory.quality_scan": ["memory:read"], "timeline.digest": ["timeline:read", "memory:write"], "project.reindex": ["project:read", "source:write"], "skill.run": ["skill:run"],
  }[action.type] || [])))].sort();
  const setCondition = (index: number, change: Partial<BraceAutomationCondition>) => setConditions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  const setAction = (index: number, action: BraceAutomationAction) => setActions((items) => items.map((item, itemIndex) => itemIndex === index ? action : item));
  const moveAction = (index: number, direction: -1 | 1) => setActions((items) => { const next = [...items]; const target = index + direction; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const triggerConfig = triggerType === "schedule.interval" ? { intervalMinutes } : triggerType === "schedule.daily" ? { time: dailyTime, daysOfWeek: days } : {};
      await onSave({ name, description, enabled: existingId && "enabled" in (source || {}) ? Boolean((source as BraceAutomation).enabled) : false, trigger: { type: triggerType, config: triggerConfig }, conditionLogic, conditions, actions });
    } finally { setSaving(false); }
  };
  return (
    <div className="brace-dialog-backdrop brace-dialog-backdrop--side" role="dialog" aria-modal="true" aria-labelledby="automation-builder-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="automation-builder" onSubmit={(event) => void submit(event)}>
        <header><div><span>{existingId ? "EDIT LOCAL RECIPE" : source ? "CONFIGURE BLUEPRINT" : "NEW LOCAL RECIPE"}</span><h1 id="automation-builder-title">Make BRACE work while you work.</h1><p>Build an inspectable trigger → conditions → actions chain. It starts paused.</p></div><button type="button" onClick={onClose} aria-label="Close automation builder"><X className="h-4 w-4" /></button></header>
        <div className="automation-builder-scroll">
          <section className="automation-builder-identity"><label><span>Name</span><input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Daily project pulse" /></label><label><span>Purpose</span><textarea maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should this recipe make easier?" /></label></section>
          <AutomationBuilderBlock number="01" label="WHEN" title="Choose one reliable trigger" icon={CalendarClock}>
            <select value={triggerType} onChange={(event) => setTriggerType(event.target.value as BraceAutomation["trigger"]["type"])}>{Object.entries(automationTriggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            {triggerType === "schedule.interval" && <label className="automation-inline-field"><span>Repeat every</span><input type="number" min="5" max="525600" value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))} /><em>minutes</em></label>}
            {triggerType === "schedule.daily" && <div className="automation-daily"><label><span>Local time</span><input type="time" value={dailyTime} onChange={(event) => setDailyTime(event.target.value)} /></label><fieldset><legend>Days</legend><div>{["S", "M", "T", "W", "T", "F", "S"].map((label, day) => <button key={day} type="button" className={days.includes(day) ? "is-active" : ""} aria-pressed={days.includes(day)} onClick={() => setDays((value) => value.includes(day) ? value.filter((item) => item !== day) : [...value, day].sort())}>{label}</button>)}</div></fieldset></div>}
            <p className="automation-builder-note"><CloudOff className="h-3.5 w-3.5" />Schedules use your computer’s local clock and run only while BRACE is open.</p>
          </AutomationBuilderBlock>
          <AutomationBuilderBlock number="02" label="IF" title="Narrow the event only when useful" icon={SlidersHorizontal} optional>
            <div className="automation-logic" role="group" aria-label="Condition logic"><button type="button" className={conditionLogic === "and" ? "is-active" : ""} onClick={() => setConditionLogic("and")}>Match all</button><button type="button" className={conditionLogic === "or" ? "is-active" : ""} onClick={() => setConditionLogic("or")}>Match any</button></div>
            <div className="automation-condition-list">{conditions.map((condition, index) => <div key={index} className="automation-condition"><select aria-label={`Condition ${index + 1} field`} value={condition.field} onChange={(event) => setCondition(index, { field: event.target.value as BraceAutomationCondition["field"] })}>{["title", "kind", "scope", "tags", "client", "projectId", "eventType"].map((field) => <option key={field} value={field}>{field}</option>)}</select><select aria-label={`Condition ${index + 1} operator`} value={condition.operator} onChange={(event) => setCondition(index, { operator: event.target.value as BraceAutomationCondition["operator"] })}>{["equals", "not_equals", "contains", "not_contains", "includes"].map((operator) => <option key={operator} value={operator}>{operator.replaceAll("_", " ")}</option>)}</select><input aria-label={`Condition ${index + 1} value`} value={String(condition.value)} onChange={(event) => setCondition(index, { value: event.target.value })} placeholder="comparison value" /><button type="button" onClick={() => setConditions((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove condition ${index + 1}`}><X className="h-3.5 w-3.5" /></button></div>)}</div>
            <button type="button" disabled={conditions.length >= 12} onClick={() => setConditions((items) => [...items, { field: "title", operator: "contains", value: "" }])} className="automation-add-step"><Plus className="h-3.5 w-3.5" />Add condition</button>
          </AutomationBuilderBlock>
          <AutomationBuilderBlock number="03" label="THEN" title="Compose a bounded action sequence" icon={Workflow}>
            <div className="automation-action-editor-list">{actions.map((action, index) => <div key={index} className="automation-action-editor"><div className="automation-action-editor-head"><span>{String(index + 1).padStart(2, "0")}</span><select aria-label={`Action ${index + 1} type`} value={action.type} onChange={(event) => setAction(index, defaultAutomationAction(event.target.value as BraceAutomationAction["type"]))}>{Object.entries(automationActionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><div><button type="button" disabled={index === 0} onClick={() => moveAction(index, -1)} aria-label="Move action up">↑</button><button type="button" disabled={index === actions.length - 1} onClick={() => moveAction(index, 1)} aria-label="Move action down">↓</button><button type="button" disabled={actions.length === 1} onClick={() => setActions((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove action"><X className="h-3.5 w-3.5" /></button></div></div><AutomationActionFields action={action} projects={projects} skills={skills} onChange={(config) => setAction(index, { ...action, config })} /></div>)}</div>
            <button type="button" disabled={actions.length >= 8} onClick={() => setActions((items) => [...items, defaultAutomationAction("memory.quality_scan")])} className="automation-add-step"><Plus className="h-3.5 w-3.5" />Add action</button>
          </AutomationBuilderBlock>
          <section className="automation-safety-review"><ShieldCheck className="h-5 w-5" /><div><span>PERMISSION PREVIEW</span><h2>This recipe can only:</h2><p>{permissions.map((permission) => automationPermissionLabels[permission] || permission).join(" · ")}</p><small>BRACE automations cannot run shell commands, arbitrary code, network requests, deletion, exports, backups, or connector changes.</small></div></section>
        </div>
        <footer><span><i />Stored in your local SQLite profile</span><div><button type="button" onClick={onClose} className="brace-secondary h-10 px-4">Cancel</button><button type="submit" disabled={saving || !name.trim() || !actions.length} className="brace-primary h-10 px-4"><Save className="h-4 w-4" />{saving ? "Saving…" : existingId ? "Save recipe" : "Create paused"}</button></div></footer>
      </form>
    </div>
  );
}

function AutomationBuilderBlock({ number, label, title, icon: Icon, optional, children }: { number: string; label: string; title: string; icon: LucideIcon; optional?: boolean; children: React.ReactNode }) {
  return <section className="automation-builder-block"><header><span>{number}</span><i><Icon className="h-4 w-4" /></i><div><em>{label}{optional ? " · OPTIONAL" : ""}</em><h2>{title}</h2></div></header><div className="automation-builder-block-body">{children}</div></section>;
}

function AutomationActionFields({ action, projects, skills, onChange }: { action: BraceAutomationAction; projects: BraceProject[]; skills: BraceSkill[]; onChange: (config: Record<string, unknown>) => void }) {
  const config = action.config;
  const change = (key: string, value: unknown) => onChange({ ...config, [key]: value });
  if (action.type === "memory.create") return <div className="automation-action-fields"><select value={String(config.kind || "summary")} onChange={(event) => change("kind", event.target.value)} aria-label="Memory kind">{["project", "decision", "lesson", "warning", "preference", "summary", "hypothesis", "fact", "procedure"].map((kind) => <option key={kind}>{kind}</option>)}</select><input value={String(config.scope || "global")} onChange={(event) => change("scope", event.target.value)} placeholder="Scope or {{trigger.scope}}" aria-label="Memory scope" /><input className="is-wide" required value={String(config.title || "")} onChange={(event) => change("title", event.target.value)} placeholder="Memory title · templates allowed" aria-label="Memory title" /><textarea className="is-wide" required value={String(config.content || "")} onChange={(event) => change("content", event.target.value)} placeholder="Durable content · use {{trigger.title}} or {{trigger.summary}}" aria-label="Memory content" /></div>;
  if (action.type === "decision.create") return <div className="automation-action-fields"><select value={String(config.projectId || "")} onChange={(event) => change("projectId", event.target.value)} aria-label="Decision project"><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><input value={String(config.title || "")} onChange={(event) => change("title", event.target.value)} placeholder="Decision title" aria-label="Decision title" /><textarea className="is-wide" value={String(config.decision || "")} onChange={(event) => change("decision", event.target.value)} placeholder="What was decided?" aria-label="Decision" /></div>;
  if (action.type === "memory.search") return <div className="automation-action-fields"><input value={String(config.query || "")} onChange={(event) => change("query", event.target.value)} placeholder="Query or {{trigger.title}}" aria-label="Search query" /><input value={String(config.scope || "")} onChange={(event) => change("scope", event.target.value)} placeholder="Optional scope" aria-label="Search scope" /></div>;
  if (action.type === "memory.quality_scan") return <div className="automation-action-fields"><input className="is-wide" value={String(config.scope || "")} onChange={(event) => change("scope", event.target.value)} placeholder="Optional memory scope; blank scans all" aria-label="Memory quality scope" /></div>;
  if (action.type === "timeline.digest") return <div className="automation-action-fields"><input value={String(config.title || "")} onChange={(event) => change("title", event.target.value)} placeholder="Brief title" aria-label="Timeline brief title" /><input type="number" min="1" max="8760" value={Number(config.windowHours || 24)} onChange={(event) => change("windowHours", Number(event.target.value))} aria-label="Timeline window in hours" /><input className="is-wide" value={String(config.scope || "global")} onChange={(event) => change("scope", event.target.value)} placeholder="Memory scope" aria-label="Timeline brief scope" /></div>;
  if (action.type === "project.reindex") return <div className="automation-action-fields"><select className="is-wide" required value={String(config.projectId || "")} onChange={(event) => change("projectId", event.target.value)} aria-label="Project to refresh"><option value="">Choose an imported project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>;
  if (action.type === "skill.run") { const selectedSkill = skills.find((skill) => skill.name === config.name) || skills[0]; return <div className="automation-action-fields"><select value={String(config.name || "")} onChange={(event) => { const skill = skills.find((item) => item.name === event.target.value); onChange({ ...config, name: event.target.value, action: skill?.actions[0]?.id || "" }); }} aria-label="Skill"><option value="">Choose enabled skill</option>{skills.filter((skill) => skill.enabled).map((skill) => <option key={skill.name} value={skill.name}>{skill.displayName}</option>)}</select><select value={String(config.action || "")} onChange={(event) => change("action", event.target.value)} aria-label="Skill action"><option value="">Choose action</option>{selectedSkill?.actions.map((skillAction) => <option key={skillAction.id} value={skillAction.id}>{skillAction.label}</option>)}</select></div>; }
  return null;
}

function ConnectionsView() {
  const { snapshot, connectors, installConnector, refreshConnectors } = useBrace();
  const [access, setAccess] = useState<"read-only" | "remember">("read-only");
  const [selectedId, setSelectedId] = useState("generic");
  const [copied, setCopied] = useState(false);
  const selected = connectors.find((connector) => connector.id === selectedId);
  const fallbackConfig = {
    mcpServers: {
      brace: {
        command: snapshot?.connections?.command || "<path-to-BRACE-executable>",
        args: snapshot?.connections?.args || ["--mcp"],
        ...(snapshot?.connections?.env ? { env: snapshot.connections.env } : {}),
        ...(access === "remember" ? { env: { ...(snapshot?.connections?.env || {}), BRACE_MCP_WRITE: "1" } } : {}),
      },
    },
  };
  const config = JSON.stringify(
    selected
      ? access === "remember"
        ? selected.rememberConfig
        : selected.readOnlyConfig
      : fallbackConfig,
    null,
    2,
  );
  const copy = async (value: string) => {
    if (window.electron?.copyBraceText) {
      await window.electron.copyBraceText(value);
    } else {
      await navigator.clipboard.writeText(value);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  };
  return (
    <Page eyebrow="One memory. Every AI." title="Connection studio" description="Detect an AI client, choose its memory permission, and connect it to the same local BRACE brain with a guided, recoverable setup." actions={<button type="button" onClick={() => void refreshConnectors()} className="brace-secondary h-10 px-4"><RefreshCw className="h-4 w-4" />Detect again</button>}>
      <section className="connector-access mb-5" aria-label="Connector memory permission">
        <div><ShieldCheck className="h-4 w-4" /><span><strong>Memory permission</strong><small>Forgetting is never enabled by guided setup.</small></span></div>
        <div role="group" aria-label="Choose memory access">
          <button type="button" className={access === "read-only" ? "is-active" : ""} aria-pressed={access === "read-only"} onClick={() => setAccess("read-only")}>Recall only</button>
          <button type="button" className={access === "remember" ? "is-active" : ""} aria-pressed={access === "remember"} onClick={() => setAccess("remember")}>Recall + remember</button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
        <section className="space-y-3" aria-label="AI clients">
          {connectors.map((connector) => <ConnectorClientCard key={connector.id} connector={connector} selected={selectedId === connector.id} access={access} onSelect={() => setSelectedId(connector.id)} onInstall={() => void installConnector(connector.id, access)} />)}
          {!connectors.length && <div className="brace-card p-6 text-sm text-white/40"><LoaderCircle className="mb-3 h-5 w-5 animate-spin text-sky-200" />Detecting installed AI clients…</div>}
        </section>

        <div className="space-y-5">
          <section className="brace-card overflow-hidden">
            <SectionHeading title="Portable MCP configuration" action={copied ? "Copied" : "Copy JSON"} onAction={() => void copy(config)} />
            <div className="p-5">
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] p-4"><CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /><div><h2 className="text-xs font-semibold text-emerald-100/85">{access === "remember" ? "Explicit retention enabled" : "Read-only by default"}</h2><p className="mt-1 text-[11px] leading-5 text-white/36">{access === "remember" ? "This client may save concise memories and decisions, but cannot forget or delete memory." : "This client may search memory, inspect provenance, and read the graph without changing it."}</p></div></div>
              <pre className="max-h-[330px] overflow-auto rounded-xl border border-white/[0.07] bg-black/30 p-4 font-mono text-[10px] leading-5 text-white/55"><code>{config}</code></pre>
            </div>
          </section>
          <section className="brace-card overflow-hidden">
            <SectionHeading title="Shared-memory habit" action="Copy instruction" onAction={() => void copy(selected?.instruction || snapshot?.connections?.instruction || "Search BRACE before asking me to repeat durable context.")} />
            <div className="p-5"><p className="text-xs leading-6 text-white/46">{selected?.instruction || snapshot?.connections?.instruction || "Search BRACE before asking me to repeat durable context. Keep source evidence separate from memory."}</p><div className="mt-4 grid gap-2 sm:grid-cols-3"><ConnectorStep number="01" title="Recall" text="The client searches BRACE when prior context matters." /><ConnectorStep number="02" title="Work" text="The model uses cited memory and source evidence." /><ConnectorStep number="03" title="Handoff" text="Only explicit durable outcomes are retained." /></div></div>
          </section>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-rose-300/10 bg-rose-300/[0.03] p-4 text-xs leading-5 text-rose-100/55"><KeyRound className="mr-2 inline h-4 w-4" />A connected client can send retrieved context to its own model provider. BRACE shows this boundary before setup, creates a configuration backup, and never copies API keys.</div>
    </Page>
  );
}

function ConnectorClientCard({ connector, selected, access, onSelect, onInstall }: { connector: BraceConnector; selected: boolean; access: "read-only" | "remember"; onSelect: () => void; onInstall: () => void }) {
  const Icon = connector.id === "codex" ? Code2 : connector.id === "claude" ? Sparkles : connector.id === "antigravity" ? Network : GitBranch;
  return (
    <article className={`connector-client ${selected ? "is-selected" : ""}`}>
      <button type="button" className="connector-client-main" onClick={onSelect} aria-pressed={selected}>
        <span><Icon className="h-5 w-5" /></span>
        <span><strong>{connector.name}</strong><small>{connector.version || connector.description}</small></span>
        <i className={connector.configured ? "is-online" : connector.detected ? "is-detected" : ""} />
      </button>
      <div className="connector-client-foot">
        <span>{connector.configured ? "Configured" : connector.detected ? "Detected" : connector.id === "generic" ? "Manual config" : "Not installed"}</span>
        {connector.supportsInstall && <button type="button" disabled={!connector.detected} onClick={onInstall}>{connector.configured ? `Reconnect ${access === "remember" ? "with retention" : "read-only"}` : "Connect"}<ArrowRight className="h-3.5 w-3.5" /></button>}
        {!connector.supportsInstall && <button type="button" onClick={onSelect}>Show JSON<ArrowRight className="h-3.5 w-3.5" /></button>}
      </div>
    </article>
  );
}

function ConnectorStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="connector-step"><span>{number}</span><strong>{title}</strong><small>{text}</small></div>;
}

function SettingsView() {
  const { snapshot, configureEmbeddings, exportData, backupData, deleteAll } = useBrace();
  const config = snapshot?.semantic.config;
  const [enabled, setEnabled] = useState(Boolean(config?.enabled));
  const [endpoint, setEndpoint] = useState(config?.endpoint || "http://127.0.0.1:11434");
  const [model, setModel] = useState(config?.model || "nomic-embed-text");
  const [confirmation, setConfirmation] = useState("");
  if (!snapshot) return null;
  return (
    <Page eyebrow="Local control" title="Settings & data" description="You decide where memory lives, whether semantic retrieval runs, and when data leaves the machine.">
      <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
        <div className="space-y-5">
          <AppearanceControls />
          <section className="brace-card overflow-hidden"><SectionHeading title="Storage" /><div className="space-y-4 p-5"><SettingRow icon={Database} title="Application data" text={snapshot.storage?.directory || "System application-data directory"} /><SettingRow icon={HardDrive} title="SQLite database" text={snapshot.storage?.database || "brace.sqlite3"} /><p className="text-[10px] leading-5 text-white/28">The public source repository never contains this directory. Imported project originals stay outside it and are never modified.</p></div></section>
          <section className="brace-card overflow-hidden"><SectionHeading title="Backup & portability" /><div className="grid gap-3 p-5 sm:grid-cols-2"><button type="button" onClick={() => void backupData()} className="brace-secondary h-11 px-4"><Archive className="h-4 w-4" />Create SQLite backup</button><button type="button" onClick={() => void exportData()} className="brace-secondary h-11 px-4"><Download className="h-4 w-4" />Export portable JSON</button></div></section>
        </div>
        <div className="space-y-5">
          <section className="brace-card overflow-hidden"><SectionHeading title="Optional semantic retrieval" /><form onSubmit={(event) => { event.preventDefault(); void configureEmbeddings({ enabled, endpoint, model }); }} className="space-y-4 p-5"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#7dd3fc]" /><span><span className="block text-xs font-semibold">Enable local Ollama embeddings</span><span className="mt-1 block text-[11px] leading-5 text-white/32">BRACE sends indexed chunks only to the loopback endpoint below.</span></span></label><div><label className="brace-label" htmlFor="embedding-endpoint">Loopback endpoint</label><input id="embedding-endpoint" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} className="brace-input mt-2" /></div><div><label className="brace-label" htmlFor="embedding-model">Embedding model</label><input id="embedding-model" value={model} onChange={(event) => setModel(event.target.value)} className="brace-input mt-2" /></div><button type="submit" className="brace-primary h-10 px-4">Save retrieval settings</button></form></section>
          <section className="overflow-hidden rounded-2xl border border-rose-400/15 bg-rose-400/[0.035]"><div className="border-b border-rose-400/10 px-5 py-4"><h2 className="text-sm font-semibold text-rose-100">Delete local data</h2></div><div className="p-5"><p className="text-xs leading-5 text-white/38">Removes BRACE memories, indexes, skills, settings, and the demo copy. Imported project files remain untouched.</p><div className="mt-4 flex gap-2"><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type DELETE" className="brace-input" aria-label="Type DELETE to confirm" /><button type="button" disabled={confirmation !== "DELETE"} onClick={() => void deleteAll(confirmation)} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 text-xs font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" />Delete all</button></div></div></section>
        </div>
      </div>
    </Page>
  );
}

function AppearanceControls() {
  const read = (key: "density" | "motion" | "contrast", fallback: string) => typeof document === "undefined" ? fallback : document.documentElement.dataset[key] || fallback;
  const [density, setDensity] = useState(() => read("density", "comfortable"));
  const [motion, setMotion] = useState(() => read("motion", "expressive"));
  const [contrast, setContrast] = useState(() => read("contrast", "standard"));
  const update = (key: "density" | "motion" | "contrast", value: string) => {
    applyUiPreference(key, value);
    const next = { density: read("density", "comfortable"), motion: read("motion", "expressive"), contrast: read("contrast", "standard"), [key]: value };
    localStorage.setItem("brace.ui", JSON.stringify(next));
    if (key === "density") setDensity(value);
    if (key === "motion") setMotion(value);
    if (key === "contrast") setContrast(value);
  };
  const controls = [
    { key: "density" as const, label: "Density", value: density, options: [["comfortable", "Comfortable"], ["compact", "Compact"]] },
    { key: "motion" as const, label: "Motion", value: motion, options: [["expressive", "Expressive"], ["calm", "Calm"]] },
    { key: "contrast" as const, label: "Contrast", value: contrast, options: [["standard", "Standard"], ["high", "High"]] },
  ];
  return (
    <section className="brace-card overflow-hidden"><SectionHeading title="Interface" /><div className="appearance-controls p-5"><div className="appearance-intro"><span><SlidersHorizontal className="h-4 w-4" /></span><div><h3>Make the workspace fit you</h3><p>These display preferences stay on this device and never enter memory.</p></div></div>{controls.map((control) => <fieldset key={control.key}><legend>{control.label}</legend><div>{control.options.map(([value, label]) => <button key={value} type="button" className={control.value === value ? "is-active" : ""} aria-pressed={control.value === value} onClick={() => update(control.key, value)}>{label}</button>)}</div></fieldset>)}</div></section>
  );
}

function SettingRow({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/42"><Icon className="h-4 w-4" /></span><div className="min-w-0"><h3 className="text-xs font-semibold">{title}</h3><p className="mt-1 break-all font-mono text-[9px] leading-4 text-white/28">{text}</p></div></div>;
}

function MemoryDetail({ memory, onClose }: { memory: BraceMemory; onClose: () => void }) {
  const { forgetMemory, setSearchQuery, search, toggleMemoryPin } = useBrace();
  const [full, setFull] = useState<BraceMemory>(memory);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const api = window.electron;
    if (api?.getBraceMemory) void api.getBraceMemory(memory.id).then((value) => value && setFull(value));
  }, [memory.id]);
  const copyMemory = async () => {
    const value = [full.title, full.summary, full.content, full.sourceUri ? `Source: ${full.sourceUri}` : ""].filter(Boolean).join("\n\n");
    if (window.electron?.copyBraceText) await window.electron.copyBraceText(value);
    else await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  };
  const findRelated = () => {
    setSearchQuery(full.title);
    onClose();
    void search(full.title);
  };
  const togglePin = async () => {
    const updated = await toggleMemoryPin(full.id, !full.pinned);
    if (updated) setFull(updated);
  };
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/45 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="memory-detail-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="brace-detail-panel flex h-full w-full max-w-[520px] flex-col border-l border-white/[0.08] bg-[#101318] shadow-2xl">
        <div className="flex h-[72px] items-center justify-between border-b border-white/[0.07] px-5"><span className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${kindTone[full.kind]}`}>{full.kind}</span><button type="button" onClick={onClose} className="rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-white" aria-label="Close memory"><X className="h-4 w-4" /></button></div>
        <div className="flex-1 overflow-y-auto p-6"><h1 id="memory-detail-title" className="text-2xl font-medium leading-tight tracking-[-0.03em]">{full.title}</h1><p className="mt-3 text-sm leading-6 text-white/48">{full.summary}</p><div className="memory-detail-actions"><button type="button" onClick={() => void togglePin()}>{full.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}{full.pinned ? "Unpin memory" : "Pin for daily use"}</button><button type="button" onClick={() => void copyMemory()}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy memory"}</button><button type="button" onClick={findRelated}><Search className="h-3.5 w-3.5" />Find related context</button></div><div className="mt-7 border-t border-white/[0.06] pt-6"><h2 className="brace-label">Durable content</h2><p className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-white/66">{full.content}</p></div><dl className="mt-7 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-6 text-[10px]"><div><dt className="text-white/25">Scope</dt><dd className="mt-1 truncate text-white/52">{full.scope}</dd></div><div><dt className="text-white/25">Confidence</dt><dd className="mt-1 text-white/52">{Math.round(full.confidence * 100)}%</dd></div><div><dt className="text-white/25">Updated</dt><dd className="mt-1 text-white/52">{formatDate(full.updatedAt)}</dd></div><div><dt className="text-white/25">Embedding</dt><dd className="mt-1 text-white/52">{full.embeddingModel || "Lexical only"}</dd></div></dl><div className="mt-7 border-t border-white/[0.06] pt-6"><h2 className="brace-label">Provenance</h2><div className="mt-3 rounded-xl border border-sky-300/10 bg-sky-300/[0.035] p-4"><div className="flex items-center gap-2 text-xs text-sky-100/70"><FileText className="h-4 w-4" />{shortUri(full.sourceUri)}</div>{full.sourceExcerpt && <p className="mt-2 text-[11px] leading-5 text-white/36">{full.sourceExcerpt}</p>}</div></div>{full.evidence && full.evidence.length > 0 && <div className="mt-7 border-t border-white/[0.06] pt-6"><h2 className="brace-label">Evidence</h2>{full.evidence.map((evidence) => <div key={evidence.id} className="mt-3 rounded-xl border border-white/[0.06] p-4"><div className="text-[10px] uppercase text-white/25">{evidence.outcome}</div><p className="mt-1 text-xs text-white/55">{evidence.summary}</p><p className="mt-2 font-mono text-[9px] text-white/25">{evidence.reference}</p></div>)}</div>}</div>
        <div className="flex items-center justify-between border-t border-white/[0.07] p-5"><span className="text-[10px] text-white/25">Forgetting keeps only a non-sensitive audit tombstone.</span><button type="button" onClick={() => void forgetMemory(full.id)} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs text-rose-200/60 hover:bg-rose-400/[0.07] hover:text-rose-100"><Trash2 className="h-3.5 w-3.5" />Forget</button></div>
      </aside>
    </div>
  );
}
