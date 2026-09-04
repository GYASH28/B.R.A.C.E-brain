import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Found ${label} more than once.`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function patchFile(filePath, transforms) {
  let source = fs.readFileSync(filePath, "utf8");
  for (const [before, after, label] of transforms) source = replaceOnce(source, before, after, label);
  fs.writeFileSync(filePath, source);
}

patchFile("electron/connector-service.ts", [
  [
    'import { promisify } from "node:util";',
    'import { promisify } from "node:util";\nimport connectorHealthModule from "../core/connector-health";',
    "connector health import",
  ],
  [
    'const execFileAsync = promisify(execFile);',
    'const execFileAsync = promisify(execFile);\nconst { connectorHealth, inspectJsonConfig, loadJsonConfigForWrite } = connectorHealthModule as any;',
    "connector health helpers",
  ],
  [
    'function readJson(filePath: string, fallback: any) {\n  try {\n    return JSON.parse(fs.readFileSync(filePath, "utf8"));\n  } catch {\n    return fallback;\n  }\n}',
    '// JSON connector files are inspected explicitly so malformed configuration is never treated as empty.',
    "legacy JSON fallback",
  ],
  [
    '  private claudeConfigured() {\n    const filePath = this.clientConfigPath("claude");\n    if (!filePath || !fs.existsSync(filePath)) return false;\n    const config = readJson(filePath, {});\n    const pools = [config?.mcpServers, config?.user?.mcpServers];',
    '  private claudeConfigured() {\n    const filePath = this.clientConfigPath("claude");\n    if (!filePath) return false;\n    const state = inspectJsonConfig(filePath);\n    if (!state.valid || !state.exists) return false;\n    const config = state.value || {};\n    const pools = [config?.mcpServers, config?.user?.mcpServers];',
    "Claude configuration validation",
  ],
  [
    '  private antigravityConfigured() {\n    const config = readJson(this.antigravityConfigPath(), {});\n    return Boolean(config?.mcpServers?.brace);\n  }',
    '  private antigravityConfigured() {\n    const state = inspectJsonConfig(this.antigravityConfigPath());\n    if (!state.valid || !state.exists) return false;\n    return Boolean(state.value?.mcpServers?.brace);\n  }',
    "Antigravity configuration validation",
  ],
  [
    '        const executablePath = findExecutable(client.commandNames);\n        const configured = this.isConfigured(id);\n        return {',
    '        const executablePath = findExecutable(client.commandNames);\n        const detected = id === "generic" || Boolean(executablePath);\n        const configState = id === "claude" || id === "antigravity"\n          ? inspectJsonConfig(this.clientConfigPath(id))\n          : null;\n        const configured = configState?.valid === false ? false : this.isConfigured(id);\n        const health = connectorHealth({ id, detected, configured, configState });\n        return {',
    "connector list health preparation",
  ],
  [
    '          detected: id === "generic" || Boolean(executablePath),',
    '          detected,',
    "connector detected field",
  ],
  [
    '          configured,\n          configPath: this.clientConfigPath(id),',
    '          configured,\n          health: health.status,\n          healthDetail: health.detail,\n          configPath: this.clientConfigPath(id),',
    "connector health response",
  ],
  [
    '  private installAntigravity(access: ConnectorAccess) {\n    const filePath = this.antigravityConfigPath();\n    const config = readJson(filePath, {});\n    const next = {',
    '  private installAntigravity(access: ConnectorAccess) {\n    const filePath = this.antigravityConfigPath();\n    const config = loadJsonConfigForWrite(filePath);\n    const next = {',
    "Antigravity fail-closed write",
  ],
  [
    '    if (!new Set<ConnectorAccess>(["read-only", "remember"]).has(access)) {\n      throw new Error("Choose read-only or remember access.");\n    }\n    const window = this.options.getWindow();',
    '    if (!new Set<ConnectorAccess>(["read-only", "remember"]).has(access)) {\n      throw new Error("Choose read-only or remember access.");\n    }\n    const configState = id === "claude" || id === "antigravity"\n      ? inspectJsonConfig(this.clientConfigPath(id))\n      : null;\n    if (configState?.valid === false) {\n      throw new Error(CLIENTS[id].name + " configuration needs attention. BRACE will not overwrite a malformed or unreadable configuration; repair or restore that client config first.");\n    }\n    const window = this.options.getWindow();',
    "connector malformed-config guard",
  ],
]);

patchFile("src/lib/brace/types.ts", [
  [
    '  configured: boolean;\n  configPath: string | null;',
    '  configured: boolean;\n  health: "ready" | "needs-setup" | "client-missing" | "config-error" | "manual";\n  healthDetail: string;\n  configPath: string | null;',
    "connector health types",
  ],
]);

patchFile("src/components/brace/brace-app.tsx", [
  [
    '    { id: "capture", label: "Capture a memory", detail: "Save durable context from anywhere", category: "Action", icon: Plus, key: "Ctrl N", run: onQuickCapture },\n    { id: "shortcuts", label: "Help & shortcuts", detail: "Common tasks and keyboard controls", category: "Help", icon: Keyboard, key: "?", run: onShortcuts },',
    '    { id: "capture", label: "Capture a memory", detail: "Save durable context from anywhere", category: "Action", icon: Plus, key: "Ctrl N", run: onQuickCapture },\n    { id: "import-sources", label: "Import folder or note vault", detail: "Index Markdown, text, and project files in place", category: "Action", icon: FolderInput, key: "", run: () => { setView("projects"); onClose(); void useBrace.getState().addProject(); } },\n    { id: "shortcuts", label: "Help & shortcuts", detail: "Common tasks and keyboard controls", category: "Help", icon: Keyboard, key: "?", run: onShortcuts },',
    "command palette import action",
  ],
  [
    '<Page eyebrow="Your source folders" title="Projects" description="Choose the folders BRACE can search. Your original files stay in place and are never edited." actions={<button type="button" onClick={() => void addProject()} className="brace-primary h-10 px-4"><FolderInput className="h-4 w-4" />Add project folder</button>}>',
    '<Page eyebrow="Your source folders" title="Projects & note vaults" description="Import a code project, Markdown/plain-text folder, or Obsidian-style note vault. BRACE indexes supported text in place; your original files are never edited." actions={<button type="button" onClick={() => void addProject()} className="brace-primary h-10 px-4"><FolderInput className="h-4 w-4" />Add folder or vault</button>}>',
    "project vault heading",
  ],
  [
    '<p className="mt-3 text-sm text-white/35">Import a specific project folder to begin.</p>',
    '<p className="mt-3 text-sm text-white/35">Import a project folder or note vault to begin. Markdown headings, #tags, and [[wiki links]] are understood automatically.</p>',
    "project empty state",
  ],
  [
    '  const Icon = connector.id === "codex" ? Code2 : connector.id === "claude" ? Sparkles : connector.id === "antigravity" ? Network : GitBranch;\n  return (',
    '  const Icon = connector.id === "codex" ? Code2 : connector.id === "claude" ? Sparkles : connector.id === "antigravity" ? Network : GitBranch;\n  const health = connector.health || (connector.configured ? "ready" : connector.detected ? "needs-setup" : connector.id === "generic" ? "manual" : "client-missing");\n  const healthLabel = ({ ready: "Ready", "needs-setup": "Needs setup", "client-missing": "Client not found", "config-error": "Config needs attention", manual: "Manual config" } as Record<string, string>)[health] || "Unknown";\n  return (',
    "connector card health labels",
  ],
  [
    '<span><strong>{connector.name}</strong><small>{connector.version || connector.description}</small></span>\n        <i className={connector.configured ? "is-online" : connector.detected ? "is-detected" : ""} />\n      </button>\n      <div className="connector-client-foot">\n        <span>{connector.configured ? "Configured" : connector.detected ? "Detected" : connector.id === "generic" ? "Manual config" : "Not installed"}</span>',
    '<span><strong>{connector.name}</strong><small>{connector.version || connector.description}</small></span>\n        <i className={health === "ready" ? "is-online" : health === "needs-setup" ? "is-detected" : ""} />\n      </button>\n      <div className="connector-client-foot">\n        <span title={connector.healthDetail}>{healthLabel}</span>',
    "connector card health display",
  ],
  [
    '<button type="button" disabled={!connector.detected} onClick={onInstall}>',
    '<button type="button" disabled={!connector.detected || health === "config-error"} onClick={onInstall}>',
    "connector unsafe repair guard",
  ],
]);

console.log("Applied BRACE note-vault UX and connector health hardening.");
