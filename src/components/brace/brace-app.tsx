"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArrowRight,
  BookOpen,
  Box,
  Brain,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
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
  Maximize2,
  Minus,
  Network,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Trash2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useBrace, type BraceView } from "@/lib/brace/store";
import type {
  BraceConnector,
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
  const { setView, setSearchQuery, search, searchQuery, snapshot } = useBrace();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void search();
  };
  return (
    <header className="brace-header flex h-[76px] shrink-0 items-center gap-4 px-5" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
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
        <button type="button" onClick={onQuickCapture} className="brace-secondary h-10 px-3.5" aria-keyshortcuts="Control+N Meta+N"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Quick capture</span></button>
        <div className="hidden items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-white/38 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          {snapshot?.stats.memories ?? 0} memories
        </div>
      </div>
    </header>
  );
}

function CommandPalette({ onClose, onQuickCapture, onShortcuts }: { onClose: () => void; onQuickCapture: () => void; onShortcuts: () => void }) {
  const { setView } = useBrace();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const commands = useMemo(() => [
    ...nav.map((item, index) => ({
      id: item.view,
      label: item.label,
      detail: `Open ${item.label.toLowerCase()}`,
      icon: item.icon,
      key: String(index + 1),
      run: () => { setView(item.view); onClose(); },
    })),
    { id: "capture", label: "Capture a memory", detail: "Save durable context from anywhere", icon: Plus, key: "Ctrl N", run: onQuickCapture },
    { id: "shortcuts", label: "Keyboard map", detail: "See every shortcut", icon: Keyboard, key: "?", run: onShortcuts },
  ], [onClose, onQuickCapture, onShortcuts, setView]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? commands.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(needle)) : commands;
  }, [commands, query]);

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
              if (event.key === "Enter" && filtered[active]) { event.preventDefault(); filtered[active].run(); }
            }}
            placeholder="Go somewhere or start an action…"
            aria-label="Search commands"
          />
          <kbd>ESC</kbd>
        </div>
        <div className="command-palette-list" role="listbox" aria-label="Available commands">
          {filtered.map((item, index) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" role="option" aria-selected={index === active} className={index === active ? "is-active" : ""} onMouseEnter={() => setActive(index)} onClick={item.run}><span><Icon className="h-4 w-4" /></span><span><strong>{item.label}</strong><small>{item.detail}</small></span><kbd>{item.key}</kbd></button>;
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
    <div className="brace-dialog-backdrop brace-dialog-backdrop--side" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="quick-capture-sheet" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="quick-capture-title">
        <header><div><span>LOCAL QUICK CAPTURE</span><h1 id="quick-capture-title">Keep the part that matters.</h1></div><button type="button" onClick={onClose} aria-label="Close quick capture"><X className="h-4 w-4" /></button></header>
        <p>Save one durable claim. BRACE keeps it separate from source evidence and available to connected AI clients.</p>
        <div className="quick-capture-fields">
          <label htmlFor="quick-title">Memory title</label>
          <input id="quick-title" autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A specific point future-you can recognize" />
          <label htmlFor="quick-content">What should BRACE remember?</label>
          <textarea id="quick-content" required value={content} onChange={(event) => setContent(event.target.value)} placeholder="Keep it concise. Do not store credentials or raw private transcripts." />
          <div className="quick-capture-meta">
            <label>Type<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="fact">Fact</option><option value="project">Project context</option><option value="decision">Decision</option><option value="lesson">Lesson</option><option value="warning">Warning</option><option value="preference">Preference</option><option value="procedure">Procedure</option></select></label>
            <label>Scope<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="global">Global</option>{snapshot?.projects.map((project) => <option key={project.id} value={`project:${project.id}`}>{project.name}</option>)}</select></label>
          </div>
        </div>
        <footer><span><ShieldCheck className="h-4 w-4" /> Stored in your local database</span><div><button type="button" onClick={onClose} className="brace-secondary">Cancel</button><button type="submit" className="brace-primary">Save memory <CornerDownLeft className="h-3.5 w-3.5" /></button></div></footer>
      </form>
    </div>
  );
}

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    ["Ctrl / ⌘ K", "Open command palette"],
    ["Ctrl / ⌘ N", "Quick capture"],
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
  const featured = snapshot.memories[0];
  return (
    <Page eyebrow="Private memory layer" title="Your context, ready when AI needs it." description="See what BRACE knows, where it came from, and what changed—without sending your working memory elsewhere.">
      <section className="brace-hero-grid">
        <button type="button" onClick={() => featured && setSelectedMemory(featured)} className="brace-memory-signal group text-left" disabled={!featured}>
          <div className="memory-signal-orbit" aria-hidden="true"><span /><span /><span /></div>
          <div className="relative z-10 max-w-xl">
            <span className="signal-status"><i /> MEMORY ONLINE</span>
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
          <SectionHeading title="High-signal memory" action="Open memory" onAction={() => setView("memories")} />
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
      <ChevronRight className="mt-3 h-4 w-4 text-white/12 group-hover:text-white/40" />
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
  const submit = (event: FormEvent) => { event.preventDefault(); void search(); };
  return (
    <Page eyebrow="Retrieval" title="Recall with provenance." description="Search durable memory and source chunks separately. BRACE never presents generated context as a source file.">
      <form onSubmit={submit} className="relative max-w-4xl">
        <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="What did we decide about imported project files?" className="h-14 w-full rounded-2xl border border-white/[0.1] bg-white/[0.04] pl-14 pr-28 text-[15px] outline-none placeholder:text-white/23 focus:border-[#7dd3fc]/45" autoFocus />
        <button type="submit" className="brace-primary absolute right-2 top-2 h-10 px-4">Recall</button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-white/30">
        <span className="rounded-full border border-white/[0.08] px-2.5 py-1">{snapshot?.semantic.enabled ? "Hybrid retrieval ready" : "Lexical retrieval"}</span>
        <span>Optional semantic ranking runs only when you enable a local embedding model.</span>
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
        <div className="mt-14 max-w-2xl rounded-2xl border border-dashed border-white/[0.09] p-9 text-center"><BookOpen className="mx-auto h-6 w-6 text-white/20" /><p className="mt-3 text-sm text-white/38">Try a question, exact term, tag, or decision title.</p></div>
      )}
    </Page>
  );
}

