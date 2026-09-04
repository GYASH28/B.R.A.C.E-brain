#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const write = (relative, source) => fs.writeFileSync(path.join(root, relative), source.replace(/\r\n/g, "\n"));

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Restore/diagnostics patch could not locate ${label}`);
  return source.replace(search, replacement);
}

function patchMemoryStore() {
  let source = read("core/memory-store.js");
  if (!source.includes("quickCheck() {")) {
    source = replaceRequired(
      source,
      '  stats() {\n',
      '  quickCheck() {\n' +
        '    const rows = this.db.prepare("PRAGMA quick_check").all();\n' +
        '    const messages = rows.map((row) => String(row.quick_check || Object.values(row)[0] || ""));\n' +
        '    return {\n' +
        '      ok: messages.length === 1 && messages[0].toLowerCase() === "ok",\n' +
        '      messages,\n' +
        '      schemaVersion: Number(this.db.prepare("PRAGMA user_version").get().user_version || 0),\n' +
        '    };\n' +
        '  }\n\n' +
        '  stats() {\n',
      "memory-store stats method",
    );
  }
  write("core/memory-store.js", source);
}

function patchMemoryService() {
  let source = read("electron/memory-service.ts");
  if (!source.includes('import recoveryModule from "../core/database-recovery";')) {
    source = replaceRequired(
      source,
      'import dataPathModule from "../core/data-paths";\nimport automationModule from "../core/automation-engine";\n',
      'import dataPathModule from "../core/data-paths";\n' +
        'import automationModule from "../core/automation-engine";\n' +
        'import recoveryModule from "../core/database-recovery";\n',
      "memory-service core imports",
    );
  }
  if (!source.includes("const { applyPendingRestore")) {
    source = replaceRequired(
      source,
      'const { MemoryStore, redactSecrets } = memoryModule as any;\n',
      'const { MemoryStore, redactSecrets, SCHEMA_VERSION } = memoryModule as any;\n',
      "memory-store destructure",
    );
    source = replaceRequired(
      source,
      'const { AutomationEngine } = automationModule as any;\n',
      'const { AutomationEngine } = automationModule as any;\n' +
        'const { applyPendingRestore, cancelPendingRestore, pendingPaths, stageRestore, verifyDatabaseFile } = recoveryModule as any;\n',
      "automation destructure",
    );
  }
  if (!source.includes("readonly lastRestore")) {
    source = replaceRequired(
      source,
      '  readonly automations: any;\n',
      '  readonly automations: any;\n' +
        '  readonly lastRestore: any;\n',
      "service properties",
    );
  }
  if (!source.includes("applyPendingRestore(this.dataDirectory")) {
    source = replaceRequired(
      source,
      '    this.profileWorkspacePath = path.join(this.dataDirectory, "agent-workspace");\n    fs.mkdirSync(this.profileWorkspacePath, { recursive: true });\n    this.store = new MemoryStore(this.databasePath);\n',
      '    this.profileWorkspacePath = path.join(this.dataDirectory, "agent-workspace");\n' +
        '    fs.mkdirSync(this.profileWorkspacePath, { recursive: true });\n' +
        '    this.lastRestore = applyPendingRestore(this.dataDirectory, this.databasePath, {\n' +
        '      maximumSchemaVersion: SCHEMA_VERSION,\n' +
        '    });\n' +
        '    this.store = new MemoryStore(this.databasePath);\n',
      "store initialization",
    );
  }

  if (!source.includes("async stageBackupRestore()")) {
    const marker = '  async createBackup() {\n';
    const index = source.indexOf(marker);
    if (index < 0) throw new Error("Restore/diagnostics patch could not locate createBackup.");
    const methods = [
      '  diagnostics() {',
      '    const backupDirectory = path.join(this.dataDirectory, "backups");',
      '    let backups = [];',
      '    try {',
      '      backups = fs.readdirSync(backupDirectory)',
      '        .filter((name) => name.endsWith(".sqlite3"))',
      '        .map((name) => {',
      '          const filePath = path.join(backupDirectory, name);',
      '          const stat = fs.statSync(filePath);',
      '          return { name, bytes: stat.size, modifiedAt: stat.mtime.toISOString() };',
      '        })',
      '        .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))',
      '        .slice(0, 20);',
      '    } catch {}',
      '    const pending = pendingPaths(this.dataDirectory);',
      '    return {',
      '      generatedAt: new Date().toISOString(),',
      '      runtime: { platform: process.platform, arch: process.arch, node: process.versions.node, electron: process.versions.electron || null },',
      '      storage: {',
      '        schemaVersion: this.store.stats().schemaVersion,',
      '        databaseBytes: fs.existsSync(this.databasePath) ? fs.statSync(this.databasePath).size : 0,',
      '        integrity: this.store.quickCheck(),',
      '        pendingRestore: fs.existsSync(pending.staged) && fs.existsSync(pending.manifest),',
      '        lastRestore: this.lastRestore || null,',
      '        backups,',
      '      },',
      '      retrieval: { enabled: Boolean(this.embeddingAdapter()), config: this.store.getSetting("embedding.ollama", { enabled: false }) },',
      '      automation: { paused: Boolean(this.store.getSetting("automation.paused", false)), schedulerError: this.store.getSetting("automation.scheduler.error", null) },',
      '      stats: this.store.stats(),',
      '    };',
      '  }',
      '',
      '  async stageBackupRestore() {',
      '    const window = this.getWindow();',
      '    if (!window) throw new Error("The BRACE window is unavailable.");',
      '    const selected = await dialog.showOpenDialog(window, {',
      '      title: "Choose a BRACE SQLite backup to restore",',
      '      properties: ["openFile"],',
      '      filters: [{ name: "SQLite backup", extensions: ["sqlite3", "sqlite", "db"] }],',
      '    });',
      '    if (selected.canceled || !selected.filePaths[0]) return null;',
      '    const candidate = verifyDatabaseFile(selected.filePaths[0], { maximumSchemaVersion: SCHEMA_VERSION });',
      '    const approval = await dialog.showMessageBox(window, {',
      '      type: "warning",',
      '      title: "Stage this BRACE backup for restore?",',
      '      message: `Restore schema ${candidate.schemaVersion} (${Math.ceil(candidate.bytes / 1024)} KB) on the next BRACE launch?`,',
      '      detail: "BRACE will first create a consistent safety backup of your current database. The selected backup is copied into the BRACE data directory and verified again before the next launch swaps it in. Imported project files are not changed.",',
      '      buttons: ["Cancel", "Stage restore"],',
      '      defaultId: 0,',
      '      cancelId: 0,',
      '    });',
      '    if (approval.response !== 1) return null;',
      '    const backupDirectory = path.join(this.dataDirectory, "backups");',
      '    fs.mkdirSync(backupDirectory, { recursive: true });',
      '    const safetyPath = path.join(backupDirectory, `brace-before-restore-request-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite3`);',
      '    const safety = await this.store.backup(safetyPath);',
      '    verifyDatabaseFile(safety.path, { maximumSchemaVersion: SCHEMA_VERSION });',
      '    const staged = stageRestore(this.dataDirectory, candidate.path, { maximumSchemaVersion: SCHEMA_VERSION });',
      '    return { pending: true, safetyBackup: safety.path, ...staged };',
      '  }',
      '',
      '  cancelPendingRestore() {',
      '    return cancelPendingRestore(this.dataDirectory);',
      '  }',
      '',
      '  async exportSupportBundle() {',
      '    const window = this.getWindow();',
      '    if (!window) throw new Error("The BRACE window is unavailable.");',
      '    const selected = await dialog.showSaveDialog(window, {',
      '      title: "Save BRACE diagnostics bundle",',
      '      defaultPath: `brace-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,',
      '      filters: [{ name: "JSON", extensions: ["json"] }],',
      '    });',
      '    if (selected.canceled || !selected.filePath) return null;',
      '    const bundle = this.diagnostics();',
      '    fs.writeFileSync(selected.filePath, `${JSON.stringify(bundle, null, 2)}\\n`, { encoding: "utf8", mode: 0o600 });',
      '    return { path: selected.filePath };',
      '  }',
      '',
    ].join("\n");
    source = source.slice(0, index) + methods + source.slice(index);
  }

  if (!source.includes('ipcMain.handle("brace:get-diagnostics"')) {
    const close = source.lastIndexOf("}\n");
    const registerStart = source.indexOf("export function registerBraceMemoryIpc");
    if (close < registerStart) throw new Error("Restore/diagnostics patch could not locate IPC function end.");
    const addition = [
      '  ipcMain.handle("brace:get-diagnostics", () => service.diagnostics());',
      '  ipcMain.handle("brace:stage-restore", () => service.stageBackupRestore());',
      '  ipcMain.handle("brace:cancel-pending-restore", () => service.cancelPendingRestore());',
      '  ipcMain.handle("brace:export-support-bundle", () => service.exportSupportBundle());',
    ].join("\n") + "\n";
    source = source.slice(0, close) + addition + source.slice(close);
  }
  write("electron/memory-service.ts", source);
}

