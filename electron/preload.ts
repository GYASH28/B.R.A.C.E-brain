import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  getBraceSnapshot: () => ipcRenderer.invoke("brace:get-snapshot"),
  initializeBraceDemo: () => ipcRenderer.invoke("brace:initialize-demo"),
  searchBrace: (input: unknown) => ipcRenderer.invoke("brace:search", input),
  getBraceMemory: (id: string) => ipcRenderer.invoke("brace:get-memory", id),
  createBraceMemory: (input: unknown) =>
    ipcRenderer.invoke("brace:create-memory", input),
  updateBraceMemory: (id: string, changes: unknown) =>
    ipcRenderer.invoke("brace:update-memory", id, changes),
  setBraceMemoryPinned: (id: string, pinned: boolean) =>
    ipcRenderer.invoke("brace:set-memory-pinned", id, pinned),
  resolveBraceMemoryReview: (input: unknown) =>
    ipcRenderer.invoke("brace:resolve-memory-review", input),
  forgetBraceMemory: (id: string) =>
    ipcRenderer.invoke("brace:forget-memory", id),
  addBraceEvidence: (id: string, input: unknown) =>
    ipcRenderer.invoke("brace:add-evidence", id, input),
  createBraceDecision: (input: unknown) =>
    ipcRenderer.invoke("brace:create-decision", input),
  addBraceProject: () => ipcRenderer.invoke("brace:add-project"),
  reindexBraceProject: (projectId: string) =>
    ipcRenderer.invoke("brace:reindex-project", projectId),
  cancelBraceProjectIndex: (taskId: string) =>
    ipcRenderer.invoke("brace:cancel-project-index", taskId),
  onBraceProjectIndexProgress: (listener: (progress: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => listener(progress);
    ipcRenderer.on("brace:project-index-progress", handler);
    return () => ipcRenderer.removeListener("brace:project-index-progress", handler);
  },
  installBraceSkill: () => ipcRenderer.invoke("brace:install-skill"),
  setBraceSkillEnabled: (name: string, enabled: boolean) =>
    ipcRenderer.invoke("brace:set-skill-enabled", name, enabled),
  removeBraceSkill: (name: string) =>
    ipcRenderer.invoke("brace:remove-skill", name),
  runBraceSkill: (name: string, action: string, input: unknown) =>
    ipcRenderer.invoke("brace:run-skill", name, action, input),
  setBraceEmbeddingConfig: (input: unknown) =>
    ipcRenderer.invoke("brace:set-embedding-config", input),
  exportBraceData: () => ipcRenderer.invoke("brace:export"),
  backupBraceData: () => ipcRenderer.invoke("brace:backup"),
  deleteAllBraceData: (confirmation: string) =>
    ipcRenderer.invoke("brace:delete-all", confirmation),
  listBraceConnectors: () => ipcRenderer.invoke("brace:list-connectors"),
  installBraceConnector: (id: string, access: string) =>
    ipcRenderer.invoke("brace:install-connector", id, access),
  runBraceAssistant: (input: unknown) =>
    ipcRenderer.invoke("brace:run-assistant", input),
  clearBraceAssistantHistory: () =>
    ipcRenderer.invoke("brace:clear-assistant-history"),
  copyBraceText: (value: string) => ipcRenderer.invoke("brace:copy-text", value),
  getBraceAutomations: () => ipcRenderer.invoke("brace:get-automations"),
  createBraceAutomation: (input: unknown) =>
    ipcRenderer.invoke("brace:create-automation", input),
  updateBraceAutomation: (id: string, input: unknown) =>
    ipcRenderer.invoke("brace:update-automation", id, input),
  setBraceAutomationEnabled: (id: string, enabled: boolean) =>
    ipcRenderer.invoke("brace:set-automation-enabled", id, enabled),
  runBraceAutomation: (id: string, input: unknown) =>
    ipcRenderer.invoke("brace:run-automation", id, input),
  retryBraceAutomationRun: (runId: string, dryRun: boolean) =>
    ipcRenderer.invoke("brace:retry-automation-run", runId, dryRun),
  deleteBraceAutomation: (id: string) =>
    ipcRenderer.invoke("brace:delete-automation", id),
  setBraceAutomationsPaused: (paused: boolean) =>
    ipcRenderer.invoke("brace:set-automations-paused", paused),
});