function MemoriesView() {
  const { snapshot, setSelectedMemory, setView } = useBrace();
  const [composerOpen, setComposerOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  if (!snapshot) return null;
  const memories = filter === "all" ? snapshot.memories : snapshot.memories.filter((memory) => memory.kind === filter);
  return (
    <Page eyebrow="Durable context" title="Memory" description="Concise facts, lessons, procedures, warnings, and preferences—kept separate from raw source material." actions={<><button type="button" aria-label="Open memory review queue" onClick={() => setView("review")} className="brace-secondary h-10 px-4"><Archive className="h-4 w-4" />Review queue{snapshot.memoryQuality.pendingReview > 0 && <span className="rounded-full bg-sky-300/15 px-1.5 py-0.5 text-[9px] text-sky-100">{snapshot.memoryQuality.pendingReview}</span>}</button><button type="button" onClick={() => setComposerOpen((value) => !value)} className="brace-primary h-10 px-4"><Plus className="h-4 w-4" />Remember</button></>}>
      {composerOpen && <MemoryComposer onClose={() => setComposerOpen(false)} />}
      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "project", "decision", "lesson", "warning", "preference", "fact", "procedure"].map((kind) => (
          <button key={kind} type="button" onClick={() => setFilter(kind)} className={`rounded-lg border px-3 py-1.5 text-[10px] font-medium capitalize ${filter === kind ? "border-[#7dd3fc]/35 bg-[#38bdf8]/10 text-[#bae6fd]" : "border-white/[0.07] text-white/35 hover:text-white/65"}`}>{kind}</button>
        ))}
      </div>
      <div className="brace-memory-grid grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {memories.map((memory) => (
          <button key={memory.id} type="button" onClick={() => setSelectedMemory(memory)} className="brace-card brace-memory-card group flex min-h-48 flex-col p-5 text-left hover:border-white/[0.13]">
            <div className="flex items-start justify-between gap-3"><span className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${kindTone[memory.kind]}`}>{memory.kind}</span><span className="text-[10px] text-white/22">{Math.round(memory.confidence * 100)}% confidence</span></div>
            <h2 className="mt-4 text-[15px] font-semibold leading-5 text-white/90">{memory.title}</h2>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/38">{memory.summary}</p>
            <div className="mt-auto flex items-end justify-between gap-3 pt-5"><div className="min-w-0"><div className="flex flex-wrap gap-1">{memory.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-white/[0.045] px-1.5 py-0.5 text-[9px] text-white/32">#{tag}</span>)}</div><div className="mt-2 truncate text-[9px] text-white/22">{shortUri(memory.sourceUri)}</div></div><ChevronRight className="h-4 w-4 shrink-0 text-white/12 group-hover:text-white/45" /></div>
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
  if (!snapshot) return null;
  return (
    <Page eyebrow="Change over time" title="Timeline & decisions" description="An auditable history of explicit decisions, memory changes, evidence, and indexing events." actions={<button type="button" onClick={() => setFormOpen((value) => !value)} className="brace-primary h-10 px-4"><GitBranch className="h-4 w-4" />Record decision</button>}>
      {formOpen && <DecisionComposer onClose={() => setFormOpen(false)} />}
      <div className="brace-card brace-timeline-card mx-auto max-w-4xl overflow-hidden px-5 py-3 sm:px-8">
        {snapshot.timeline.map((event, index) => (
          <article key={event.id} className="relative grid grid-cols-[28px_1fr] gap-4 py-5">
            {index !== snapshot.timeline.length - 1 && <span className="absolute bottom-[-20px] left-[13px] top-8 w-px bg-white/[0.07]" />}
            <span className={`relative mt-1.5 h-3 w-3 rounded-full border-[3px] border-[#101927] ${event.eventType.startsWith("decision") ? "bg-violet-300 shadow-[0_0_0_3px_rgba(196,181,253,.1)]" : "bg-[#7dd3fc] shadow-[0_0_0_3px_rgba(125,211,252,.1)]"}`} />
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-white/28">{event.eventType.replaceAll(".", " · ")}</span><span className="text-[10px] text-white/20">{formatDate(event.occurredAt)}</span></div><h2 className="mt-2 text-[15px] font-semibold text-white/88">{event.title}</h2><p className="mt-1.5 max-w-2xl text-xs leading-5 text-white/40">{event.summary}</p></div>
          </article>
        ))}
        {!snapshot.timeline.length && <EmptyRows text="The timeline is empty." />}
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
  const { forgetMemory } = useBrace();
  const [full, setFull] = useState<BraceMemory>(memory);
  useEffect(() => {
    const api = window.electron;
    if (api?.getBraceMemory) void api.getBraceMemory(memory.id).then((value) => value && setFull(value));
  }, [memory.id]);
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/45 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="memory-detail-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="brace-detail-panel flex h-full w-full max-w-[520px] flex-col border-l border-white/[0.08] bg-[#101318] shadow-2xl">
        <div className="flex h-[72px] items-center justify-between border-b border-white/[0.07] px-5"><span className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${kindTone[full.kind]}`}>{full.kind}</span><button type="button" onClick={onClose} className="rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-white" aria-label="Close memory"><X className="h-4 w-4" /></button></div>
        <div className="flex-1 overflow-y-auto p-6"><h1 id="memory-detail-title" className="text-2xl font-medium leading-tight tracking-[-0.03em]">{full.title}</h1><p className="mt-3 text-sm leading-6 text-white/48">{full.summary}</p><div className="mt-7 border-t border-white/[0.06] pt-6"><h2 className="brace-label">Durable content</h2><p className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-white/66">{full.content}</p></div><dl className="mt-7 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-6 text-[10px]"><div><dt className="text-white/25">Scope</dt><dd className="mt-1 truncate text-white/52">{full.scope}</dd></div><div><dt className="text-white/25">Confidence</dt><dd className="mt-1 text-white/52">{Math.round(full.confidence * 100)}%</dd></div><div><dt className="text-white/25">Updated</dt><dd className="mt-1 text-white/52">{formatDate(full.updatedAt)}</dd></div><div><dt className="text-white/25">Embedding</dt><dd className="mt-1 text-white/52">{full.embeddingModel || "Lexical only"}</dd></div></dl><div className="mt-7 border-t border-white/[0.06] pt-6"><h2 className="brace-label">Provenance</h2><div className="mt-3 rounded-xl border border-sky-300/10 bg-sky-300/[0.035] p-4"><div className="flex items-center gap-2 text-xs text-sky-100/70"><FileText className="h-4 w-4" />{shortUri(full.sourceUri)}</div>{full.sourceExcerpt && <p className="mt-2 text-[11px] leading-5 text-white/36">{full.sourceExcerpt}</p>}</div></div>{full.evidence && full.evidence.length > 0 && <div className="mt-7 border-t border-white/[0.06] pt-6"><h2 className="brace-label">Evidence</h2>{full.evidence.map((evidence) => <div key={evidence.id} className="mt-3 rounded-xl border border-white/[0.06] p-4"><div className="text-[10px] uppercase text-white/25">{evidence.outcome}</div><p className="mt-1 text-xs text-white/55">{evidence.summary}</p><p className="mt-2 font-mono text-[9px] text-white/25">{evidence.reference}</p></div>)}</div>}</div>
        <div className="flex items-center justify-between border-t border-white/[0.07] p-5"><span className="text-[10px] text-white/25">Forgetting keeps only a non-sensitive audit tombstone.</span><button type="button" onClick={() => void forgetMemory(full.id)} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs text-rose-200/60 hover:bg-rose-400/[0.07] hover:text-rose-100"><Trash2 className="h-3.5 w-3.5" />Forget</button></div>
      </aside>
    </div>
  );
}