function patchPreload() {
  let source = read("electron/preload.ts");
  if (!source.includes("getBraceDiagnostics")) {
    source = replaceRequired(
      source,
      '  backupBraceData: () => ipcRenderer.invoke("brace:backup"),\n',
      '  backupBraceData: () => ipcRenderer.invoke("brace:backup"),\n' +
        '  getBraceDiagnostics: () => ipcRenderer.invoke("brace:get-diagnostics"),\n' +
        '  stageBraceRestore: () => ipcRenderer.invoke("brace:stage-restore"),\n' +
        '  cancelBracePendingRestore: () => ipcRenderer.invoke("brace:cancel-pending-restore"),\n' +
        '  exportBraceSupportBundle: () => ipcRenderer.invoke("brace:export-support-bundle"),\n',
      "preload backup bridge",
    );
  }
  write("electron/preload.ts", source);
}

function patchTypes() {
  let source = read("src/lib/brace/types.ts");
  if (!source.includes("export interface BraceDiagnostics")) {
    const marker = 'export interface BraceElectronApi {\n';
    const diagnostics = [
      'export interface BraceDiagnostics {',
      '  generatedAt: string;',
      '  runtime: { platform: string; arch: string; node: string; electron: string | null };',
      '  storage: {',
      '    schemaVersion: number;',
      '    databaseBytes: number;',
      '    integrity: { ok: boolean; messages: string[]; schemaVersion: number };',
      '    pendingRestore: boolean;',
      '    lastRestore: Record<string, unknown> | null;',
      '    backups: Array<{ name: string; bytes: number; modifiedAt: string }>;',
      '  };',
      '  retrieval: { enabled: boolean; config: Record<string, unknown> };',
      '  automation: { paused: boolean; schedulerError: unknown };',
      '  stats: BraceSnapshot["stats"];',
      '}',
      '',
    ].join("\n");
    source = replaceRequired(source, marker, diagnostics + marker, "Electron API interface");
  }
  if (!source.includes("getBraceDiagnostics:")) {
    source = replaceRequired(
      source,
      '  backupBraceData: () => Promise<unknown>;\n',
      '  backupBraceData: () => Promise<unknown>;\n' +
        '  getBraceDiagnostics: () => Promise<BraceDiagnostics>;\n' +
        '  stageBraceRestore: () => Promise<{ pending: boolean; safetyBackup: string } | null>;\n' +
        '  cancelBracePendingRestore: () => Promise<boolean>;\n' +
        '  exportBraceSupportBundle: () => Promise<{ path: string } | null>;\n',
      "Electron backup API",
    );
  }
  write("src/lib/brace/types.ts", source);
}

