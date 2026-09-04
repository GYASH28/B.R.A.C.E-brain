#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const write = (relative, value) => fs.writeFileSync(path.join(root, relative), value.replace(/\r\n/g, "\n"));
const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Assistant boundary patch could not locate ${label}.`);
  return source.replace(search, replacement);
};

let service = read("electron/memory-service.ts");
if (!service.includes('assistantContextModule from "../core/assistant-context-cache"')) {
  service = replaceRequired(
    service,
    'import automationModule from "../core/automation-engine";\n',
    'import automationModule from "../core/automation-engine";\nimport assistantContextModule from "../core/assistant-context-cache";\n',
    "assistant context import",
  );
  service = replaceRequired(
    service,
    'const { AutomationEngine } = automationModule as any;\n',
    'const { AutomationEngine } = automationModule as any;\nconst { AssistantContextCache } = assistantContextModule as any;\n',
    "assistant context module",
  );
}
if (!service.includes("private readonly assistantContexts")) {
  service = replaceRequired(
    service,
    '  private readonly executablePath: string;\n',
    '  private readonly executablePath: string;\n  private readonly assistantContexts: any;\n',
    "assistant context field",
  );
  service = replaceRequired(
    service,
    '    fs.mkdirSync(this.profileWorkspacePath, { recursive: true });\n',
    '    fs.mkdirSync(this.profileWorkspacePath, { recursive: true });\n    this.assistantContexts = new AssistantContextCache({ ttlMs: 5 * 60_000, maximum: 12 });\n',
    "assistant context initialization",
  );
}
if (!service.includes("async prepareAssistantContext(input: any)")) {
  service = replaceRequired(
    service,
    '  async runAssistant(input: any) {\n',
    `  async prepareAssistantContext(input: any) {\n    const client = String(input?.client || "codex");\n    if (client !== "codex" && client !== "claude") {\n      throw new Error("The embedded workspace currently supports detected Codex CLI or Claude Code clients.");\n    }\n    const prompt = String(input?.prompt || "").trim();\n    if (!prompt) throw new Error("Ask BRACE a specific question.");\n    if (prompt.length > 12_000) throw new Error("Keep one AI workspace turn under 12,000 characters.");\n    const context = await this.search({ query: prompt, limit: 6 });\n    const memories = context.memories.slice(0, 6).map((memory: any) => ({\n      title: memory.title,\n      kind: memory.kind,\n      summary: String(memory.summary || memory.content || "").slice(0, 900),\n      sourceUri: memory.sourceUri || null,\n    }));\n    const sources = context.sources.slice(0, 6).map((source: any) => ({\n      title: source.heading || source.title,\n      uri: source.uri,\n      excerpt: String(source.content || "").slice(0, 1_000),\n    }));\n    const providerPrompt = redactSecrets(prompt).value;\n    return this.assistantContexts.prepare({\n      client,\n      prompt,\n      providerPrompt,\n      mode: context.mode,\n      embeddingModel: context.embeddingModel,\n      warning: context.warning,\n      memories,\n      sources,\n    });\n  }\n\n  async runAssistant(input: any) {\n`,
    "runAssistant method",
  );
}
const oldContextBlock = `    const context = await this.search({ query: prompt, limit: 6 });\n    const memories = context.memories.slice(0, 6).map((memory: any) => ({\n      title: memory.title,\n      kind: memory.kind,\n      summary: String(memory.summary || memory.content || "").slice(0, 900),\n      sourceUri: memory.sourceUri || null,\n    }));\n    const sources = context.sources.slice(0, 6).map((source: any) => ({\n      title: source.heading || source.title,\n      uri: source.uri,\n      excerpt: String(source.content || "").slice(0, 1_000),\n    }));\n`;
if (service.includes(oldContextBlock)) {
  service = service.replace(oldContextBlock, `    const contextId = String(input?.contextId || "");\n    const prepared = this.assistantContexts.get(contextId, { client, prompt });\n    const context = {\n      mode: prepared.mode,\n      embeddingModel: prepared.embeddingModel,\n      warning: prepared.warning,\n    };\n    const memories = prepared.memories;\n    const sources = prepared.sources;\n`);
}
if (!service.includes("const capsule = this.assistantContexts.consume")) {
  service = replaceRequired(
    service,
    '    if (approval.response !== 1) return { cancelled: true };\n    const agentPrompt = [\n',
    '    if (approval.response !== 1) return { cancelled: true };\n    const capsule = this.assistantContexts.consume(contextId, { client, prompt });\n    const agentPrompt = [\n',
    "assistant approval boundary",
  );
  service = replaceRequired(service, '`\\nUSER QUESTION\\n${prompt}`,', '`\\nUSER QUESTION\\n${capsule.providerPrompt}`,', "provider prompt");
  service = replaceRequired(service, '${memories.length ? JSON.stringify(memories, null, 2) : "No matching durable memory."}', '${capsule.memories.length ? JSON.stringify(capsule.memories, null, 2) : "No matching durable memory."}', "memory capsule send");
  service = replaceRequired(service, '${sources.length ? JSON.stringify(sources, null, 2) : "No matching indexed source evidence."}', '${capsule.sources.length ? JSON.stringify(capsule.sources, null, 2) : "No matching indexed source evidence."}', "source capsule send");
}
if (!service.includes('ipcMain.handle("brace:prepare-assistant-context"')) {
  service = replaceRequired(
    service,
    '  ipcMain.handle("brace:run-assistant", (_event, input: any) => service.runAssistant(input));\n',
    '  ipcMain.handle("brace:prepare-assistant-context", (_event, input: any) => service.prepareAssistantContext(input));\n  ipcMain.handle("brace:run-assistant", (_event, input: any) => service.runAssistant(input));\n',
    "assistant IPC registration",
  );
}
if (!service.includes("this.assistantContexts.clear();")) {
  service = replaceRequired(
    service,
    '    this.store.setSetting("assistant.conversations", []);\n    return true;\n',
    '    this.store.setSetting("assistant.conversations", []);\n    this.assistantContexts.clear();\n    return true;\n',
    "assistant context clear",
  );
}
write("electron/memory-service.ts", service);

let preload = read("electron/preload.ts");
if (!preload.includes("prepareBraceAssistantContext")) {
  preload = replaceRequired(
    preload,
    '  runBraceAssistant: (input: unknown) =>\n    ipcRenderer.invoke("brace:run-assistant", input),\n',
    '  prepareBraceAssistantContext: (input: unknown) =>\n    ipcRenderer.invoke("brace:prepare-assistant-context", input),\n  runBraceAssistant: (input: unknown) =>\n    ipcRenderer.invoke("brace:run-assistant", input),\n',
    "assistant preload API",
  );
}
write("electron/preload.ts", preload);

let types = read("src/lib/brace/types.ts");
if (!types.includes("export interface AssistantContextPreview")) {
  types = replaceRequired(
    types,
    'export interface AssistantTurn {\n',
    `export interface AssistantContextPreview {\n  id: string;\n  client: "codex" | "claude";\n  prompt: string;\n  promptRedacted: boolean;\n  mode: "lexical" | "semantic" | "hybrid";\n  embeddingModel: string | null;\n  warning: string | null;\n  preparedAt: string;\n  expiresAt: string;\n  memories: Array<{ title: string; kind: string; summary: string; sourceUri: string | null }>;\n  sources: Array<{ title: string; uri: string; excerpt: string }>;\n}\n\nexport interface AssistantTurn {\n`,
    "assistant preview type",
  );
  types = replaceRequired(
    types,
    '  runBraceAssistant: (input: {\n    client: "codex" | "claude";\n    prompt: string;\n  }) => Promise<{ cancelled: boolean; turn?: AssistantTurn }>;\n',
    '  prepareBraceAssistantContext: (input: { client: "codex" | "claude"; prompt: string }) => Promise<AssistantContextPreview>;\n  runBraceAssistant: (input: {\n    client: "codex" | "claude";\n    prompt: string;\n    contextId: string;\n  }) => Promise<{ cancelled: boolean; turn?: AssistantTurn }>;\n',
    "assistant electron API type",
  );
}
write("src/lib/brace/types.ts", types);

let store = read("src/lib/brace/store.ts");
if (!store.includes("AssistantContextPreview")) {
  store = replaceRequired(store, '  BraceAutomation,\n', '  BraceAutomation,\n  AssistantContextPreview,\n', "assistant preview store import");
  store = replaceRequired(store, '  assistantDraft: string;\n', '  assistantDraft: string;\n  assistantPreview: AssistantContextPreview | null;\n', "assistant preview state");
  store = replaceRequired(store, '  runAssistant: (client: "codex" | "claude", prompt: string) => Promise<void>;\n', '  prepareAssistant: (client: "codex" | "claude", prompt: string) => Promise<void>;\n  runAssistant: (client: "codex" | "claude", prompt: string) => Promise<void>;\n', "assistant preview action");
  store = replaceRequired(store, '    assistantDraft: "",\n', '    assistantDraft: "",\n    assistantPreview: null,\n', "assistant preview initial state");
  store = replaceRequired(
    store,
    '    setAssistantDraft: (assistantDraft) => set({ assistantDraft }),\n',
    '    setAssistantDraft: (assistantDraft) => set((state) => ({ assistantDraft, assistantPreview: state.assistantPreview?.prompt === assistantDraft ? state.assistantPreview : null })),\n',
    "assistant draft invalidation",
  );
  store = replaceRequired(
    store,
    '    runAssistant: async (client, prompt) =>\n',
    `    prepareAssistant: async (client, prompt) =>\n      perform("Preparing exact context…", async () => {\n        const api = desktop();\n        if (!api?.prepareBraceAssistantContext) {\n          throw new Error("Context preview is available in the desktop app.");\n        }\n        const assistantPreview = await api.prepareBraceAssistantContext({ client, prompt });\n        set({ assistantPreview, notice: "Context capsule prepared locally. Review it before sending." });\n      }),\n    runAssistant: async (client, prompt) =>\n`,
    "assistant prepare action",
  );
  store = replaceRequired(
    store,
    '        const result = await api.runBraceAssistant({ client, prompt });\n',
    `        const preview = get().assistantPreview;\n        if (!preview || preview.client !== client || preview.prompt !== prompt) {\n          throw new Error("Preview the exact context capsule for this question and client before sending.");\n        }\n        const result = await api.runBraceAssistant({ client, prompt, contextId: preview.id });\n`,
    "assistant send capsule",
  );
  store = replaceRequired(
    store,
    '        set({ notice: "Answer received. Nothing was added to durable memory automatically." });\n',
    '        set({ assistantPreview: null, notice: "Answer received. Nothing was added to durable memory automatically." });\n',
    "assistant preview consumption UI state",
  );
}
write("src/lib/brace/store.ts", store);

let app = read("src/components/brace/brace-app.tsx");
if (!app.includes("prepareAssistant, assistantPreview")) {
  app = replaceRequired(
    app,
    '  const { snapshot, connectors, assistantDraft, setAssistantDraft, runAssistant, clearAssistantHistory, createMemory, setView } = useBrace();\n',
    '  const { snapshot, connectors, assistantDraft, setAssistantDraft, prepareAssistant, assistantPreview, runAssistant, clearAssistantHistory, createMemory, setView } = useBrace();\n',
    "assistant workspace state",
  );
  app = replaceRequired(
    app,
    '  if (!snapshot) return null;\n  const submit = async (event: FormEvent) => {\n',
    '  if (!snapshot) return null;\n  const previewReady = Boolean(assistantPreview && assistantPreview.client === client && assistantPreview.prompt === assistantDraft);\n  const submit = async (event: FormEvent) => {\n',
    "assistant preview readiness",
  );
  app = replaceRequired(
    app,
    '<div className="ai-boundary"><ShieldCheck className="h-4 w-4" /><span><strong>Every turn has a visible boundary.</strong> BRACE previews how many memory and source records will be sent. Retrieved context may be sent to the selected provider. Imported projects cannot be edited from this surface.</span></div>',
    '<div className="ai-boundary"><ShieldCheck className="h-4 w-4" /><span><strong>Every turn has a visible boundary.</strong> Preview the exact memory summaries and source excerpts first. Send consumes that same short-lived capsule once; changing the question or client invalidates it.</span></div>',
    "assistant boundary copy",
  );
  app = replaceRequired(
    app,
    '<div><label><span className="sr-only">AI client</span><select value={client} onChange={(event) => setClient(event.target.value as "codex" | "claude")} disabled={!available.length}>{available.map((connector) => <option key={connector.id} value={connector.id}>{connector.name}</option>)}</select></label><span>{assistantDraft ? "Draft stays on this device until you send it." : "Context is selected locally before the provider boundary."}</span><button type="submit" disabled={!available.length || !assistantDraft.trim()} className="brace-primary">Send<CornerDownLeft className="h-3.5 w-3.5" /></button></div>',
    '<div><label><span className="sr-only">AI client</span><select value={client} onChange={(event) => setClient(event.target.value as "codex" | "claude")} disabled={!available.length}>{available.map((connector) => <option key={connector.id} value={connector.id}>{connector.name}</option>)}</select></label><span>{previewReady ? "The exact capsule shown at right is ready for one send." : assistantDraft ? "Preview the exact local context before crossing the provider boundary." : "Your draft stays on this device until you choose to send."}</span><button type="button" disabled={!available.length || !assistantDraft.trim()} className="brace-secondary" onClick={() => void prepareAssistant(client, assistantDraft)}>Preview context</button><button type="submit" disabled={!available.length || !assistantDraft.trim() || !previewReady} className="brace-primary">Send<CornerDownLeft className="h-3.5 w-3.5" /></button></div>',
    "assistant composer controls",
  );
  app = replaceRequired(
    app,
    '<section><span>LAST CONTEXT CAPSULE</span>{latest ? <><strong>{latest.context.memoryCount + latest.context.sourceCount}</strong><p>{latest.context.memoryCount} durable memories<br />{latest.context.sourceCount} source excerpts<br />{latest.context.embeddingModel || "Lexical retrieval"}</p></> : <p>No turn prepared yet.</p>}</section>',
    '<section><span>EXACT CONTEXT CAPSULE</span>{previewReady && assistantPreview ? <><strong>{assistantPreview.memories.length + assistantPreview.sources.length}</strong><p>{assistantPreview.mode} retrieval · {assistantPreview.embeddingModel || "lexical only"}<br />Expires {new Date(assistantPreview.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{assistantPreview.promptRedacted ? <><br /><b className="text-amber-200/70">Sensitive prompt patterns will be redacted before provider send.</b></> : null}</p><div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">{assistantPreview.memories.map((memory, index) => <div key={`memory-${index}`} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2"><small className="text-[9px] uppercase tracking-wider text-sky-200/55">Memory · {memory.kind}</small><strong className="mt-1 block text-[11px] text-white/75">{memory.title}</strong><p className="mt-1 text-[10px] leading-4 text-white/35">{memory.summary}</p>{memory.sourceUri && <code className="mt-1 block truncate text-[9px] text-white/22">{memory.sourceUri}</code>}</div>)}{assistantPreview.sources.map((source, index) => <div key={`source-${index}`} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2"><small className="text-[9px] uppercase tracking-wider text-emerald-200/55">Source evidence</small><strong className="mt-1 block text-[11px] text-white/75">{source.title}</strong><p className="mt-1 text-[10px] leading-4 text-white/35">{source.excerpt}</p><code className="mt-1 block truncate text-[9px] text-white/22">{source.uri}</code></div>)}</div></> : latest ? <><strong>{latest.context.memoryCount + latest.context.sourceCount}</strong><p>Last sent turn: {latest.context.memoryCount} memories · {latest.context.sourceCount} source excerpts. Prepare the current draft to inspect the next exact capsule.</p></> : <p>No context is prepared. Write a question and choose Preview context.</p>}</section>',
    "assistant exact capsule rail",
  );
}
write("src/components/brace/brace-app.tsx", app);

process.stdout.write("Applied exact Ask BRACE provider-boundary preview.\n");
