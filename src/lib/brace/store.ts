"use client";

import { create } from "zustand";
import { browserPreviewSnapshot, searchBrowserPreview } from "./browser-preview";
import type { BraceMemory, BraceSnapshot, SearchResponse } from "./types";

export type BraceView =
  | "home"
  | "search"
  | "memories"
  | "review"
  | "timeline"
  | "graph"
  | "projects"
  | "skills"
  | "connections"
  | "settings";

interface BraceState {
  view: BraceView;
  snapshot: BraceSnapshot | null;
  selectedMemory: BraceMemory | null;
  searchQuery: string;
  searchResult: SearchResponse | null;
  loading: boolean;
  operation: string | null;
  error: string | null;
  notice: string | null;
  setView: (view: BraceView) => void;
  setSearchQuery: (query: string) => void;
  setSelectedMemory: (memory: BraceMemory | null) => void;
  clearMessage: () => void;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  initializeDemo: () => Promise<void>;
  search: (query?: string) => Promise<void>;
  createMemory: (input: Record<string, unknown>) => Promise<void>;
  resolveMemoryReview: (input: {
    leftId: string;
    rightId: string;
    outcome: "distinct" | "keep-left" | "keep-right";
  }) => Promise<void>;
  forgetMemory: (id: string) => Promise<void>;
  createDecision: (input: Record<string, unknown>) => Promise<void>;
  addProject: () => Promise<void>;
  reindexProject: (id: string) => Promise<void>;
  toggleSkill: (name: string, enabled: boolean) => Promise<void>;
  installSkill: () => Promise<void>;
  configureEmbeddings: (input: Record<string, unknown>) => Promise<void>;
  exportData: () => Promise<void>;
  backupData: () => Promise<void>;
  deleteAll: (confirmation: string) => Promise<void>;
}

function desktop() {
  return typeof window !== "undefined" ? window.electron : undefined;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "BRACE could not complete that operation.";
}

export const useBrace = create<BraceState>((set, get) => {
  const perform = async (label: string, task: () => Promise<void>) => {
    set({ operation: label, error: null, notice: null });
    try {
      await task();
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ operation: null });
    }
  };

  const refresh = async () => {
    const api = desktop();
    const snapshot = api?.getBraceSnapshot
      ? await api.getBraceSnapshot()
      : structuredClone(browserPreviewSnapshot);
    set({ snapshot, loading: false });
  };

  return {
    view: "home",
    snapshot: null,
    selectedMemory: null,
    searchQuery: "",
    searchResult: null,
    loading: true,
    operation: null,
    error: null,
    notice: null,
    setView: (view) => set({ view }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSelectedMemory: (selectedMemory) => set({ selectedMemory }),
    clearMessage: () => set({ error: null, notice: null }),
    bootstrap: async () => {
      set({ loading: true, error: null });
      try {
        await refresh();
      } catch (error) {
        set({ loading: false, error: message(error) });
      }
    },
    refresh,
    initializeDemo: async () =>
      perform("Preparing synthetic demo…", async () => {
        const api = desktop();
        const snapshot = api?.initializeBraceDemo
          ? await api.initializeBraceDemo()
          : structuredClone(browserPreviewSnapshot);
        set({ snapshot, notice: "Synthetic Northstar workspace is ready.", view: "home" });
      }),
    search: async (value) =>
      perform("Searching local memory…", async () => {
        const query = (value ?? get().searchQuery).trim();
        if (!query) {
          set({ searchResult: null });
          return;
        }
        const api = desktop();
        const result = api?.searchBrace
          ? await api.searchBrace({ query, limit: 30 })
          : searchBrowserPreview(query);
        set({ searchQuery: query, searchResult: result, view: "search" });
      }),
    createMemory: async (input) =>
      perform("Saving memory…", async () => {
        const api = desktop();
        if (!api?.createBraceMemory) throw new Error("Memory editing is available in the desktop app.");
        await api.createBraceMemory(input);
        await refresh();
        set({ notice: "Memory saved locally." });
      }),
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
        const result = await api.addBraceProject();
        if (result) {
          await refresh();
          set({ notice: "Project indexed. Original files were not changed." });
        }
      }),
    reindexProject: async (id) =>
      perform("Refreshing project index…", async () => {
        const api = desktop();
        if (!api?.reindexBraceProject) throw new Error("Project indexing is available in the desktop app.");
        await api.reindexBraceProject(id);
        await refresh();
        set({ notice: "Project index is current." });
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
  };
});
