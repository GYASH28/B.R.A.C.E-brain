import { app, clipboard, dialog, ipcMain, powerMonitor, type BrowserWindow } from "electron";
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
import assistantContextModule from "../core/assistant-context-cache";
import databaseRecoveryModule from "../core/database-recovery";
import projectWatchModule from "../core/project-watch-service";
import importModule from "../core/import-adapters";
import {
  BraceConnectorService,
  type ConnectorAccess,
  type ConnectorId,
} from "./connector-service";
import { assertTrustedIpcSender } from "./ipc-trust";
import { parseIpcArguments } from "../src/shared/ipc/schemas";

const { MemoryStore, redactSecrets, SCHEMA_VERSION } = memoryModule as any;
const { indexProject } = projectModule as any;
const { createOllamaEmbeddingAdapter } = embeddingModule as any;
const { installSkill, runSkillAction } = skillModule as any;
const { initializeDemoProfile } = demoModule as any;
const { defaultDataRoot } = dataPathModule as any;
const { AutomationEngine } = automationModule as any;
const { AssistantContextCache } = assistantContextModule as any;
const { applyPendingRestore, inspectSqliteDatabase, stageRestore } = databaseRecoveryModule as any;
const { ProjectWatchService } = projectWatchModule as any;
const { executeImports, previewImports, publicPreview } = importModule as any;

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
  readonly projectWatcher: any;
  readonly lastRestore: any;
  private readonly appPath: string;
  private readonly getWindow: () => BrowserWindow | null;
  private readonly executablePath: string;
  private readonly assistantContexts: any;
  private automationTimer: ReturnType<typeof setInterval> | null = null;
  private readonly indexControllers = new Map<string, AbortController>();
  private taskHistory: any[] = [];
  private readonly pauseWatchersOnBattery = () => this.projectWatcher?.setResourcePaused(true);
  private readonly resumeWatchersOnPower = () => this.projectWatcher?.setResourcePaused(false);

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
    this.assistantContexts = new AssistantContextCache({ ttlMs: 5 * 60_000, maximum: 12 });
    this.lastRestore = applyPendingRestore(this.dataDirectory, this.databasePath, {
      maximumSchemaVersion: SCHEMA_VERSION,
    });
    this.store = new MemoryStore(this.databasePath);
    this.connectors = new BraceConnectorService({
      userDataPath: options.userDataPath,
      executablePath: this.executablePath,
      appPath: this.appPath,
      getWindow: this.getWindow,
    });
    this.automations = new AutomationEngine(this.store, {
      reindexProject: (projectId: string, options?: { signal?: AbortSignal }) => this.reindexProject(projectId, { suppressAutomation: true, signal: options?.signal }),
      runSkill: (name: string, action: string, input: any) => this.runSkill(name, action, input),
    });
    this.projectWatcher = new ProjectWatchService({
      onChange: (projectId: string) => this.reindexProject(projectId),
      onError: (projectId: string, error: any) => this.store.setSetting(`project.watch.error.${projectId}`, {
        message: redactSecrets(String(error?.message || "Background indexing failed.")).value.slice(0, 500),
        occurredAt: new Date().toISOString(),
      }),
    });
    for (const project of this.store.listProjects()) {
      if (!this.store.getSetting(`project.watch.enabled.${project.id}`, false)) continue;
      try { this.projectWatcher.enable({ id: project.id, rootPath: project.root_path }); }
      catch (error: any) { this.store.setSetting(`project.watch.error.${project.id}`, { message: redactSecrets(String(error?.message || "Watcher unavailable.")).value, occurredAt: new Date().toISOString() }); }
    }
    powerMonitor.on("on-battery", this.pauseWatchersOnBattery);
    powerMonitor.on("on-ac", this.resumeWatchersOnPower);
    powerMonitor.on("suspend", this.pauseWatchersOnBattery);
    powerMonitor.on("resume", this.resumeWatchersOnPower);
    this.installBundledSkills();
    this.automationTimer = setInterval(() => {
      void this.tickAutomations();
    }, 30_000);
    this.automationTimer.unref?.();
    void this.tickAutomations();
  }

  close() {
    for (const controller of this.indexControllers.values()) controller.abort();
    if (this.automationTimer) clearInterval(this.automationTimer);
    this.automationTimer = null;
    this.projectWatcher.close();
    powerMonitor.removeListener("on-battery", this.pauseWatchersOnBattery);
    powerMonitor.removeListener("on-ac", this.resumeWatchersOnPower);
    powerMonitor.removeListener("suspend", this.pauseWatchersOnBattery);
    powerMonitor.removeListener("resume", this.resumeWatchersOnPower);
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
    if (!query) return { mode: "lexical", memories: [], sources: [], embeddingModel: null, warning: null, diagnostics: { query, mode: "lexical", scope: "all active memory", projectId: null, since: null, embeddingModel: null } };
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
    const projectNames = new Map(this.store.listProjects().map((project: any) => [project.id, project.name]));
    return {
      mode,
      embeddingModel: mode === "lexical" ? null : adapter.model,
      warning,
      memories: memories.results,
      sources: sources.results.map((source: any) => ({
        ...source,
        projectName: projectNames.get(source.projectId) || null,
        title: source.sourceTitle,
        uri: source.sourceUri,
      })),
      diagnostics: {
        query,
        mode,
        scope: input?.scope || "all active memory",
        projectId: input?.projectId || null,
        since: input?.since || null,
        embeddingModel: mode === "lexical" ? null : adapter.model,
      },
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

  async prepareAssistantContext(input: any) {
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
    const providerPrompt = redactSecrets(prompt).value;
    return this.assistantContexts.prepare({
      client,
      prompt,
      providerPrompt,
      mode: context.mode,
      embeddingModel: context.embeddingModel,
      warning: context.warning,
      memories,
      sources,
    });
  }

  async runAssistant(input: any) {
    const client = String(input?.client || "codex");
    if (client !== "codex" && client !== "claude") {
      throw new Error("The embedded workspace currently supports detected Codex CLI or Claude Code clients.");
    }
    const prompt = String(input?.prompt || "").trim();
    if (!prompt) throw new Error("Ask BRACE a specific question.");
    if (prompt.length > 12_000) throw new Error("Keep one AI workspace turn under 12,000 characters.");
    const contextId = String(input?.contextId || "");
    const prepared = this.assistantContexts.get(contextId, { client, prompt });
    const memories = prepared.memories;
    const sources = prepared.sources;
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const clientLabel = client === "codex" ? "Codex CLI" : "Claude Code";
    const memoryKinds = [...new Set(memories.map((memory: any) => memory.kind).filter(Boolean))];
    const approval = await dialog.showMessageBox(window, {
      type: "question",
      title: `Send this turn to ${clientLabel}?`,
      message: `BRACE will send the ${memories.length} memories and ${sources.length} source excerpts you just previewed.`,
      detail: [
        "The prompt and exact previewed context will be sent through the selected client's configured model provider.",
        `Context categories: ${memoryKinds.join(", ") || "no durable memory"}. Source evidence: ${sources.length} excerpt${sources.length === 1 ? "" : "s"}.`,
        "The capsule is short-lived and consumed once. Changing the question or client requires a new preview.",
        "The client runs in BRACE's isolated read-only agent workspace and cannot edit imported projects from this surface.",
        "The prompt and final answer are saved in local AI Workspace history. They are not automatically promoted to durable memory.",
      ].join("\n\n"),
      buttons: ["Cancel", `Send to ${clientLabel}`],
      defaultId: 0,
      cancelId: 0,
    });
    if (approval.response !== 1) return { cancelled: true };
    const capsule = this.assistantContexts.consume(contextId, { client, prompt });
    const agentPrompt = [
      "You are operating inside the BRACE local-first AI Workspace.",
      "Answer the user's question using the supplied BRACE context when relevant.",
      "Keep durable memory and indexed source evidence separate. Cite brace-project URIs exactly when supplied.",
      "Do not claim to have inspected or changed files outside this supplied context. This turn is read-only.",
      `\nUSER QUESTION\n${capsule.providerPrompt}`,
      `\nDURABLE MEMORY\n${capsule.memories.length ? JSON.stringify(capsule.memories, null, 2) : "No matching durable memory."}`,
      `\nSOURCE EVIDENCE\n${capsule.sources.length ? JSON.stringify(capsule.sources, null, 2) : "No matching indexed source evidence."}`,
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
        mode: capsule.mode,
        embeddingModel: capsule.embeddingModel,
        memoryCount: capsule.memories.length,
        sourceCount: capsule.sources.length,
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
    this.assistantContexts.clear();
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
      organizations: this.store.listOrganizations()
        .map((organization: any) => this.store.getOrganizationOverview(organization.id)),
      projects: this.store.listProjects().map((project: any) => ({
        ...project,
        watch: {
          ...this.projectWatcher.status(project.id),
          error: this.store.getSetting(`project.watch.error.${project.id}`, null),
        },
      })),
      memories: this.store.listMemories({ limit: 100 }),
      supersededMemories: this.store.listMemories({ status: "superseded", limit: 100 }),
      memoryQuality: this.store.memoryQuality({ limit: 50 }),
      timeline: this.store.listTimeline({ limit: 100 }),
      // Keep the logical graph broad enough for large workspaces. The renderer
      // applies its own bounded level-of-detail projection before drawing.
      graph: this.store.graph({ limit: 2_000 }),
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
      tasks: this.taskHistory.slice(0, 20),
    };
  }

  async initializeDemo() {
    return initializeDemoProfile(this.store, {
      sourceRoot: path.join(this.appPath, "examples", "demo-workspace"),
      profileRoot: this.demoDirectory,
    });
  }

  updateTask(task: any) {
    const next = { ...task, updatedAt: new Date().toISOString() };
    this.taskHistory = [next, ...this.taskHistory.filter((item) => item.id !== next.id)].slice(0, 20);
    const window = this.getWindow();
    if (window && !window.isDestroyed()) window.webContents.send("brace:task-progress", next);
    return next;
  }

  async runIndexTask(input: any) {
    const id = randomUUID();
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    if (input.signal?.aborted) controller.abort();
    else input.signal?.addEventListener?.("abort", forwardAbort, { once: true });
    this.indexControllers.set(id, controller);
    let task = this.updateTask({
      id,
      type: "project.index",
      title: `Index ${input.name || path.basename(input.rootPath)}`,
      status: "running",
      phase: "scanning",
      completed: 0,
      total: 0,
      startedAt: new Date().toISOString(),
      cancellable: true,
    });
    try {
      const result = await indexProject(this.store, {
        ...input,
        signal: controller.signal,
        onProgress: (progress: any) => {
          task = this.updateTask({ ...task, ...progress, status: "running" });
        },
      });
      this.updateTask({
        ...task,
        status: result.status,
        phase: result.status,
        completed: result.filesSeen,
        total: result.filesSeen,
        cancellable: false,
        result: {
          indexed: result.indexed,
          unchanged: result.unchanged,
          errors: result.errors,
          redacted: result.redacted,
          embedded: result.embedded,
        },
      });
      return result;
    } catch (error: any) {
      const cancelled = controller.signal.aborted || /cancel/i.test(String(error?.message || ""));
      this.updateTask({
        ...task,
        status: cancelled ? "cancelled" : "failed",
        phase: cancelled ? "cancelled" : "failed",
        cancellable: false,
        error: cancelled ? null : redactSecrets(String(error?.message || "Indexing failed.")).value.slice(0, 500),
      });
      throw error;
    } finally {
      input.signal?.removeEventListener?.("abort", forwardAbort);
      this.indexControllers.delete(id);
    }
  }

  cancelTask(id: string) {
    const controller = this.indexControllers.get(String(id || ""));
    if (!controller) return false;
    controller.abort();
    return true;
  }

  async addProject() {
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const selected = await dialog.showOpenDialog(window, {
      title: "Import a project into BRACE",
      properties: ["openDirectory"],
    });
    if (selected.canceled || !selected.filePaths[0]) return null;
    return this.runIndexTask({
      rootPath: selected.filePaths[0],
      embedder: this.embeddingAdapter(),
    });
  }

  async reindexProject(projectId: string, options: { suppressAutomation?: boolean; signal?: AbortSignal } = {}) {
    const project = this.store.listProjects().find((item: any) => item.id === projectId);
    if (!project) throw new Error("Project not found.");
    const result = await this.runIndexTask({
      rootPath: project.root_path,
      projectId: project.id,
      name: project.name,
      embedder: this.embeddingAdapter(),
      signal: options.signal,
    });
    if (!options.suppressAutomation) {
      await this.automations.dispatch("project.indexed", {
        projectId: project.id,
        title: project.name,
        scope: `project:${project.id}`,
        sourceCount: result?.filesSeen || 0,
      });
    }
    return result;
  }

  setProjectWatch(projectId: string, enabled: boolean) {
    const project = this.store.listProjects().find((item: any) => item.id === String(projectId || ""));
    if (!project) throw new Error("Project not found.");
    if (enabled) {
      this.projectWatcher.enable({ id: project.id, rootPath: project.root_path });
      this.store.setSetting(`project.watch.error.${project.id}`, null);
    } else {
      this.projectWatcher.disable(project.id);
    }
    this.store.setSetting(`project.watch.enabled.${project.id}`, Boolean(enabled));
    return this.projectWatcher.status(project.id);
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

  async exportAutomations(id?: string) {
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const definitions = id
      ? [this.store.getAutomation(String(id || ""))].filter(Boolean)
      : this.store.listAutomations({ limit: 500 });
    if (!definitions.length) throw new Error("There are no automation recipes to export.");
    const selected = await dialog.showSaveDialog(window, {
      title: definitions.length === 1 ? "Export BRACE automation" : "Export BRACE automations",
      defaultPath: definitions.length === 1
        ? `brace-automation-${String(definitions[0].name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "recipe"}.json`
        : `brace-automations-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "BRACE automation recipes", extensions: ["json"] }],
    });
    if (selected.canceled || !selected.filePath) return null;
    const portable = definitions.map(({ id: _id, createdAt: _createdAt, updatedAt: _updatedAt, lastRunAt: _lastRunAt, nextRunAt: _nextRunAt, ...definition }: any) => ({
      ...definition,
      enabled: false,
    }));
    fs.writeFileSync(selected.filePath, `${JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), recipes: portable }, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    return { count: portable.length, path: selected.filePath };
  }

  async importAutomations() {
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const selected = await dialog.showOpenDialog(window, {
      title: "Import BRACE automation recipes",
      properties: ["openFile"],
      filters: [{ name: "BRACE automation recipes", extensions: ["json"] }],
    });
    if (selected.canceled || !selected.filePaths[0]) return null;
    const stats = fs.statSync(selected.filePaths[0]);
    if (stats.size > 1_000_000) throw new Error("Automation imports must be smaller than 1 MB.");
    const parsed = JSON.parse(fs.readFileSync(selected.filePaths[0], "utf8"));
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed?.recipes) || !parsed.recipes.length || parsed.recipes.length > 100) {
      throw new Error("Choose a version 1 BRACE automation export containing 1–100 recipes.");
    }
    const validated = parsed.recipes.map((recipe: any) => this.automations.validate({ ...recipe, enabled: false }));
    const permissions = [...new Set(validated.flatMap((recipe: any) => recipe.permissions))];
    const approval = await dialog.showMessageBox(window, {
      type: "question",
      title: `Import ${validated.length} automation recipe${validated.length === 1 ? "" : "s"}?`,
      message: "Imported recipes will start paused.",
      detail: `Names: ${validated.map((recipe: any) => recipe.name).join(", ")}\n\nCapabilities: ${permissions.join(", ") || "No mutating capabilities"}\n\nNo recipe can execute arbitrary code or network requests.`,
      buttons: ["Cancel", "Import paused"],
      defaultId: 0,
      cancelId: 0,
    });
    if (approval.response !== 1) return null;
    const created = validated.map((recipe: any) => this.automations.create({ ...recipe, enabled: false }));
    return { count: created.length, ids: created.map((recipe: any) => recipe.id) };
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

  async importContent() {
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const selected = await dialog.showOpenDialog(window, {
      title: "Import local documents or a BRACE profile",
      properties: ["openFile", "openDirectory", "multiSelections"],
      filters: [
        { name: "BRACE, Markdown, and text", extensions: ["json", "md", "markdown", "txt"] },
      ],
    });
    if (selected.canceled || !selected.filePaths.length) return null;
    const preview = previewImports(selected.filePaths);
    if (!preview.entries.length) throw new Error("No supported BRACE export, Markdown, or plain-text content was found.");
    const visible = publicPreview(preview);
    const approval = await dialog.showMessageBox(window, {
      type: "question",
      title: "Import this local content?",
      message: `${visible.summary.documents} document${visible.summary.documents === 1 ? "" : "s"} and ${visible.summary.memories} active memor${visible.summary.memories === 1 ? "y" : "ies"} are ready.`,
      detail: [
        ...visible.entries.slice(0, 20).map((entry: any) => `• ${entry.name} — ${entry.kind === "brace-profile" ? `${entry.counts.activeMemories} active memories` : `${entry.bytes.toLocaleString()} bytes`}`),
        ...(visible.entries.length > 20 ? [`• …and ${visible.entries.length - 20} more`] : []),
        ...(visible.summary.unsupported ? [`\n${visible.summary.unsupported} unsupported or excluded item${visible.summary.unsupported === 1 ? "" : "s"} will be skipped.`] : []),
        "\nOriginal files remain untouched. Secret-like document values are redacted before indexing. Only active memories are imported from profiles; projects and machine-specific paths are not recreated.",
      ].join("\n"),
      buttons: ["Cancel", "Import locally"],
      defaultId: 0,
      cancelId: 0,
    });
    if (approval.response !== 1) return null;
    const recoveryDirectory = path.join(this.dataDirectory, "recovery");
    fs.mkdirSync(recoveryDirectory, { recursive: true, mode: 0o700 });
    const safetyPath = path.join(recoveryDirectory, `brace-pre-import-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite3`);
    await this.store.backup(safetyPath);
    fs.chmodSync(safetyPath, 0o600);
    const result = executeImports(this.store, preview);
    return { ...result, preview: visible, safetyBackupCreated: true };
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

  async databaseDiagnostics() {
    const check = this.store.db.prepare("PRAGMA quick_check").all().map((row: Record<string, unknown>) => String(row.quick_check));
    const connectors = await this.connectors.list();
    return {
      integrity: check.length === 1 && check[0] === "ok" ? "ok" : "attention",
      details: check,
      schemaVersion: Number(this.store.db.prepare("PRAGMA user_version").get().user_version || 0),
      stats: this.store.stats(),
      appVersion: app.getVersion(),
      platform: `${process.platform} ${process.arch}`,
      databasePath: this.databasePath,
      projectIndex: this.store.listProjects().map((project: any) => ({
        id: project.id,
        lastIndexedAt: project.last_indexed_at,
      })),
      embedding: {
        enabled: Boolean(this.embeddingAdapter()),
        provider: this.embeddingAdapter()?.id || null,
        model: this.embeddingAdapter()?.model || null,
      },
      connectors: connectors.map((connector) => ({
        id: connector.id,
        detected: connector.detected,
        configured: connector.configured,
        version: connector.version,
      })),
      scheduler: {
        paused: Boolean(this.store.getSetting("automation.paused", false)),
        error: this.store.getSetting("automation.scheduler.error", null),
      },
      checkedAt: new Date().toISOString(),
    };
  }

  async saveSupportBundle() {
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const diagnostics = await this.databaseDiagnostics();
    const bundle = {
      generatedAt: new Date().toISOString(),
      disclosure: "Local diagnostic metadata only. Memory titles/content, source content, project names/paths, credentials, and logs are excluded.",
      app: { version: diagnostics.appVersion, platform: diagnostics.platform },
      database: {
        integrity: diagnostics.integrity,
        details: diagnostics.details,
        schemaVersion: diagnostics.schemaVersion,
        stats: diagnostics.stats,
        path: "[system application-data]/brace.sqlite3",
      },
      projects: diagnostics.projectIndex,
      embedding: diagnostics.embedding,
      connectors: diagnostics.connectors,
      scheduler: diagnostics.scheduler,
      tasks: this.taskHistory.slice(0, 20).map((task) => ({
        type: task.type,
        status: task.status,
        phase: task.phase,
        completed: task.completed,
        total: task.total,
        startedAt: task.startedAt,
        updatedAt: task.updatedAt,
        result: task.result || null,
        error: task.error ? redactSecrets(String(task.error)).value : null,
      })),
    };
    const approval = await dialog.showMessageBox(window, {
      type: "info",
      title: "Save a privacy-safe support bundle?",
      message: "Preview of included data",
      detail: [
        "Included: app/OS version, database integrity and counts, project IDs/index timestamps, connector states, scheduler state, and sanitized task outcomes.",
        "Excluded: memory and source content, titles, project names and paths, credentials, raw provider responses, and log files.",
        "Nothing is uploaded automatically.",
      ].join("\n\n"),
      buttons: ["Cancel", "Choose save location"],
      defaultId: 0,
      cancelId: 0,
    });
    if (approval.response !== 1) return null;
    const selected = await dialog.showSaveDialog(window, {
      title: "Save BRACE support bundle",
      defaultPath: `brace-support-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (selected.canceled || !selected.filePath) return null;
    fs.writeFileSync(selected.filePath, `${JSON.stringify(bundle, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    return { path: selected.filePath, included: Object.keys(bundle), uploaded: false };
  }

  async restoreBackup() {
    const window = this.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const selected = await dialog.showOpenDialog(window, {
      title: "Choose a BRACE SQLite backup to restore",
      properties: ["openFile"],
      filters: [{ name: "BRACE SQLite backup", extensions: ["sqlite3", "sqlite", "db"] }],
    });
    if (selected.canceled || !selected.filePaths[0]) return null;
    const preview = inspectSqliteDatabase(selected.filePaths[0]);
    const approval = await dialog.showMessageBox(window, {
      type: "warning",
      title: "Restore this BRACE backup?",
      message: `Schema ${preview.schemaVersion} · ${preview.counts.memories.toLocaleString()} memories · ${preview.counts.sources.toLocaleString()} sources`,
      detail: "BRACE verified the selected database. The current database will be moved to a timestamped recovery file before the restore, then BRACE will restart.",
      buttons: ["Cancel", "Restore and restart"],
      defaultId: 0,
      cancelId: 0,
    });
    if (approval.response !== 1) return null;
    const recoveryDirectory = path.join(this.dataDirectory, "recovery");
    fs.mkdirSync(recoveryDirectory, { recursive: true, mode: 0o700 });
    const safetyPath = path.join(recoveryDirectory, `brace-pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite3`);
    await this.store.backup(safetyPath);
    const result = stageRestore(this.dataDirectory, selected.filePaths[0], { maximumSchemaVersion: SCHEMA_VERSION });
    setTimeout(() => {
      this.close();
      app.relaunch();
      app.exit(0);
    }, 250);
    return { ...result, safetyPath, restarting: true };
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
  type IpcHandler = Parameters<typeof ipcMain.handle>[1];
  const trustedHandle = (channel: string, listener: IpcHandler) => {
    ipcMain.handle(channel, (event, ...args) => {
      assertTrustedIpcSender(event);
      const validated = parseIpcArguments(channel, args);
      return listener(event, ...validated);
    });
  };

  trustedHandle("brace:get-snapshot", () => service.snapshot());
  trustedHandle("brace:initialize-demo", async () => {
    await service.initializeDemo();
    return service.snapshot();
  });
  trustedHandle("brace:create-organization", (_event, input: any) => service.store.createOrganization(input || {}));
  trustedHandle("brace:create-workspace", (_event, input: any) => service.store.createWorkspace(input || {}));
  trustedHandle("brace:upsert-workspace-member", (_event, input: any) => service.store.upsertWorkspaceMember(input || {}));
  trustedHandle("brace:cancel-task", (_event, id: string) => service.cancelTask(String(id || "")));
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
  trustedHandle("brace:restore-memory", (_event, id: string) => service.store.restoreSupersededMemory(String(id || "")));
  trustedHandle("brace:forget-memory", (_event, id: string) => service.forgetMemory(String(id || "")));
  trustedHandle("brace:add-evidence", (_event, id: string, input: any) => service.store.addEvidence(String(id || ""), input || {}));
  trustedHandle("brace:set-evidence-outcome", (_event, memoryId: string, evidenceId: string, outcome: string) => service.store.setEvidenceOutcome(String(memoryId || ""), String(evidenceId || ""), String(outcome || "")));
  trustedHandle("brace:list-timeline", (_event, options: any) => service.store.listTimeline(options || {}));
  trustedHandle("brace:create-decision", (_event, input: any) => service.createDecision(input || {}));
  trustedHandle("brace:get-graph", (_event, options: any) => service.store.graph(options || {}));
  trustedHandle("brace:add-project", () => service.addProject());
  trustedHandle("brace:reindex-project", (_event, projectId: string) => service.reindexProject(String(projectId || "")));
  trustedHandle("brace:set-project-watch", (_event, projectId: string, enabled: boolean) => service.setProjectWatch(String(projectId || ""), Boolean(enabled)));
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
  trustedHandle("brace:import-content", () => service.importContent());
  trustedHandle("brace:backup", () => service.createBackup());
  trustedHandle("brace:diagnostics", () => service.databaseDiagnostics());
  trustedHandle("brace:save-support-bundle", () => service.saveSupportBundle());
  trustedHandle("brace:restore-backup", () => service.restoreBackup());
  trustedHandle("brace:delete-all", (_event, confirmation: string) => service.deleteAll(String(confirmation || "")));
  trustedHandle("brace:list-connectors", () => service.connectors.list());
  trustedHandle("brace:install-connector", (_event, id: ConnectorId, access: ConnectorAccess) =>
    service.connectors.install(id, access),
  );
  trustedHandle("brace:restore-connector", (_event, id: ConnectorId) =>
    service.connectors.restorePrevious(id),
  );
  trustedHandle("brace:prepare-assistant-context", (_event, input: any) => service.prepareAssistantContext(input));
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
  trustedHandle("brace:export-automations", (_event, id?: string) => service.exportAutomations(id));
  trustedHandle("brace:import-automations", () => service.importAutomations());
  trustedHandle("brace:delete-automation", (_event, id: string) =>
    service.deleteAutomation(String(id || "")),
  );
  trustedHandle("brace:set-automations-paused", (_event, paused: boolean) =>
    service.setAutomationsPaused(Boolean(paused)),
  );
}
