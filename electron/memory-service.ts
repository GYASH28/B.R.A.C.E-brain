import { clipboard, dialog, ipcMain, type BrowserWindow } from "electron";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import memoryModule from "../core/memory-store";
import projectModule from "../core/project-indexer";
import embeddingModule from "../core/embedding-adapters";
import skillModule from "../core/skill-runtime";
import demoModule from "../core/demo-profile";
import dataPathModule from "../core/data-paths";
import automationModule from "../core/automation-engine";
import {
  BraceConnectorService,
  type ConnectorAccess,
  type ConnectorId,
} from "./connector-service";
import ipcSecurityModule from "./ipc-security";
import ipcContractsModule from "./ipc-contracts";


const { MemoryStore, redactSecrets } = memoryModule as any;
const { indexProject } = projectModule as any;
const { createOllamaEmbeddingAdapter } = embeddingModule as any;
const { installSkill, runSkillAction } = skillModule as any;
const { initializeDemoProfile } = demoModule as any;
const { defaultDataRoot } = dataPathModule as any;
const { AutomationEngine } = automationModule as any;
const { assertTrustedIpcSender } = ipcSecurityModule as any;
const { validateIpcArguments } = ipcContractsModule as any;

interface ServiceOptions {
  userDataPath: string;
  appPath: string;
  getWindow: () => BrowserWindow | null;
  dataRoot?: string;
  executablePath?: string;
}

