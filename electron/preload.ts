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
});