function patchStore() {
  let source = read("src/lib/brace/store.ts");
  if (!source.includes("restoreBackup: () => Promise<void>")) {
    source = replaceRequired(
      source,
      '  backupData: () => Promise<void>;\n',
      '  backupData: () => Promise<void>;\n' +
        '  restoreBackup: () => Promise<void>;\n' +
        '  cancelPendingRestore: () => Promise<void>;\n' +
        '  exportSupportBundle: () => Promise<void>;\n',
      "store backup interface",
    );
  }
  if (!source.includes('perform("Staging backup restore…"')) {
    const marker = '    deleteAll: async (confirmation) =>\n';
    const addition = [
      '    restoreBackup: async () =>',
      '      perform("Staging backup restore…", async () => {',
      '        const api = desktop();',
      '        if (!api?.stageBraceRestore) throw new Error("Backup restore is available in the desktop app.");',
      '        const result = await api.stageBraceRestore();',
      '        if (result?.pending) set({ notice: "Backup verified and staged. Restart BRACE to complete the restore." });',
      '      }),',
      '    cancelPendingRestore: async () =>',
      '      perform("Cancelling pending restore…", async () => {',
      '        const api = desktop();',
      '        if (!api?.cancelBracePendingRestore) throw new Error("Restore controls are available in the desktop app.");',
      '        if (await api.cancelBracePendingRestore()) set({ notice: "Pending restore cancelled." });',
      '      }),',
      '    exportSupportBundle: async () =>',
      '      perform("Exporting diagnostics…", async () => {',
      '        const api = desktop();',
      '        if (!api?.exportBraceSupportBundle) throw new Error("Diagnostics export is available in the desktop app.");',
      '        if (await api.exportBraceSupportBundle()) set({ notice: "Privacy-safe diagnostics bundle saved." });',
      '      }),',
    ].join("\n") + "\n";
    source = replaceRequired(source, marker, addition + marker, "store delete-all action");
  }
  write("src/lib/brace/store.ts", source);
}

