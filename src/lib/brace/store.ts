"use client";

import { create } from "zustand";
import { desktopApi, runtimeAdapter } from "./adapters";
import { browserPreviewSnapshot } from "./browser-preview";
import type {
  BraceConnector,
  BraceAutomation,
  BraceMemory,
  BraceSnapshot,
  ConnectorAccess,
  ConnectorId,
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
  | "documents"
  | "projects"
  | "organization"
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
  graphFocusId: string | null;
  assistantDraft: string;
  searchQuery: string;
  searchResult: SearchResponse | null;
  loading: boolean;
  operation: string | null;
  error: string | null;
  errorInfo: { summary: string; detail: string; nextStep: string; code: string; retryable: boolean } | null;
  notice: string | null;
  setView: (view: BraceView) => void;
  navigateHistory: (direction: -1 | 1) => void;
  setSearchQuery: (query: string) => void;
  setSelectedMemory: (memory: BraceMemory | null) => void;
  openGraphNode: (id: string) => void;
  setAssistantDraft: (draft: string) => void;
  clearMessage: () => void;
  retryLastOperation: () => Promise<void>;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshConnectors: () => Promise<void>;
  installConnector: (id: ConnectorId, access: ConnectorAccess) => Promise<void>;
  restoreConnector: (id: Exclude<ConnectorId, "generic">) => Promise<void>;
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
  restoreMemory: (id: string) => Promise<BraceMemory | null>;
  setEvidenceOutcome: (memoryId: string, evidenceId: string, outcome: "promoted" | "rejected" | "deferred" | "observed") => Promise<BraceMemory | null>;
  forgetMemory: (id: string) => Promise<void>;
  createDecision: (input: Record<string, unknown>) => Promise<void>;
  createOrganization: (input: Record<string, unknown>) => Promise<void>;
  createWorkspace: (input: Record<string, unknown>) => Promise<void>;
  upsertWorkspaceMember: (input: Record<string, unknown>) => Promise<void>;
  addProject: () => Promise<void>;
  reindexProject: (id: string) => Promise<void>;
  setProjectWatch: (id: string, enabled: boolean) => Promise<void>;
  toggleSkill: (name: string, enabled: boolean) => Promise<void>;
  installSkill: () => Promise<void>;
  configureEmbeddings: (input: Record<string, unknown>) => Promise<void>;
  exportData: () => Promise<void>;
  importContent: () => Promise<void>;
  backupData: () => Promise<void>;
  deleteAll: (confirmation: string) => Promise<void>;
  saveAutomation: (input: Record<string, unknown>, id?: string) => Promise<BraceAutomation | null>;
  toggleAutomation: (id: string, enabled: boolean) => Promise<void>;
  runAutomation: (id: string, dryRun?: boolean) => Promise<void>;
  retryAutomation: (runId: string, dryRun?: boolean) => Promise<void>;
  exportAutomations: (id?: string) => Promise<void>;
  importAutomations: () => Promise<void>;
  deleteAutomation: (id: string) => Promise<void>;
  pauseAutomations: (paused: boolean) => Promise<void>;
}