export class BraceMemoryService {
  readonly dataDirectory: string;
  readonly databasePath: string;
  readonly skillsDirectory: string;
  readonly demoDirectory: string;
  readonly profileWorkspacePath: string;
  readonly store: any;
  readonly connectors: BraceConnectorService;
  readonly automations: any;
  private readonly appPath: string;
  private readonly getWindow: () => BrowserWindow | null;
  private readonly executablePath: string;
  private automationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: ServiceOptions) {
    this.appPath = options.appPath;
    this.getWindow = options.getWindow;
    this.executablePath = options.executablePath || process.execPath;
    this.dataDirectory = options.dataRoot || defaultDataRoot();
    this.databasePath = path.join(this.dataDirectory, "brace.sqlite3");
    this.skillsDirectory = path.join(this.dataDirectory, "skills");
    this.demoDirectory = path.join(this.dataDirectory, "demo-workspace");
    this.profileWorkspacePath = path.join(this.dataDirectory, "agent-workspace");
    fs.mkdirSync(this.profileWorkspacePath, { recursive: true });
    this.store = new MemoryStore(this.databasePath);
    this.connectors = new BraceConnectorService({
      userDataPath: options.userDataPath,
      executablePath: this.executablePath,
      appPath: this.appPath,
      getWindow: this.getWindow,
    });
    this.automations = new AutomationEngine(this.store, {
      reindexProject: (projectId: string) => this.reindexProject(projectId, { suppressAutomation: true }),
      runSkill: (name: string, action: string, input: any) => this.runSkill(name, action, input),
    });
    this.installBundledSkills();
    this.automationTimer = setInterval(() => {
      void this.tickAutomations();
    }, 30_000);
    this.automationTimer.unref?.();
    void this.tickAutomations();
  }

  close() {
    if (this.automationTimer) clearInterval(this.automationTimer);
    this.automationTimer = null;
    this.store.close();
  }

  async tickAutomations() {
    try {
      return await this.automations.tick();
    } catch (error: any) {
      this.store.setSetting("automation.scheduler.error", {
        message: redactSecrets(String(error?.message || "Automation scheduler failed.")).value,
        occurredAt: new Date().toISOString(),
      });
      return [];
    }
  }

  installBundledSkills() {
    const bundled = [
      ["decision-journal", ["decision:write", "timeline:read"]],
      ["project-recall", ["memory:read", "source:read"]],
    ];
    for (const [name, permissions] of bundled) {
      if (this.store.getSkill(name as string)) continue;
      const manifestPath = path.join(
        this.appPath,
        "examples",
        "skills",
        name as string,
        "brace-skill.json",
      );
      if (!fs.existsSync(manifestPath)) continue;
      installSkill(this.store, manifestPath, {
        installRoot: this.skillsDirectory,
        approvedPermissions: permissions,
        enabled: true,
      });
    }
  }

  embeddingAdapter() {
    const config = this.store.getSetting("embedding.ollama", null);
    if (!config?.enabled || !config?.model) return null;
    return createOllamaEmbeddingAdapter({
      endpoint: config.endpoint || "http://127.0.0.1:11434",
      model: config.model,
    });
  }

  async search(input: any) {
    const query = String(input?.query || "").trim();
    if (!query) return { mode: "lexical", memories: [], sources: [], embeddingModel: null };
    const adapter = this.embeddingAdapter();
    let queryVector: number[] | null = null;
    let warning: string | null = null;
    if (adapter) {
      try {
        [queryVector] = await adapter.embed([query]);
      } catch (error: any) {
        warning = `Semantic retrieval unavailable; lexical search completed: ${error.message}`;
      }
    }
    const vectorOptions = queryVector
      ? { queryVector, embeddingModel: adapter.model }
      : {};
    const memories = this.store.search(query, {
      scope: input?.scope,
      kinds: input?.kinds,
      since: input?.since,
      limit: input?.limit,
      ...vectorOptions,
    });
    const sources = this.store.searchSources(query, {
      projectId: input?.projectId,
      since: input?.since,
      limit: input?.limit,
      ...vectorOptions,
    });
    const mode = [memories.mode, sources.mode].includes("hybrid")
      ? "hybrid"
      : [memories.mode, sources.mode].includes("semantic")
        ? "semantic"
        : "lexical";
    return {
      mode,
      embeddingModel: mode === "lexical" ? null : adapter.model,
      warning,
      memories: memories.results,
      sources: sources.results,
    };
  }

  assistantHistory() {
    const history = this.store.getSetting("assistant.conversations", []);
    if (!Array.isArray(history)) return [];
    return history.slice(-40).map((turn: any) => ({
      ...turn,
      prompt: redactSecrets(String(turn?.prompt || "")).value,
      response: redactSecrets(String(turn?.response || "")).value,
    }));
  }

  async runAssistant(input: any) {
    const client = String(input?.client || "codex");
    if (client !== "codex" && client !== "claude") {
      throw new Error("The embedded workspace currently supports detected Codex CLI or Claude Code clients.");
    }
    const prompt = String(input?.prompt || "").trim();
    if (!prompt) throw new Error("Ask BRACE a specific question.");
    if (prompt.length > 12_000) throw new Error("Keep one AI workspace turn under 12,000 characters.");
    const context = await this.search({ query: prompt, limit: 6 });
    const memories = context.memories.slice(0, 6).map((memory: any) => ({
      title: memory.title,
      kind: memory.kind,
      summary: String(memory.summary || memory.content || "").slice(0, 900),
      sourceUri: memory.sourceUri || null,
    }));
    const sources = context.sources.slice(0, 6).map((source: any) => ({
      title: source.heading || source.title,
      uri: source.uri,
      excerpt: String(source.content || "").slice(0, 1_000),
    }));
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const clientLabel = client === "codex" ? "Codex CLI" : "Claude Code";
    const approval = await dialog.showMessageBox(window, {
      type: "question",
      title: `Send this turn to ${clientLabel}?`,
      message: `BRACE found ${memories.length} memories and ${sources.length} source excerpts for this question.`,
      detail: [
        "The prompt and listed context will be sent through the selected client's configured model provider.",
        "The client runs in BRACE's isolated read-only agent workspace and cannot edit imported projects from this surface.",
        "The prompt and final answer are saved in local AI Workspace history. They are not automatically promoted to durable memory.",
      ].join("\n\n"),
      buttons: ["Cancel", `Send to ${clientLabel}`],
      defaultId: 0,
      cancelId: 0,
    });
    if (approval.response !== 1) return { cancelled: true };
    const agentPrompt = [
      "You are operating inside the BRACE local-first AI Workspace.",
      "Answer the user's question using the supplied BRACE context when relevant.",
      "Keep durable memory and indexed source evidence separate. Cite brace-project URIs exactly when supplied.",
      "Do not claim to have inspected or changed files outside this supplied context. This turn is read-only.",
      `\nUSER QUESTION\n${prompt}`,
      `\nDURABLE MEMORY\n${memories.length ? JSON.stringify(memories, null, 2) : "No matching durable memory."}`,
      `\nSOURCE EVIDENCE\n${sources.length ? JSON.stringify(sources, null, 2) : "No matching indexed source evidence."}`,
    ].join("\n");
    const result = await this.connectors.runAssistant(
      client,
      agentPrompt,
      this.profileWorkspacePath,
    );
    const turn = {
      id: randomUUID(),
      client,
      prompt: redactSecrets(prompt).value,
      response: redactSecrets(result.response).value,
      createdAt: new Date().toISOString(),
      context: {
        mode: context.mode,
        embeddingModel: context.embeddingModel,
        memoryCount: memories.length,
        sourceCount: sources.length,
      },
    };
    const history = [...this.assistantHistory(), turn].slice(-40);
    this.store.setSetting("assistant.conversations", history);
    return { cancelled: false, turn };
  }

  async clearAssistantHistory() {
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const approval = await dialog.showMessageBox(window, {
      type: "warning",
      title: "Clear local AI Workspace history?",
      message: "This removes saved prompts and answers from BRACE's local database.",
      detail: "Durable memories, decisions, indexed projects, and client conversations outside BRACE are not changed.",
      buttons: ["Cancel", "Clear history"],
      defaultId: 0,
      cancelId: 0,
    });
    if (approval.response !== 1) return false;
    this.store.setSetting("assistant.conversations", []);
    return true;
  }

  copyText(value: unknown) {
    const text = String(value || "");
    if (!text || text.length > 200_000) {
      throw new Error("Copy a non-empty BRACE value under 200,000 characters.");
    }
    clipboard.writeText(text);
    return true;
  }

  snapshot() {
    const launch = this.connectors.launchDefinition("read-only");
    return {
      environment: "desktop",
      storage: {
        directory: this.dataDirectory,
        database: this.databasePath,
      },
      connections: {
        ...launch,
        instruction:
          "Search BRACE before asking the user to repeat durable project context. Keep memory separate from source evidence, cite brace-project URIs, and retain only explicit credential-free outcomes when write tools are enabled.",
      },
      stats: this.store.stats(),
      projects: this.store.listProjects(),
      memories: this.store.listMemories({ limit: 100 }),
      memoryQuality: this.store.memoryQuality({ limit: 50 }),
      timeline: this.store.listTimeline({ limit: 100 }),
      graph: this.store.graph({ limit: 500 }),
      skills: this.store.listSkills().map((skill: any) => ({
        name: skill.name,
        version: skill.version,
        description: skill.manifest.description,
        displayName: skill.manifest.displayName || skill.name,
        enabled: skill.enabled,
        permissions: skill.permissions,
        actions: skill.manifest.actions.map((action: any) => ({
          id: action.id,
          label: action.label || action.id,
          description: action.description || "",
          inputSchema: action.inputSchema || {},
        })),
      })),
      semantic: {
        enabled: Boolean(this.embeddingAdapter()),
        config: this.store.getSetting("embedding.ollama", {
          enabled: false,
          endpoint: "http://127.0.0.1:11434",
          model: "nomic-embed-text",
        }),
      },
      assistant: {
        history: this.assistantHistory(),
      },
      automations: {
        paused: Boolean(this.store.getSetting("automation.paused", false)),
        definitions: this.store.listAutomations({ limit: 200 }),
        runs: this.store.listAutomationRuns({ limit: 100 }),
        templates: this.automations.templates(),
        schedulerError: this.store.getSetting("automation.scheduler.error", null),
      },
    };
  }

  async initializeDemo() {
    return initializeDemoProfile(this.store, {
      sourceRoot: path.join(this.appPath, "examples", "demo-workspace"),
      profileRoot: this.demoDirectory,
    });
  }

  async addProject() {
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const selected = await dialog.showOpenDialog(window, {
      title: "Import a project into BRACE",
      properties: ["openDirectory"],
    });
    if (selected.canceled || !selected.filePaths[0]) return null;
    return indexProject(this.store, {
      rootPath: selected.filePaths[0],
      embedder: this.embeddingAdapter(),
    });
  }

  async reindexProject(projectId: string, options: { suppressAutomation?: boolean } = {}) {
    const project = this.store.listProjects().find((item: any) => item.id === projectId);
    if (!project) throw new Error("Project not found.");
    const result = await indexProject(this.store, {
      rootPath: project.root_path,
      projectId: project.id,
      name: project.name,
      embedder: this.embeddingAdapter(),
    });
    if (!options.suppressAutomation) {
      await this.automations.dispatch("project.indexed", {
        projectId: project.id,
        title: project.name,
        scope: `project:${project.id}`,
        sourceCount: result?.sources || 0,
      });
    }
    return result;
  }

  async createMemory(input: any) {
    const result = this.store.createMemory(input || {});
    if (!result.duplicate) {
      await this.automations.dispatch("memory.created", {
        id: result.memory.id,
        title: result.memory.title,
        kind: result.memory.kind,
        scope: result.memory.scope,
        tags: result.memory.tags,
        sourceUri: result.memory.sourceUri,
      });
    }
    return result;
  }

  async createDecision(input: any) {
    const result = this.store.createDecision(input || {});
    await this.automations.dispatch("decision.created", {
      id: result.id,
      title: result.title,
      decision: result.decision,
      rationale: result.rationale,
      projectId: result.project_id,
      scope: result.project_id ? `project:${result.project_id}` : "global",
      status: result.status,
    });
    return result;
  }

  automationSnapshot() {
    return {
      paused: Boolean(this.store.getSetting("automation.paused", false)),
      definitions: this.store.listAutomations({ limit: 200 }),
      runs: this.store.listAutomationRuns({ limit: 100 }),
      templates: this.automations.templates(),
      schedulerError: this.store.getSetting("automation.scheduler.error", null),
    };
  }

  createAutomation(input: any) {
    return this.automations.create(input || {});
  }

  updateAutomation(id: string, input: any) {
    return this.automations.update(String(id || ""), input || {});
  }

  setAutomationEnabled(id: string, enabled: boolean) {
    return this.automations.setEnabled(String(id || ""), Boolean(enabled));
  }

  runAutomation(id: string, input: any = {}) {
    return this.automations.run(String(id || ""), {
      triggerType: "manual",
      payload: input?.payload || {},
      dryRun: Boolean(input?.dryRun),
    });
  }

  retryAutomationRun(runId: string, dryRun = false) {
    return this.automations.retry(String(runId || ""), Boolean(dryRun));
  }

  setAutomationsPaused(paused: boolean) {
    this.store.setSetting("automation.paused", Boolean(paused));
    this.store.setSetting("automation.scheduler.error", null);
    return this.automationSnapshot();
  }

  async deleteAutomation(id: string) {
    const automation = this.store.getAutomation(String(id || ""));
    if (!automation) return false;
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const approval = await dialog.showMessageBox(window, {
      type: "warning",
      title: "Delete this automation?",
      message: automation.name,
      detail: "The recipe will be removed. Existing run history remains as a local audit trail.",
      buttons: ["Cancel", "Delete automation"],
      defaultId: 0,
      cancelId: 0,
    });
    return approval.response === 1 ? this.automations.remove(automation.id) : false;
  }

  async installSkillFromDialog() {
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const selected = await dialog.showOpenDialog(window, {
      title: "Select a BRACE skill manifest",
      properties: ["openFile"],
      filters: [{ name: "BRACE skill manifest", extensions: ["json"] }],
    });
    if (selected.canceled || !selected.filePaths[0]) return null;
    const manifest = JSON.parse(fs.readFileSync(selected.filePaths[0], "utf8"));
    const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
    const approval = await dialog.showMessageBox(window, {
      type: "warning",
      title: `Install ${manifest.displayName || manifest.name || "BRACE skill"}?`,
      message: "Review the permissions requested by this declarative skill.",
      detail: permissions.length ? permissions.join("\n") : "This skill requests no permissions.",
      buttons: ["Cancel", "Install disabled"],
      defaultId: 0,
      cancelId: 0,
    });
    if (approval.response !== 1) return null;
    return installSkill(this.store, selected.filePaths[0], {
      installRoot: this.skillsDirectory,
      approvedPermissions: permissions,
      enabled: false,
    });
  }

  async exportData() {
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const selected = await dialog.showSaveDialog(window, {
      title: "Export BRACE data",
      defaultPath: `brace-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (selected.canceled || !selected.filePath) return null;
    fs.writeFileSync(selected.filePath, `${JSON.stringify(this.store.exportData(), null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    return { path: selected.filePath };
  }

  async createBackup() {
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const selected = await dialog.showOpenDialog(window, {
      title: "Choose a BRACE backup directory",
      properties: ["openDirectory", "createDirectory"],
    });
    if (selected.canceled || !selected.filePaths[0]) return null;
    const target = path.join(
      selected.filePaths[0],
      `brace-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite3`,
    );
    return this.store.backup(target);
  }

  async forgetMemory(id: string) {
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const memory = this.store.getMemory(id);
    if (!memory) return false;
    const approval = await dialog.showMessageBox(window, {
      type: "warning",
      title: "Forget this memory?",
      message: memory.title,
      detail: "BRACE will delete its content, evidence, and embeddings. A non-sensitive audit tombstone remains.",
      buttons: ["Cancel", "Forget memory"],
      defaultId: 0,
      cancelId: 0,
    });
    return approval.response === 1 ? this.store.forgetMemory(id) : false;
  }

  async deleteAll(confirmation: string) {
    if (confirmation !== "DELETE") throw new Error("Type DELETE to confirm local data deletion.");
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const approval = await dialog.showMessageBox(window, {
      type: "warning",
      title: "Delete all BRACE data?",
      message: "This removes the local memory database and demo profile.",
      detail: "Imported project files are not changed. Create a backup first if you may need this memory later.",
      buttons: ["Cancel", "Delete local BRACE data"],
      defaultId: 0,
      cancelId: 0,
    });
    if (approval.response !== 1) return false;
    this.store.deleteAll();
    if (fs.existsSync(this.demoDirectory)) {
      fs.rmSync(this.demoDirectory, { recursive: true, force: true });
    }
    this.installBundledSkills();
    return true;
  }

  runSkill(name: string, action: string, input: any) {
    return runSkillAction(this.store, name, action, input);
  }
}

export function registerBraceMemoryIpc(service: BraceMemoryService) {
  const trustedHandle = (channel: string, listener: (event: any, ...args: any[]) => any) => {
    ipcMain.handle(channel, (event, ...args: any[]) => {
      const window = (service as any).getWindow();
      assertTrustedIpcSender(event, {
        expectedWebContentsId: window && !window.isDestroyed()
          ? window.webContents.id
          : undefined,
      });
      const validated = validateIpcArguments(channel, args);
      return listener(event, ...validated);
    });
  };
  trustedHandle("brace:get-snapshot", () => service.snapshot());
  trustedHandle("brace:initialize-demo", async () => {
    await service.initializeDemo();
    return service.snapshot();
  });
  trustedHandle("brace:search", (_event, input: any) => service.search(input));
  trustedHandle("brace:list-memories", (_event, options: any) => service.store.listMemories(options || {}));
  trustedHandle("brace:get-memory", (_event, id: string) => service.store.getMemory(String(id || ""), { includeEvidence: true }));
  trustedHandle("brace:create-memory", (_event, input: any) => service.createMemory(input || {}));
  trustedHandle("brace:update-memory", (_event, id: string, changes: any) => service.store.updateMemory(String(id || ""), changes || {}));
  trustedHandle("brace:set-memory-pinned", (_event, id: string, pinned: boolean) =>
    service.store.setMemoryPinned(String(id || ""), Boolean(pinned)));
  trustedHandle("brace:resolve-memory-review", (_event, input: any) => service.store.resolveMemoryReview({
    leftId: String(input?.leftId || ""),
    rightId: String(input?.rightId || ""),
    outcome: String(input?.outcome || ""),
  }));
  trustedHandle("brace:forget-memory", (_event, id: string) => service.forgetMemory(String(id || "")));
  trustedHandle("brace:add-evidence", (_event, id: string, input: any) => service.store.addEvidence(String(id || ""), input || {}));
  trustedHandle("brace:list-timeline", (_event, options: any) => service.store.listTimeline(options || {}));
  trustedHandle("brace:create-decision", (_event, input: any) => service.createDecision(input || {}));
  trustedHandle("brace:get-graph", (_event, options: any) => service.store.graph(options || {}));
  trustedHandle("brace:add-project", () => service.addProject());
  trustedHandle("brace:reindex-project", (_event, projectId: string) => service.reindexProject(String(projectId || "")));
  trustedHandle("brace:install-skill", () => service.installSkillFromDialog());
  trustedHandle("brace:set-skill-enabled", (_event, name: string, enabled: boolean) => service.store.setSkillEnabled(String(name || ""), Boolean(enabled)));
  trustedHandle("brace:remove-skill", (_event, name: string) => service.store.removeSkill(String(name || "")));
  trustedHandle("brace:run-skill", (_event, name: string, action: string, input: any) => service.runSkill(String(name || ""), String(action || ""), input || {}));
  trustedHandle("brace:set-embedding-config", (_event, input: any) => {
    const adapter = input?.enabled
      ? createOllamaEmbeddingAdapter({ endpoint: input.endpoint, model: input.model })
      : null;
    const config = {
      enabled: Boolean(input?.enabled),
      endpoint: input?.endpoint || "http://127.0.0.1:11434",
      model: input?.model || "nomic-embed-text",
      resolvedModel: adapter?.model || null,
    };
    service.store.setSetting("embedding.ollama", config);
    return config;
  });
  trustedHandle("brace:export", () => service.exportData());
  trustedHandle("brace:backup", () => service.createBackup());
  trustedHandle("brace:delete-all", (_event, confirmation: string) => service.deleteAll(String(confirmation || "")));
  trustedHandle("brace:list-connectors", () => service.connectors.list());
  trustedHandle("brace:install-connector", (_event, id: ConnectorId, access: ConnectorAccess) =>
    service.connectors.install(id, access),
  );
  trustedHandle("brace:run-assistant", (_event, input: any) => service.runAssistant(input));
  trustedHandle("brace:clear-assistant-history", () => service.clearAssistantHistory());
  trustedHandle("brace:copy-text", (_event, value: unknown) => service.copyText(value));
  trustedHandle("brace:get-automations", () => service.automationSnapshot());
  trustedHandle("brace:create-automation", (_event, input: any) => service.createAutomation(input));
  trustedHandle("brace:update-automation", (_event, id: string, input: any) =>
    service.updateAutomation(String(id || ""), input),
  );
  trustedHandle("brace:set-automation-enabled", (_event, id: string, enabled: boolean) =>
    service.setAutomationEnabled(String(id || ""), Boolean(enabled)),
  );
  trustedHandle("brace:run-automation", (_event, id: string, input: any) =>
    service.runAutomation(String(id || ""), input || {}),
  );
  trustedHandle("brace:retry-automation-run", (_event, runId: string, dryRun: boolean) =>
    service.retryAutomationRun(String(runId || ""), Boolean(dryRun)),
  );
  trustedHandle("brace:delete-automation", (_event, id: string) =>
    service.deleteAutomation(String(id || "")),
  );
  trustedHandle("brace:set-automations-paused", (_event, paused: boolean) =>
    service.setAutomationsPaused(Boolean(paused)),
  );
}