function patchUi() {
  let source = read("src/components/brace/brace-app.tsx");
  if (!source.includes("restoreBackup, cancelPendingRestore, exportSupportBundle")) {
    source = replaceRequired(
      source,
      '  const { snapshot, configureEmbeddings, exportData, backupData, deleteAll } = useBrace();\n',
      '  const { snapshot, configureEmbeddings, exportData, backupData, restoreBackup, cancelPendingRestore, exportSupportBundle, deleteAll } = useBrace();\n',
      "SettingsView store actions",
    );
  }
  if (!source.includes("Restore SQLite backup")) {
    source = replaceRequired(
      source,
      '<section className="brace-card overflow-hidden"><SectionHeading title="Backup & portability" /><div className="grid gap-3 p-5 sm:grid-cols-2"><button type="button" onClick={() => void backupData()} className="brace-secondary h-11 px-4"><Archive className="h-4 w-4" />Create SQLite backup</button><button type="button" onClick={() => void exportData()} className="brace-secondary h-11 px-4"><Download className="h-4 w-4" />Export portable JSON</button></div></section>',
      '<section className="brace-card overflow-hidden"><SectionHeading title="Backup, recovery & diagnostics" /><div className="grid gap-3 p-5 sm:grid-cols-2"><button type="button" onClick={() => void backupData()} className="brace-secondary h-11 px-4"><Archive className="h-4 w-4" />Create SQLite backup</button><button type="button" onClick={() => void restoreBackup()} className="brace-secondary h-11 px-4"><RotateCcw className="h-4 w-4" />Restore SQLite backup</button><button type="button" onClick={() => void exportData()} className="brace-secondary h-11 px-4"><Download className="h-4 w-4" />Export portable JSON</button><button type="button" onClick={() => void exportSupportBundle()} className="brace-secondary h-11 px-4"><Activity className="h-4 w-4" />Export diagnostics</button><button type="button" onClick={() => void cancelPendingRestore()} className="brace-secondary h-11 px-4 sm:col-span-2"><X className="h-4 w-4" />Cancel pending restore</button><p className="sm:col-span-2 text-[10px] leading-5 text-white/32">Restore never replaces an open database. BRACE verifies the selected backup, creates a safety backup of your current brain, then completes the swap on the next clean launch.</p></div></section>',
      "Backup & portability UI",
    );
  }
  write("src/components/brace/brace-app.tsx", source);
}

function patchBoundaryTest() {
  let source = read("tests/electron-boundary.test.js");
  for (const operation of ["getBraceDiagnostics", "stageBraceRestore", "cancelBracePendingRestore", "exportBraceSupportBundle"]) {
    if (source.includes(`    "${operation}",`)) continue;
    source = replaceRequired(
      source,
      '    "backupBraceData",\n',
      `    "backupBraceData",\n    "${operation}",\n`,
      `preload operation ${operation}`,
    );
  }
  write("tests/electron-boundary.test.js", source);
}

patchMemoryStore();
patchMemoryService();
patchPreload();
patchTypes();
patchStore();
patchUi();
patchBoundaryTest();
process.stdout.write("Applied BRACE staged restore and diagnostics integration.\n");
