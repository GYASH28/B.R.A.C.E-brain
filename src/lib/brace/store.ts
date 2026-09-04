"use client";

import { create } from "zustand";
import { browserPreviewSnapshot, searchBrowserPreview } from "./browser-preview";
import type {
  BraceConnector,
  BraceAutomation,
  BraceMemory,
  BraceSnapshot,
  ConnectorAccess,
  ConnectorId,
  ProjectIndexProgress,
  SearchResponse,
} from "./types";

export type BraceView =
  | "home"
  | "inbox"
  | "assistant"
  | "search"
  | "memories"
  | "review"
  | "timeline"
  | "graph"
  | "projects"
  | "skills"
  | "automations"
  | "connections"
  | "settings";

interface BraceState {
  view: BraceView;
  viewHistory: BraceView[];
  viewHistoryIndex: number;
  snapshot: BraceSnapshot | null;
  connectors: BraceConnector[];
  selectedMemory: BraceMemory | null;
  assistantDraft: string;
  searchQuery: string;
  searchResult: SearchResponse | null;
  loading: boolean;
  operation: string | null;
  error: string | null;
  notice: string | null;
  indexTask: ProjectIndexProgress | null;
  setView: (view: BraceView) => void;
  navigateHistory: (direction: -1 | 1) => void;
  setSearchQuery: (query: string) => void;
  setSelectedMemory: (memory: BraceMemory | null) => void;
  setAssistantDraft: (draft: string) => void;
  clearMessage: () => void;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshConnectors: () => Promise<void>;
  installConnector: (id: ConnectorId, access: ConnectorAccess) => Promise<void>;
  runAssistant: (client: "codex" | "claude", prompt: string) => Promise<void>;
  clearAssistantHistory: () => Promise<void>;
  initializeDemo: () => Promise<void>;
  search: (query?: string, options?: { since?: string | null }) => Promise<void>;
  createMemory: (input: Record<string, unknown>) => Promise<void>;
  toggleMemoryPin: (id: string, pinned: boolean) => Promise<BraceMemory | null>;
  resolveMemoryReview: (input: {
    leftId: string;
    rightId: string;
    outcome: "distinct" | "keep-left" | "keep-right";
  }) => Promise<void>;
  forgetMemory: (id: string) => Promise<void>;
  createDecision: (input: Record<string, unknown>) => Promise<void>;
  addProject: () => Promise<void>;
  reindexProject: (id: string) => Promise<void>;
  cancelIndexing: () => Promise<void>;
  toggleSkill: (name: string, enabled: boolean) => Promise<void>;
  installSkill: () => Promise<void>;
  configureEmbeddings: (input: Record<string, unknown>) => Promise<void>;
  exportData: () => Promise<void>;
  backupData: () => Promise<void>;
  deleteAll: (confirmation: string) => Promise<void>;
  saveAutomation: (input: Record<string, unknown>, id?: string) => Promise<BraceAutomation | null>;
  toggleAutomation: (id: string, enabled: boolean) => Promise<void>;
  runAutomation: (id: string, dryRun?: boolean) => Promise<void>;
  retryAutomation: (runId: string, dryRun?: boolean) => Promise<void>;
  deleteAutomation: (id: string) => Promise<void>;
  pauseAutomations: (paused: boolean) => Promise<void>;
}

function desktop() {
  return typeof window !== "undefined" ? window.electron : undefined;
}

let detachIndexProgress: (() => void) | null = null;

function message(error: unknown) {
  return error instanceof Error ? error.message : "BRACE could not complete that operation.";
}

