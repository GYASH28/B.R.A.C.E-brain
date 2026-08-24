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
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  Menu,
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
  Sparkles,
  Tags,
  Trash2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useBrace, type BraceView } from "@/lib/brace/store";
import type {
  BraceMemory,
  BraceProject,
  BraceSkill,
  GraphNode,
  TimelineEvent,
} from "@/lib/brace/types";

const nav: Array<{ view: BraceView; label: string; icon: LucideIcon }> = [
  { view: "home", label: "Overview", icon: LayoutDashboard },
  { view: "search", label: "Recall", icon: Search },
  { view: "memories", label: "Memories", icon: Brain },
  { view: "timeline", label: "Timeline", icon: Clock3 },
  { view: "graph", label: "Graph", icon: Network },
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
  procedure: "border-orange-400/20 bg-orange-400/10 text-orange-200",
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

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView("search");
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>("#brace-global-search")?.focus());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setView]);

  if (loading || !snapshot) return <LoadingScreen />;

  const isEmpty = snapshot.environment === "desktop" &&
    snapshot.stats.projects === 0 && snapshot.stats.memories === 0;
  if (isEmpty) return <Onboarding />;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#080a0d] text-[#f4f1eb]">
      <aside
        className={`relative flex shrink-0 flex-col border-r border-white/[0.07] bg-[#0c0f13] transition-[width] duration-200 ${collapsed ? "w-[68px]" : "w-[228px]"}`}
      >
        <div className="flex h-[72px] items-center border-b border-white/[0.07] px-4">
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

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="BRACE navigation">
          {nav.map((item) => {
            const active = view === item.view;
            const Icon = item.icon;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => setView(item.view)}
                className={`group relative flex h-10 w-full items-center rounded-lg text-[13px] font-medium transition-colors ${
                  collapsed ? "justify-center" : "gap-3 px-3"
                } ${active ? "bg-white/[0.08] text-white" : "text-white/48 hover:bg-white/[0.04] hover:text-white/80"}`}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
              >
                {active && <span className="absolute left-0 h-4 w-[2px] rounded-full bg-[#ff7a45]" />}
                <Icon className={`h-[17px] w-[17px] shrink-0 ${active ? "text-[#ff9a72]" : "text-white/38 group-hover:text-white/65"}`} strokeWidth={1.8} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/[0.07] p-3">
          {!collapsed && (
            <div className="mb-2 rounded-lg border border-emerald-300/10 bg-emerald-300/[0.045] px-3 py-2.5">
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

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
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
        <main className="min-h-0 flex-1 overflow-y-auto">
          {view === "home" && <Overview />}
          {view === "search" && <SearchView />}
          {view === "memories" && <MemoriesView />}
          {view === "timeline" && <TimelineView />}
          {view === "graph" && <GraphView />}
          {view === "projects" && <ProjectsView />}
          {view === "skills" && <SkillsView />}
          {view === "connections" && <ConnectionsView />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>

      {selectedMemory && <MemoryDetail memory={selectedMemory} onClose={() => setSelectedMemory(null)} />}
      {operation && (
        <div className="fixed bottom-5 right-5 z-[80] flex items-center gap-3 rounded-xl border border-white/10 bg-[#171b20]/95 px-4 py-3 text-xs text-white/75 shadow-2xl backdrop-blur" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin text-[#ff8c5f]" />
          {operation}
        </div>
      )}
    </div>
  );
}

function BraceMark() {
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-[#ff9064]/25 bg-gradient-to-br from-[#ff8759] to-[#c94328] shadow-[0_8px_24px_rgba(249,93,50,0.16)]">
      <span className="text-sm font-black tracking-[-0.08em] text-[#160a06]">B</span>
      <span className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-[#fff1d6]" />
    </span>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-[#080a0d] text-white">
      <div className="text-center">
        <div className="mx-auto mb-5"><BraceMark /></div>
        <LoaderCircle className="mx-auto h-4 w-4 animate-spin text-[#ff7a45]" />
        <p className="mt-3 text-xs tracking-wide text-white/40">Opening your local memory</p>
      </div>
    </div>
  );
}

function Onboarding() {
  const { initializeDemo, addProject, operation, error, clearMessage } = useBrace();
  return (
    <div className="relative flex min-h-[100dvh] overflow-hidden bg-[#080a0d] text-[#f4f1eb]">
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at 72% 30%, rgba(255,122,69,.13), transparent 34%), radial-gradient(circle at 22% 75%, rgba(89,126,247,.09), transparent 38%)" }} />
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
                <Sparkles className="h-4 w-4 text-[#ff9a72]" /> Explore synthetic demo
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
            <div className="absolute -inset-8 rounded-full bg-[#ff6a3d]/5 blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.09] bg-[#101318]/90 p-3 shadow-[0_30px_100px_rgba(0,0,0,.55)]">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 pb-3 pt-1 text-[10px] text-white/30"><span className="h-2 w-2 rounded-full bg-[#ff7a45]" /><span className="h-2 w-2 rounded-full bg-[#ffd166]" /><span className="h-2 w-2 rounded-full bg-[#64d39b]" /><span className="ml-2">How BRACE works</span></div>
              <div className="space-y-2 p-3">
                <OnboardingStep number="01" icon={FolderInput} title="Connect work" text="Choose a specific project folder. Originals stay where they are." />
                <OnboardingStep number="02" icon={Database} title="Build local memory" text="BRACE indexes sources, decisions, evidence, and relationships into SQLite." />
                <OnboardingStep number="03" icon={GitBranch} title="Connect every AI" text="MCP clients retrieve the same provenance-backed context." />
              </div>
            </div>
          </section>
        </div>
      </div>
      {operation && <div className="fixed bottom-5 right-5 flex items-center gap-3 rounded-xl border border-white/10 bg-[#171b20] px-4 py-3 text-xs text-white/70"><LoaderCircle className="h-4 w-4 animate-spin text-[#ff7a45]" />{operation}</div>}
    </div>
  );
}

function OnboardingStep({ number, icon: Icon, title, text }: { number: string; icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="grid grid-cols-[42px_42px_1fr] items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <span className="font-mono text-[10px] text-white/25">{number}</span>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-[#ff9a72]"><Icon className="h-[18px] w-[18px]" /></span>
      <div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-white/40">{text}</p></div>
    </div>
  );
}

function Header() {
  const { setView, setSearchQuery, search, searchQuery, snapshot } = useBrace();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void search();
  };
  return (
    <header className="flex h-[72px] shrink-0 items-center gap-4 border-b border-white/[0.07] bg-[#0a0c10]/95 px-5" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
      <form onSubmit={submit} className="relative w-full max-w-xl" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          id="brace-global-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onFocus={() => setView("search")}
          placeholder="Recall a decision, source, or lesson…"
          className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] pl-10 pr-16 text-sm text-white outline-none placeholder:text-white/25 hover:border-white/[0.12] focus:border-[#ff8c5f]/45 focus:bg-white/[0.05]"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[9px] text-white/28">Ctrl K</kbd>
      </form>
      <div className="ml-auto flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button type="button" onClick={() => setView("memories")} className="brace-secondary h-10 px-3.5"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New memory</span></button>
        <div className="hidden items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-white/38 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          {snapshot?.stats.memories ?? 0} memories
        </div>
      </div>
    </header>
  );
}

function Page({ eyebrow, title, description, actions, children }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1420px] px-5 py-7 lg:px-8 lg:py-9">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          {eyebrow && <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff956c]">{eyebrow}</div>}
          <h1 className="text-3xl font-medium tracking-[-0.035em] text-[#faf7f1]">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/42">{description}</p>
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
    ["Durable memories", snapshot.stats.memories, Brain, "text-[#ff9a72]"],
    ["Indexed sources", snapshot.stats.sources, FileText, "text-sky-300"],
    ["Recorded decisions", snapshot.stats.decisions, GitBranch, "text-violet-300"],
    ["Graph relations", snapshot.stats.relations, Network, "text-emerald-300"],
  ] as const;
  return (
    <Page eyebrow="Private memory layer" title="Your context, ready when AI needs it." description="A calm operational view of what BRACE knows, where it came from, and what changed.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, Icon, color]) => (
          <div key={label} className="brace-card p-5">
            <div className="flex items-start justify-between"><span className="text-xs text-white/38">{label}</span><Icon className={`h-4 w-4 ${color}`} /></div>
            <div className="mt-5 text-3xl font-medium tracking-[-0.04em]">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <section className="brace-card overflow-hidden">
          <SectionHeading title="High-signal memory" action="View all" onAction={() => setView("memories")} />
          <div className="divide-y divide-white/[0.055]">
            {snapshot.memories.slice(0, 5).map((memory) => (
              <MemoryRow key={memory.id} memory={memory} onClick={() => setSelectedMemory(memory)} />
            ))}
            {snapshot.memories.length === 0 && <EmptyRows text="No durable memories yet." />}
          </div>
        </section>
        <section className="brace-card overflow-hidden">
          <SectionHeading title="Recent activity" action="Timeline" onAction={() => setView("timeline")} />
          <div className="px-5 pb-5">
            {snapshot.timeline.slice(0, 5).map((event, index) => (
              <TimelineMini key={event.id} event={event} last={index === Math.min(4, snapshot.timeline.length - 1)} />
            ))}
            {snapshot.timeline.length === 0 && <EmptyRows text="New memories and decisions will appear here." />}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <button type="button" onClick={() => setView("connections")} className="brace-card group flex items-center gap-4 p-5 text-left hover:border-[#ff8c5f]/20">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ff7a45]/10 text-[#ff9a72]"><Code2 className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Connect an AI client</span><span className="mt-1 block text-xs text-white/38">Use MCP to give supported tools the same local context.</span></span>
          <ChevronRight className="h-4 w-4 text-white/20 transition-transform group-hover:translate-x-0.5 group-hover:text-white/50" />
        </button>
        <div className="brace-card flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-5 w-5" /></span>
          <span><span className="block text-sm font-semibold">Private by architecture</span><span className="mt-1 block text-xs text-white/38">Database and indexed text stay in your application-data directory.</span></span>
        </div>
      </div>
    </Page>
  );
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.055] px-5 py-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action && <button type="button" onClick={onAction} className="text-[11px] font-medium text-[#ff9a72] hover:text-[#ffb294]">{action} <span aria-hidden>→</span></button>}
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
        <span className={`relative mt-1 h-2 w-2 rounded-full ${event.eventType.startsWith("decision") ? "bg-violet-300" : "bg-[#ff8c5f]"}`} />
      </div>
      <div className="min-w-0 pb-1"><div className="truncate text-xs font-medium text-white/74">{event.title}</div><div className="mt-1 text-[10px] text-white/28">{formatDate(event.occurredAt)}</div></div>
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
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="What did we decide about imported project files?" className="h-14 w-full rounded-2xl border border-white/[0.1] bg-white/[0.04] pl-14 pr-28 text-[15px] outline-none placeholder:text-white/23 focus:border-[#ff8c5f]/45" autoFocus />
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
  const { snapshot, setSelectedMemory } = useBrace();
  const [composerOpen, setComposerOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  if (!snapshot) return null;
  const memories = filter === "all" ? snapshot.memories : snapshot.memories.filter((memory) => memory.kind === filter);
  return (
    <Page eyebrow="Durable context" title="Memory" description="Concise facts, lessons, procedures, warnings, and preferences—kept separate from raw source material." actions={<button type="button" onClick={() => setComposerOpen((value) => !value)} className="brace-primary h-10 px-4"><Plus className="h-4 w-4" />Remember</button>}>
      {composerOpen && <MemoryComposer onClose={() => setComposerOpen(false)} />}
      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "project", "decision", "lesson", "warning", "preference", "fact", "procedure"].map((kind) => (
          <button key={kind} type="button" onClick={() => setFilter(kind)} className={`rounded-lg border px-3 py-1.5 text-[10px] font-medium capitalize ${filter === kind ? "border-[#ff8c5f]/35 bg-[#ff7a45]/10 text-[#ffb090]" : "border-white/[0.07] text-white/35 hover:text-white/65"}`}>{kind}</button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {memories.map((memory) => (
          <button key={memory.id} type="button" onClick={() => setSelectedMemory(memory)} className="brace-card group flex min-h-48 flex-col p-5 text-left hover:border-white/[0.13]">
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
      <div className="brace-card mx-auto max-w-4xl overflow-hidden px-5 py-3 sm:px-8">
        {snapshot.timeline.map((event, index) => (
          <article key={event.id} className="relative grid grid-cols-[28px_1fr] gap-4 py-5">
            {index !== snapshot.timeline.length - 1 && <span className="absolute bottom-[-20px] left-[13px] top-8 w-px bg-white/[0.07]" />}
            <span className={`relative mt-1.5 h-3 w-3 rounded-full border-[3px] border-[#14181d] ${event.eventType.startsWith("decision") ? "bg-violet-300 shadow-[0_0_0_3px_rgba(196,181,253,.1)]" : "bg-[#ff8c5f] shadow-[0_0_0_3px_rgba(255,140,95,.1)]"}`} />
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
  if (!snapshot) return null;
  const nodes = type === "all" ? snapshot.graph.nodes : snapshot.graph.nodes.filter((node) => node.type === type);
  return (
    <Page eyebrow="Relationships" title="Knowledge graph" description="Projects anchor the graph. Sources, explicit decisions, memories, and extracted entities stay visibly distinct.">
      <div className="mb-4 flex flex-wrap gap-2">{["all", "project", "source", "memory", "decision", "entity"].map((item) => <button key={item} type="button" onClick={() => setType(item)} className={`rounded-lg border px-3 py-1.5 text-[10px] capitalize ${type === item ? "border-[#ff8c5f]/35 bg-[#ff7a45]/10 text-[#ffb090]" : "border-white/[0.07] text-white/35"}`}>{item}</button>)}</div>
      <div className="brace-card relative min-h-[560px] overflow-hidden bg-[radial-gradient(circle_at_center,rgba(255,255,255,.035)_0,transparent_52%)]">
        <GraphCanvas nodes={nodes} edges={snapshot.graph.edges} />
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-3 rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2 text-[9px] text-white/30 backdrop-blur">{[["#ff8c5f", "Project"], ["#7dd3fc", "Source"], ["#c4b5fd", "Decision"], ["#6ee7b7", "Memory"], ["#cbd5e1", "Entity"]].map(([color, label]) => <span key={label} className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}</span>)}</div>
      </div>
    </Page>
  );
}

function GraphCanvas({ nodes, edges }: { nodes: GraphNode[]; edges: Array<{ id: string; from: string; to: string; relation: string }> }) {
  const positions = useMemo(() => {
    const center = { x: 450, y: 280 };
    const map = new Map<string, { x: number; y: number }>();
    const ordered = [...nodes].sort((a, b) => (a.type === "project" ? -1 : b.type === "project" ? 1 : a.id.localeCompare(b.id)));
    ordered.forEach((node, index) => {
      if (index === 0 && node.type === "project") map.set(node.id, center);
      else {
        const ringIndex = index - (ordered[0]?.type === "project" ? 1 : 0);
        const count = Math.max(1, ordered.length - (ordered[0]?.type === "project" ? 1 : 0));
        const angle = (ringIndex / count) * Math.PI * 2 - Math.PI / 2;
        const radius = 190 + (ringIndex % 3) * 28;
        map.set(node.id, { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
      }
    });
    return map;
  }, [nodes]);
  const color = (type: string) => ({ project: "#ff8c5f", source: "#7dd3fc", decision: "#c4b5fd", memory: "#6ee7b7", entity: "#cbd5e1" }[type] || "#fff");
  const filteredEdges = edges.filter((edge) => positions.has(edge.from) && positions.has(edge.to));
  return (
    <svg viewBox="0 0 900 560" className="h-full min-h-[560px] w-full" role="img" aria-label={`${nodes.length} knowledge nodes and ${filteredEdges.length} relationships`}>
      <defs><filter id="node-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {filteredEdges.map((edge) => { const from = positions.get(edge.from)!; const to = positions.get(edge.to)!; return <g key={edge.id}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(255,255,255,.1)" strokeWidth="1" /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5} fill="rgba(255,255,255,.22)" fontSize="8" textAnchor="middle">{edge.relation}</text></g>; })}
      {nodes.map((node) => { const position = positions.get(node.id)!; const radius = node.type === "project" ? 17 : node.type === "memory" ? 11 : 9; return <g key={node.id} transform={`translate(${position.x} ${position.y})`}><circle r={radius + 7} fill={color(node.type)} opacity=".06" /><circle r={radius} fill="#10151a" stroke={color(node.type)} strokeWidth="2" filter="url(#node-glow)" /><text y={radius + 18} fill="rgba(255,255,255,.72)" fontSize="10" fontWeight="500" textAnchor="middle">{node.label.length > 25 ? `${node.label.slice(0, 24)}…` : node.label}</text><text y={radius + 30} fill="rgba(255,255,255,.25)" fontSize="7" textAnchor="middle">{node.type}</text></g>; })}
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
    <article className="brace-card p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300"><Box className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="truncate text-[15px] font-semibold">{project.name}</h2><p className="mt-1 truncate text-[10px] text-white/25" title={project.root_path}>{project.root_path}</p></div><button type="button" onClick={onReindex} className="brace-secondary h-9 px-3" aria-label={`Reindex ${project.name}`}><RefreshCw className="h-3.5 w-3.5" />Reindex</button></div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.055] pt-4 text-[10px]"><div><span className="block text-white/25">Last indexed</span><span className="mt-1 block text-white/55">{formatDate(project.last_indexed_at)}</span></div><div><span className="block text-white/25">Ownership</span><span className="mt-1 block text-emerald-200/65">Originals unchanged</span></div></div></article>
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
    <article className="brace-card p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200"><Zap className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold">{skill.displayName}</h2><span className="font-mono text-[9px] text-white/20">v{skill.version}</span></div><p className="mt-1.5 text-xs leading-5 text-white/38">{skill.description}</p></div><button type="button" role="switch" aria-checked={skill.enabled} onClick={() => onToggle(!skill.enabled)} className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${skill.enabled ? "border-emerald-300/25 bg-emerald-300/25" : "border-white/10 bg-white/5"}`}><span className={`absolute top-[3px] h-4 w-4 rounded-full transition-transform ${skill.enabled ? "translate-x-[21px] bg-emerald-200" : "translate-x-[3px] bg-white/35"}`} /></button></div><div className="mt-5 border-t border-white/[0.055] pt-4"><div className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-white/25">Permissions</div><div className="flex flex-wrap gap-1.5">{skill.permissions.map((permission) => <span key={permission} className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 font-mono text-[9px] text-white/38">{permission}</span>)}</div></div></article>
  );
}

function SafetyFact({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="rounded-xl border border-white/[0.06] p-4"><Icon className="h-4 w-4 text-white/35" /><h3 className="mt-3 text-xs font-semibold">{title}</h3><p className="mt-1 text-[11px] leading-5 text-white/32">{text}</p></div>;
}

function ConnectionsView() {
  const { snapshot } = useBrace();
  const config = JSON.stringify({
    mcpServers: {
      brace: {
        command: snapshot?.connections?.command || "<path-to-BRACE-executable>",
        args: snapshot?.connections?.args || ["--mcp"],
      },
    },
  }, null, 2);
  return (
    <Page eyebrow="One memory. Every AI." title="Connections" description="Expose the same local, provenance-backed memory to MCP-compatible clients. Read access is the default; writes require an explicit environment flag.">
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="brace-card overflow-hidden"><SectionHeading title="MCP stdio configuration" /><div className="p-5"><div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] p-4"><CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /><div><h2 className="text-xs font-semibold text-emerald-100/85">Read-only by default</h2><p className="mt-1 text-[11px] leading-5 text-white/36">Search, inspect memories, browse projects, timeline, graph, and skill metadata. Set <code className="brace-code">BRACE_MCP_WRITE=1</code> only for clients you trust.</p></div></div><pre className="overflow-x-auto rounded-xl border border-white/[0.07] bg-black/30 p-4 font-mono text-[10px] leading-5 text-white/55"><code>{config}</code></pre></div></section>
        <section className="space-y-3"><ConnectionCard icon={Code2} name="Codex & IDE clients" status="MCP v2" text="Connect over local stdio using the configuration shown." /><ConnectionCard icon={Sparkles} name="Other AI tools" status="Provider-independent" text="Any compatible MCP client can use the same read tools and provenance." /><ConnectionCard icon={HardDrive} name="Local Ollama" status={snapshot?.semantic.enabled ? "Enabled" : "Optional"} text="Adds semantic ranking without sending project text off-device." /></section>
      </div>
      <div className="mt-5 rounded-xl border border-amber-300/10 bg-amber-300/[0.035] p-4 text-xs leading-5 text-amber-100/55"><KeyRound className="mr-2 inline h-4 w-4" />Destructive MCP tools remain unavailable unless both write and destructive flags are explicitly enabled for that process.</div>
    </Page>
  );
}

function ConnectionCard({ icon: Icon, name, status, text }: { icon: LucideIcon; name: string; status: string; text: string }) {
  return <div className="brace-card flex gap-4 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.045] text-white/55"><Icon className="h-[18px] w-[18px]" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">{name}</h2><span className="rounded-full border border-white/[0.07] px-2 py-0.5 text-[9px] text-white/28">{status}</span></div><p className="mt-1.5 text-xs leading-5 text-white/35">{text}</p></div></div>;
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
          <section className="brace-card overflow-hidden"><SectionHeading title="Storage" /><div className="space-y-4 p-5"><SettingRow icon={Database} title="Application data" text={snapshot.storage?.directory || "System application-data directory"} /><SettingRow icon={HardDrive} title="SQLite database" text={snapshot.storage?.database || "brace.sqlite3"} /><p className="text-[10px] leading-5 text-white/28">The public source repository never contains this directory. Imported project originals stay outside it and are never modified.</p></div></section>
          <section className="brace-card overflow-hidden"><SectionHeading title="Backup & portability" /><div className="grid gap-3 p-5 sm:grid-cols-2"><button type="button" onClick={() => void backupData()} className="brace-secondary h-11 px-4"><Archive className="h-4 w-4" />Create SQLite backup</button><button type="button" onClick={() => void exportData()} className="brace-secondary h-11 px-4"><Download className="h-4 w-4" />Export portable JSON</button></div></section>
        </div>
        <div className="space-y-5">
          <section className="brace-card overflow-hidden"><SectionHeading title="Optional semantic retrieval" /><form onSubmit={(event) => { event.preventDefault(); void configureEmbeddings({ enabled, endpoint, model }); }} className="space-y-4 p-5"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#ff7a45]" /><span><span className="block text-xs font-semibold">Enable local Ollama embeddings</span><span className="mt-1 block text-[11px] leading-5 text-white/32">BRACE sends indexed chunks only to the loopback endpoint below.</span></span></label><div><label className="brace-label" htmlFor="embedding-endpoint">Loopback endpoint</label><input id="embedding-endpoint" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} className="brace-input mt-2" /></div><div><label className="brace-label" htmlFor="embedding-model">Embedding model</label><input id="embedding-model" value={model} onChange={(event) => setModel(event.target.value)} className="brace-input mt-2" /></div><button type="submit" className="brace-primary h-10 px-4">Save retrieval settings</button></form></section>
          <section className="overflow-hidden rounded-2xl border border-rose-400/15 bg-rose-400/[0.035]"><div className="border-b border-rose-400/10 px-5 py-4"><h2 className="text-sm font-semibold text-rose-100">Delete local data</h2></div><div className="p-5"><p className="text-xs leading-5 text-white/38">Removes BRACE memories, indexes, skills, settings, and the demo copy. Imported project files remain untouched.</p><div className="mt-4 flex gap-2"><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type DELETE" className="brace-input" aria-label="Type DELETE to confirm" /><button type="button" disabled={confirmation !== "DELETE"} onClick={() => void deleteAll(confirmation)} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 text-xs font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" />Delete all</button></div></div></section>
        </div>
      </div>
    </Page>
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
      <aside className="flex h-full w-full max-w-[520px] flex-col border-l border-white/[0.08] bg-[#101318] shadow-2xl">
        <div className="flex h-[72px] items-center justify-between border-b border-white/[0.07] px-5"><span className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${kindTone[full.kind]}`}>{full.kind}</span><button type="button" onClick={onClose} className="rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-white" aria-label="Close memory"><X className="h-4 w-4" /></button></div>
        <div className="flex-1 overflow-y-auto p-6"><h1 id="memory-detail-title" className="text-2xl font-medium leading-tight tracking-[-0.03em]">{full.title}</h1><p className="mt-3 text-sm leading-6 text-white/48">{full.summary}</p><div className="mt-7 border-t border-white/[0.06] pt-6"><h2 className="brace-label">Durable content</h2><p className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-white/66">{full.content}</p></div><dl className="mt-7 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-6 text-[10px]"><div><dt className="text-white/25">Scope</dt><dd className="mt-1 truncate text-white/52">{full.scope}</dd></div><div><dt className="text-white/25">Confidence</dt><dd className="mt-1 text-white/52">{Math.round(full.confidence * 100)}%</dd></div><div><dt className="text-white/25">Updated</dt><dd className="mt-1 text-white/52">{formatDate(full.updatedAt)}</dd></div><div><dt className="text-white/25">Embedding</dt><dd className="mt-1 text-white/52">{full.embeddingModel || "Lexical only"}</dd></div></dl><div className="mt-7 border-t border-white/[0.06] pt-6"><h2 className="brace-label">Provenance</h2><div className="mt-3 rounded-xl border border-sky-300/10 bg-sky-300/[0.035] p-4"><div className="flex items-center gap-2 text-xs text-sky-100/70"><FileText className="h-4 w-4" />{shortUri(full.sourceUri)}</div>{full.sourceExcerpt && <p className="mt-2 text-[11px] leading-5 text-white/36">{full.sourceExcerpt}</p>}</div></div>{full.evidence && full.evidence.length > 0 && <div className="mt-7 border-t border-white/[0.06] pt-6"><h2 className="brace-label">Evidence</h2>{full.evidence.map((evidence) => <div key={evidence.id} className="mt-3 rounded-xl border border-white/[0.06] p-4"><div className="text-[10px] uppercase text-white/25">{evidence.outcome}</div><p className="mt-1 text-xs text-white/55">{evidence.summary}</p><p className="mt-2 font-mono text-[9px] text-white/25">{evidence.reference}</p></div>)}</div>}</div>
        <div className="flex items-center justify-between border-t border-white/[0.07] p-5"><span className="text-[10px] text-white/25">Forgetting keeps only a non-sensitive audit tombstone.</span><button type="button" onClick={() => void forgetMemory(full.id)} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs text-rose-200/60 hover:bg-rose-400/[0.07] hover:text-rose-100"><Trash2 className="h-3.5 w-3.5" />Forget</button></div>
      </aside>
    </div>
  );
}
