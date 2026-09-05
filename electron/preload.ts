import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  getBraceSnapshot: () => ipcRenderer.invoke("brace:get-snapshot"),
  initializeBraceDemo: () => ipcRenderer.invoke("brace:initialize-demo"),
  createBraceOrganization: (input: unknown) =>
    ipcRenderer.invoke("brace:create-organization", input),
  createBraceWorkspace: (input: unknown) =>
    ipcRenderer.invoke("brace:create-workspace", input),
  upsertBraceWorkspaceMember: (input: unknown) =>
    ipcRenderer.invoke("brace:upsert-workspace-member", input),
  cancelBraceTask: (id: string) => ipcRenderer.invoke("brace:cancel-task", id),
  onBraceTaskProgress: (listener: (task: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, task: unknown) => listener(task);
    ipcRenderer.on("brace:task-progress", handler);
    return () => ipcRenderer.removeListener("brace:task-progress", handler);
  },
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
  restoreBraceMemory: (id: string) => ipcRenderer.invoke("brace:restore-memory", id),
  forgetBraceMemory: (id: string) =>
    ipcRenderer.invoke("brace:forget-memory", id),
  addBraceEvidence: (id: string, input: unknown) =>
    ipcRenderer.invoke("brace:add-evidence", id, input),
  setBraceEvidenceOutcome: (memoryId: string, evidenceId: string, outcome: string) =>
    ipcRenderer.invoke("brace:set-evidence-outcome", memoryId, evidenceId, outcome),
  createBraceDecision: (input: unknown) =>
    ipcRenderer.invoke("brace:create-decision", input),
  addBraceProject: () => ipcRenderer.invoke("brace:add-project"),
  reindexBraceProject: (projectId: string) =>
    ipcRenderer.invoke("brace:reindex-project", projectId),
  setBraceProjectWatch: (projectId: string, enabled: boolean) =>
    ipcRenderer.invoke("brace:set-project-watch", projectId, enabled),
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
  importBraceContent: () => ipcRenderer.invoke("brace:import-content"),
  backupBraceData: () => ipcRenderer.invoke("brace:backup"),
  getBraceDiagnostics: () => ipcRenderer.invoke("brace:diagnostics"),
  saveBraceSupportBundle: () => ipcRenderer.invoke("brace:save-support-bundle"),
  restoreBraceBackup: () => ipcRenderer.invoke("brace:restore-backup"),
  deleteAllBraceData: (confirmation: string) =>
    ipcRenderer.invoke("brace:delete-all", confirmation),
  listBraceConnectors: () => ipcRenderer.invoke("brace:list-connectors"),
  installBraceConnector: (id: string, access: string) =>
    ipcRenderer.invoke("brace:install-connector", id, access),
  restoreBraceConnector: (id: string) =>
    ipcRenderer.invoke("brace:restore-connector", id),
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
  exportBraceAutomations: (id?: string) =>
    ipcRenderer.invoke("brace:export-automations", id),
  importBraceAutomations: () =>
    ipcRenderer.invoke("brace:import-automations"),
  deleteBraceAutomation: (id: string) =>
    ipcRenderer.invoke("brace:delete-automation", id),
  setBraceAutomationsPaused: (paused: boolean) =>
    ipcRenderer.invoke("brace:set-automations-paused", paused),
});