export const useBrace = create<BraceState>((set, get) => {
  const perform = async (label: string, task: () => Promise<void>) => {
    set({ operation: label, error: null, notice: null });
    try {
      await task();
    } catch (error) {
      const detail = message(error);
      if (/cancelled/i.test(detail)) set({ notice: detail, error: null });
      else set({ error: detail });
    } finally {
      set({ operation: null });
    }
  };

  const refresh = async () => {
    const api = desktop();
    const [snapshot, connectors] = await Promise.all([
      api?.getBraceSnapshot
        ? api.getBraceSnapshot()
        : Promise.resolve(structuredClone(browserPreviewSnapshot)),
      api?.listBraceConnectors
        ? api.listBraceConnectors()
        : Promise.resolve([]),
    ]);
    set({ snapshot, connectors, loading: false });
  };

  return {
    view: "home",
    viewHistory: ["home"],
    viewHistoryIndex: 0,
    snapshot: null,
    connectors: [],
    selectedMemory: null,
    assistantDraft: "",
    searchQuery: "",
    searchResult: null,
    loading: true,
    operation: null,
    error: null,
    notice: null,
    indexTask: null,
    setView: (view) => set((state) => {
      if (state.view === view) return state;
      const history = [...state.viewHistory.slice(0, state.viewHistoryIndex + 1), view].slice(-30);
      try { localStorage.setItem("brace.last-view", view); } catch {}
      return { view, viewHistory: history, viewHistoryIndex: history.length - 1 };
    }),
    navigateHistory: (direction) => set((state) => {
      const index = Math.max(0, Math.min(state.viewHistory.length - 1, state.viewHistoryIndex + direction));
      if (index === state.viewHistoryIndex) return state;
      const view = state.viewHistory[index];
      try { localStorage.setItem("brace.last-view", view); } catch {}
      return { view, viewHistoryIndex: index };
    }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSelectedMemory: (selectedMemory) => set({ selectedMemory }),
    setAssistantDraft: (assistantDraft) => set({ assistantDraft }),
    clearMessage: () => set({ error: null, notice: null }),
    bootstrap: async () => {
      set({ loading: true, error: null });
      try {
        const api = desktop();
        if (!detachIndexProgress && api?.onBraceProjectIndexProgress) {
          detachIndexProgress = api.onBraceProjectIndexProgress((progress) => {
            const total = progress.total;
            const suffix = total && total > 0 ? ` ${Math.min(progress.completed, total)}/${total}` : "";
            set({ indexTask: progress, operation: `Indexing project · ${progress.phase}${suffix}` });
          });
        }
        await refresh();
        const allowed: BraceView[] = ["home", "inbox", "assistant", "search", "memories", "review", "timeline", "graph", "projects", "skills", "automations", "connections", "settings"];
        let saved: BraceView | null = null;
        try { saved = localStorage.getItem("brace.last-view") as BraceView | null; } catch {}
        if (saved && allowed.includes(saved)) {
          set({ view: saved, viewHistory: [saved], viewHistoryIndex: 0 });
        }
      } catch (error) {
        set({ loading: false, error: message(error) });
      }
    },
    refresh,
    refreshConnectors: async () => {
      const api = desktop();
      const connectors = api?.listBraceConnectors
        ? await api.listBraceConnectors()
        : [];
      set({ connectors });
    },
    installConnector: async (id, access) =>
      perform("Connecting AI client…", async () => {
        const api = desktop();
        if (!api?.installBraceConnector) {
          throw new Error("Guided connector setup is available in the desktop app.");
        }
        const result = await api.installBraceConnector(id, access);
        if (!result.connected) return;
        const connectors = await api.listBraceConnectors();
        set({
          connectors,
          notice: `${connectors.find((connector) => connector.id === id)?.name || "AI client"} is configured for BRACE. Run a turn to verify the live connection.`,
        });
      }),
    runAssistant: async (client, prompt) =>
      perform("Recalling context and asking AI…", async () => {
        const api = desktop();
        if (!api?.runBraceAssistant) {
          throw new Error("Ask BRACE is available in the desktop app.");
        }
        const result = await api.runBraceAssistant({ client, prompt });
        if (result.cancelled) return;
        await refresh();
        set({ notice: "Answer received. Nothing was added to durable memory automatically." });
      }),
    clearAssistantHistory: async () =>
      perform("Clearing Ask BRACE history…", async () => {
        const api = desktop();
        if (!api?.clearBraceAssistantHistory) {
          throw new Error("Ask BRACE history is available in the desktop app.");
        }
        if (await api.clearBraceAssistantHistory()) {
          await refresh();
          set({ notice: "Local Ask BRACE history cleared." });
        }
      }),
    initializeDemo: async () =>
      perform("Preparing synthetic demo…", async () => {
        const api = desktop();
        const snapshot = api?.initializeBraceDemo
          ? await api.initializeBraceDemo()
          : structuredClone(browserPreviewSnapshot);
        set({ snapshot, notice: "Synthetic Northstar workspace is ready.", view: "home" });
      }),
    search: async (value, options) =>
      perform("Searching local memory…", async () => {
        const query = (value ?? get().searchQuery).trim();
        if (!query) {
          set({ searchResult: null });
          return;
        }
        const api = desktop();
        const result = api?.searchBrace
          ? await api.searchBrace({ query, limit: 30, ...(options?.since ? { since: options.since } : {}) })
          : searchBrowserPreview(query, options);
        set({ searchQuery: query, searchResult: result });
        get().setView("search");
      }),
    createMemory: async (input) =>
      perform("Saving memory…", async () => {
        const api = desktop();
        if (!api?.createBraceMemory) throw new Error("Memory editing is available in the desktop app.");
        await api.createBraceMemory(input);
        await refresh();
        set({ notice: "Memory saved locally." });
      }),
    toggleMemoryPin: async (id, pinned) => {
      let updated: BraceMemory | null = null;
      await perform(pinned ? "Pinning memory…" : "Unpinning memory…", async () => {
        const api = desktop();
        if (!api?.setBraceMemoryPinned) throw new Error("Pinned memory is available in the desktop app.");
        updated = await api.setBraceMemoryPinned(id, pinned);
        await refresh();
        set({ selectedMemory: updated, notice: pinned ? "Memory pinned to your working set." : "Memory removed from your working set." });
      });
      return updated;
    },
    resolveMemoryReview: async (input) =>
      perform("Resolving memory review…", async () => {
        const api = desktop();
        if (!api?.resolveBraceMemoryReview) {
          throw new Error("Memory review is available in the desktop app.");
        }
        await api.resolveBraceMemoryReview(input);
        await refresh();
        set({
          notice: input.outcome === "distinct"
            ? "Both memories were kept as intentionally distinct."
            : "The selected memory is now canonical. The other remains recoverable as superseded.",
        });
      }),
    forgetMemory: async (id) =>
      perform("Forgetting memory…", async () => {
        const api = desktop();
        if (!api?.forgetBraceMemory) throw new Error("Memory deletion is available in the desktop app.");
        const forgotten = await api.forgetBraceMemory(id);
        if (forgotten) {
          set({ selectedMemory: null, notice: "Memory content and evidence were removed." });
          await refresh();
        }
      }),
    createDecision: async (input) =>
      perform("Recording decision…", async () => {
        const api = desktop();
        if (!api?.createBraceDecision) throw new Error("Decision capture is available in the desktop app.");
        await api.createBraceDecision(input);
        await refresh();
        set({ notice: "Decision added to the local timeline." });
      }),
    addProject: async () =>
      perform("Indexing project…", async () => {
        const api = desktop();
        if (!api?.addBraceProject) throw new Error("Project import is available in the desktop app.");
        let result;
        try { result = await api.addBraceProject(); } finally { set({ indexTask: null }); }
        if (result) {
          await refresh();
          set({ notice: "Project indexed. Original files were not changed." });
        }
      }),
    reindexProject: async (id) =>
      perform("Refreshing project index…", async () => {
        const api = desktop();
        if (!api?.reindexBraceProject) throw new Error("Project indexing is available in the desktop app.");
        try { await api.reindexBraceProject(id); } finally { set({ indexTask: null }); }
        await refresh();
        set({ notice: "Project index is current." });
      }),
    cancelIndexing: async () => {
      const task = get().indexTask;
      const api = desktop();
      if (!task || !api?.cancelBraceProjectIndex) return;
      await api.cancelBraceProjectIndex(task.taskId);
      set({ indexTask: null, operation: null, notice: "Project indexing cancelled." });
    },
    toggleSkill: async (name, enabled) =>
      perform(`${enabled ? "Enabling" : "Disabling"} skill…`, async () => {
        const api = desktop();
        if (!api?.setBraceSkillEnabled) throw new Error("Skill controls are available in the desktop app.");
        await api.setBraceSkillEnabled(name, enabled);
        await refresh();
      }),
    installSkill: async () =>
      perform("Installing skill…", async () => {
        const api = desktop();
        if (!api?.installBraceSkill) throw new Error("Skill installation is available in the desktop app.");
        const installed = await api.installBraceSkill();
        if (installed) {
          await refresh();
          set({ notice: "Skill installed disabled. Review it before enabling." });
        }
      }),
    configureEmbeddings: async (input) =>
      perform("Updating retrieval settings…", async () => {
        const api = desktop();
        if (!api?.setBraceEmbeddingConfig) throw new Error("Embedding settings are available in the desktop app.");
        await api.setBraceEmbeddingConfig(input);
        await refresh();
        set({ notice: "Retrieval settings saved locally." });
      }),
    exportData: async () =>
      perform("Exporting…", async () => {
        const api = desktop();
        if (!api?.exportBraceData) throw new Error("Export is available in the desktop app.");
        if (await api.exportBraceData()) set({ notice: "Portable JSON export created." });
      }),
    backupData: async () =>
      perform("Creating backup…", async () => {
        const api = desktop();
        if (!api?.backupBraceData) throw new Error("Backup is available in the desktop app.");
        if (await api.backupBraceData()) set({ notice: "Consistent SQLite backup created." });
      }),
    deleteAll: async (confirmation) =>
      perform("Deleting local BRACE data…", async () => {
        const api = desktop();
        if (!api?.deleteAllBraceData) throw new Error("Data deletion is available in the desktop app.");
        if (await api.deleteAllBraceData(confirmation)) {
          await refresh();
          set({ view: "home", notice: "Local BRACE data was deleted. Imported files were untouched." });
        }
      }),
    saveAutomation: async (input, id) => {
      let saved: BraceAutomation | null = null;
      await perform(id ? "Updating automation…" : "Creating automation…", async () => {
        const api = desktop();
        if (!api?.createBraceAutomation || !api?.updateBraceAutomation) {
          throw new Error("Automation editing is available in the desktop app.");
        }
        saved = id
          ? await api.updateBraceAutomation(id, input)
          : await api.createBraceAutomation(input);
        await refresh();
        set({ notice: `${saved.name} saved locally. New automations start paused until you enable them.` });
      });
      return saved;
    },
    toggleAutomation: async (id, enabled) =>
      perform(enabled ? "Enabling automation…" : "Pausing automation…", async () => {
        const api = desktop();
        if (!api?.setBraceAutomationEnabled) {
          throw new Error("Automation controls are available in the desktop app.");
        }
        await api.setBraceAutomationEnabled(id, enabled);
        await refresh();
        set({ notice: enabled ? "Automation enabled." : "Automation paused." });
      }),
    runAutomation: async (id, dryRun = false) =>
      perform(dryRun ? "Previewing automation…" : "Running automation…", async () => {
        const api = desktop();
        if (!api?.runBraceAutomation) {
          throw new Error("Automation runs are available in the desktop app.");
        }
        const run = await api.runBraceAutomation(id, { dryRun, payload: { eventType: "manual" } });
        await refresh();
        set({
          notice: run.status === "failed"
            ? `Automation failed: ${run.error || "Inspect its run trace."}`
            : dryRun
              ? "Preview completed without changing memory."
              : `Automation finished with status: ${run.status}.`,
        });
      }),
    retryAutomation: async (runId, dryRun = false) =>
      perform(dryRun ? "Previewing retry…" : "Retrying automation…", async () => {
        const api = desktop();
        if (!api?.retryBraceAutomationRun) {
          throw new Error("Automation retry is available in the desktop app.");
        }
        const run = await api.retryBraceAutomationRun(runId, dryRun);
        await refresh();
        set({ notice: `Retry finished with status: ${run.status}.` });
      }),
    deleteAutomation: async (id) =>
      perform("Deleting automation…", async () => {
        const api = desktop();
        if (!api?.deleteBraceAutomation) {
          throw new Error("Automation deletion is available in the desktop app.");
        }
        if (await api.deleteBraceAutomation(id)) {
          await refresh();
          set({ notice: "Automation deleted. Its run audit remains available." });
        }
      }),
    pauseAutomations: async (paused) =>
      perform(paused ? "Pausing all automations…" : "Resuming automations…", async () => {
        const api = desktop();
        if (!api?.setBraceAutomationsPaused) {
          throw new Error("The global automation switch is available in the desktop app.");
        }
        await api.setBraceAutomationsPaused(paused);
        await refresh();
        set({ notice: paused ? "All automatic triggers are paused. Manual previews still work." : "Automatic triggers resumed." });
      }),
  };
});