function message(error: unknown) {
  const raw = error instanceof Error ? error.message : "BRACE could not complete that operation.";
  return raw
    .replace(/\b(password|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/(?:[A-Za-z]:\\|\/home\/|\/Users\/)[^\s]+/g, "[local path]")
    .slice(0, 1_000);
}

function structuredError(error: unknown, label: string) {
  const detail = message(error);
  const normalized = detail.toLowerCase();
  const code = normalized.includes("not found") || normalized.includes("not installed") ? "UNAVAILABLE"
    : normalized.includes("timeout") || normalized.includes("timed out") ? "TIMEOUT"
      : normalized.includes("permission") || normalized.includes("trusted") ? "PERMISSION"
        : normalized.includes("database") || normalized.includes("sqlite") ? "LOCAL_DATA"
          : "OPERATION_FAILED";
  const nextStep = code === "UNAVAILABLE" ? "Check that the selected item or client still exists, then refresh this screen."
    : code === "TIMEOUT" ? "Check the local provider or source folder, then try the operation again."
      : code === "PERMISSION" ? "Return to the relevant settings screen and review the requested local permission."
        : code === "LOCAL_DATA" ? "Open Settings → Backup & diagnostics and run the local integrity check."
          : "Review the safe detail below. Your source files were not changed.";
  const retryable = !/(delet|forget|restore|connect|creat|sav|import)/i.test(label);
  return { summary: `${label.replace(/…$/, "")} could not finish.`, detail, nextStep, code, retryable };
}

const desktop = desktopApi;

export const useBrace = create<BraceState>((set, get) => {
  let retryTask: { label: string; task: () => Promise<void> } | null = null;
  const perform = async (label: string, task: () => Promise<void>) => {
    set({ operation: label, error: null, errorInfo: null, notice: null });
    try {
      await task();
      retryTask = null;
    } catch (error) {
      const info = structuredError(error, label);
      if (info.retryable) retryTask = { label, task };
      else retryTask = null;
      set({ error: info.summary, errorInfo: info });
    } finally {
      set({ operation: null });
    }
  };

  const refresh = async () => {
    const api = desktopApi();
    const adapter = runtimeAdapter();
    const [snapshot, connectors] = await Promise.all([
      adapter.snapshot(),
      adapter.connectors(),
    ]);
    set({ snapshot, connectors, loading: false });
  };

  return {
    view: "graph",
    viewHistory: ["graph"],
    viewHistoryIndex: 0,
    snapshot: null,
    connectors: [],
    selectedMemory: null,
    graphFocusId: null,
    assistantDraft: "",
    searchQuery: "",
    searchResult: null,
    loading: true,
    operation: null,
    error: null,
    errorInfo: null,
    notice: null,
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
    openGraphNode: (graphFocusId) => {
      set({ graphFocusId });
      get().setView("graph");
    },
    setAssistantDraft: (assistantDraft) => set({ assistantDraft }),
    clearMessage: () => set({ error: null, errorInfo: null, notice: null }),
    retryLastOperation: async () => {
      const retry = retryTask;
      if (!retry) return;
      await perform(retry.label, retry.task);
    },
    bootstrap: async () => {
      set({ loading: true, error: null });
      try {
        await refresh();
        const allowed: BraceView[] = ["home", "inbox", "assistant", "search", "memories", "review", "timeline", "graph", "documents", "projects", "organization", "skills", "automations", "connections", "settings"];
        let saved: BraceView | null = null;
        try { saved = localStorage.getItem("brace.last-view") as BraceView | null; } catch {}
        if (saved && allowed.includes(saved)) {
          set({ view: saved, viewHistory: [saved], viewHistoryIndex: 0 });
        }
      } catch (error) {
        const info = structuredError(error, "Opening BRACE…");
        set({ loading: false, error: info.summary, errorInfo: info });
      }
    },
    refresh,
    refreshConnectors: async () => {
      const connectors = await runtimeAdapter().connectors();
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
    restoreConnector: async (id) =>
      perform("Restoring connector configuration…", async () => {
        const api = desktop();
        if (!api?.restoreBraceConnector) throw new Error("Connector recovery is available in the desktop app.");
        const result = await api.restoreBraceConnector(id);
        if (!result.restored) return;
        const connectors = await api.listBraceConnectors();
        set({ connectors, notice: "The previous client configuration was restored from BRACE's local backup." });
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
        set({ snapshot, notice: "Synthetic Northstar workspace is ready.", view: "graph", viewHistory: ["graph"], viewHistoryIndex: 0 });
      }),
    search: async (value, options) =>
      perform("Searching local memory…", async () => {
        const query = (value ?? get().searchQuery).trim();
        if (!query) {
          set({ searchResult: null });
          return;
        }
        const result = await runtimeAdapter().search(query, options);
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
    restoreMemory: async (id) => {
      let restored: BraceMemory | null = null;
      await perform("Restoring memory…", async () => {
        const api = desktop();
        if (!api?.restoreBraceMemory) throw new Error("Memory recovery is available in the desktop app.");
        restored = await api.restoreBraceMemory(id);
        await refresh();
        set({ selectedMemory: restored, notice: "Memory restored to active recall. The recovery is recorded on the timeline." });
      });
      return restored;
    },
    setEvidenceOutcome: async (memoryId, evidenceId, outcome) => {
      let updated: BraceMemory | null = null;
      await perform("Reviewing evidence…", async () => {
        const api = desktop();
        if (!api?.setBraceEvidenceOutcome) throw new Error("Evidence review is available in the desktop app.");
        updated = await api.setBraceEvidenceOutcome(memoryId, evidenceId, outcome);
        await refresh();
        set({ selectedMemory: updated, notice: `Evidence marked ${outcome}.` });
      });
      return updated;
    },
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
    createOrganization: async (input) =>
      perform("Creating company brain…", async () => {
        const api = desktop();
        if (!api?.createBraceOrganization) throw new Error("Company workspaces are available in the desktop app.");
        await api.createBraceOrganization(input);
        await refresh();
        set({ notice: "Company brain created locally with explicit workspace boundaries." });
      }),
    createWorkspace: async (input) =>
      perform("Creating workspace…", async () => {
        const api = desktop();
        if (!api?.createBraceWorkspace) throw new Error("Workspace management is available in the desktop app.");
        await api.createBraceWorkspace(input);
        await refresh();
        set({ notice: "Workspace created and added to the local governance ledger." });
      }),
    upsertWorkspaceMember: async (input) =>
      perform("Updating workspace role…", async () => {
        const api = desktop();
        if (!api?.upsertBraceWorkspaceMember) throw new Error("Role management is available in the desktop app.");
        await api.upsertBraceWorkspaceMember(input);
        await refresh();
        set({ notice: "Workspace role saved locally. No invitation email was sent." });
      }),
    addProject: async () =>
      perform("Indexing project…", async () => {
        const api = desktop();
        if (!api?.addBraceProject) throw new Error("Project import is available in the desktop app.");
        const result = await api.addBraceProject();
        if (result) {
          await refresh();
          set({ notice: `Indexed ${result.indexed.toLocaleString()} changed files, kept ${result.unchanged.toLocaleString()} current, and protected ${result.redacted.toLocaleString()} secret-like value${result.redacted === 1 ? "" : "s"}. Original files were not changed.` });
        }
      }),
    reindexProject: async (id) =>
      perform("Refreshing project index…", async () => {
        const api = desktop();
        if (!api?.reindexBraceProject) throw new Error("Project indexing is available in the desktop app.");
        const result = await api.reindexBraceProject(id);
        await refresh();
        set({ notice: `Project index is current: ${result.indexed.toLocaleString()} changed, ${result.unchanged.toLocaleString()} unchanged, ${result.ignoredByRule.toLocaleString()} ignored by .braceignore, ${result.redacted.toLocaleString()} secret-like value${result.redacted === 1 ? "" : "s"} protected.` });
      }),
    setProjectWatch: async (id, enabled) =>
      perform(enabled ? "Enabling background indexing…" : "Pausing background indexing…", async () => {
        const api = desktop();
        if (!api?.setBraceProjectWatch) throw new Error("Background indexing is available in the desktop app.");
        await api.setBraceProjectWatch(id, enabled);
        await refresh();
        set({ notice: enabled ? "Background indexing enabled for this project. Changes are debounced and original files stay untouched." : "Background indexing paused for this project." });
      }),
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
    importContent: async () =>
      perform("Importing local content…", async () => {
        const api = desktop();
        if (!api?.importBraceContent) throw new Error("Local imports are available in the desktop app.");
        const result = await api.importBraceContent();
        if (!result) return;
        await refresh();
        set({ notice: `Imported ${result.documents} document${result.documents === 1 ? "" : "s"} and ${result.memories} memor${result.memories === 1 ? "y" : "ies"}; ${result.duplicates} duplicate${result.duplicates === 1 ? " was" : "s were"} reused. A safety backup was created first.` });
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
    exportAutomations: async (id) =>
      perform("Exporting automation recipes…", async () => {
        const api = desktop();
        if (!api?.exportBraceAutomations) throw new Error("Automation export is available in the desktop app.");
        const result = await api.exportBraceAutomations(id);
        if (result) set({ notice: `${result.count} paused automation recipe${result.count === 1 ? "" : "s"} exported.` });
      }),
    importAutomations: async () =>
      perform("Importing automation recipes…", async () => {
        const api = desktop();
        if (!api?.importBraceAutomations) throw new Error("Automation import is available in the desktop app.");
        const result = await api.importBraceAutomations();
        if (!result) return;
        await refresh();
        set({ notice: `${result.count} automation recipe${result.count === 1 ? "" : "s"} imported paused.` });
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
