#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, source) => fs.writeFileSync(path.join(root, file), source.replace(/\r\n/g, "\n"));
const replace = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Index task patch could not locate ${label}.`);
  return source.replace(search, () => replacement);
};

// Core progress callback: intentionally tiny and transport-agnostic.
{
  let source = read("core/project-indexer.js");
  if (!source.includes('onProgress({ phase: "indexing"')) {
    source = replace(source,
      'async function indexProject(store, input) {\n  const scan = listProjectFiles(input.rootPath, input);\n',
      'async function indexProject(store, input) {\n' +
      '  const onProgress = typeof input.onProgress === "function" ? input.onProgress : () => {};\n' +
      '  onProgress({ phase: "scanning", completed: 0, total: null });\n' +
      '  const scan = listProjectFiles(input.rootPath, input);\n' +
      '  onProgress({ phase: "indexing", completed: 0, total: scan.files.length });\n',
      "indexProject start");
    source = replace(source,
      '  for (const file of scan.files) {\n    if (input.signal?.aborted) throw new Error("Project indexing was cancelled.");\n',
      '  for (let fileIndex = 0; fileIndex < scan.files.length; fileIndex += 1) {\n' +
      '    const file = scan.files[fileIndex];\n' +
      '    if (input.signal?.aborted) throw new Error("Project indexing was cancelled.");\n' +
      '    if (fileIndex === 0 || fileIndex % 10 === 0) {\n' +
      '      onProgress({ phase: "indexing", completed: fileIndex, total: scan.files.length });\n' +
      '    }\n',
      "file loop");
    source = replace(source,
      '  const removed = store.removeMissingSources(project.id, seenUris);\n',
      '  onProgress({ phase: "indexing", completed: scan.files.length, total: scan.files.length });\n' +
      '  const removed = store.removeMissingSources(project.id, seenUris);\n',
      "index completion");
  }
  write("core/project-indexer.js", source);
}

// Worker forwards structured progress.
{
  let source = read("electron/project-index-worker.ts");
  source = source.replace('    parentPort?.postMessage({ type: "progress", phase: "started" });\n', '    parentPort?.postMessage({ type: "progress", phase: "starting", completed: 0, total: null });\n');
  if (!source.includes('onProgress: (progress:')) {
    source = replace(source,
      '      embedder,\n    });\n',
      '      embedder,\n' +
      '      onProgress: (progress: { phase?: string; completed?: number; total?: number | null }) => {\n' +
      '        parentPort?.postMessage({ type: "progress", ...progress });\n' +
      '      },\n' +
      '    });\n',
      "worker index input");
  }
  write("electron/project-index-worker.ts", source);
}

// Main process tracks active tasks and exposes explicit cancellation.
{
  let source = read("electron/memory-service.ts");
  if (!source.includes("activeProjectIndexes")) {
    source = replace(source,
      '  private automationTimer: ReturnType<typeof setInterval> | null = null;\n',
      '  private automationTimer: ReturnType<typeof setInterval> | null = null;\n' +
      '  private activeProjectIndexes = new Map<string, { worker: Worker; cancel: () => void }>();\n',
      "worker registry property");
    source = replace(source,
      '  close() {\n    if (this.automationTimer) clearInterval(this.automationTimer);\n',
      '  close() {\n' +
      '    for (const task of this.activeProjectIndexes.values()) void task.worker.terminate();\n' +
      '    this.activeProjectIndexes.clear();\n' +
      '    if (this.automationTimer) clearInterval(this.automationTimer);\n',
      "service close");
  }
  if (!source.includes("cancelProjectIndex(taskId")) {
    source = replace(source,
      '  async runProjectIndexWorker(input: { rootPath: string; projectId?: string; name?: string }) {\n',
      '  cancelProjectIndex(taskId: string) {\n' +
      '    const task = this.activeProjectIndexes.get(String(taskId || ""));\n' +
      '    if (!task) return false;\n' +
      '    task.cancel();\n' +
      '    return true;\n' +
      '  }\n\n' +
      '  async runProjectIndexWorker(input: { rootPath: string; projectId?: string; name?: string }) {\n',
      "worker method");
  }
  if (!source.includes("const taskId = randomUUID();")) {
    source = replace(source,
      '    return await new Promise<any>((resolve, reject) => {\n      const worker = new Worker(workerPath, {\n',
      '    const taskId = randomUUID();\n' +
      '    return await new Promise<any>((resolve, reject) => {\n' +
      '      const worker = new Worker(workerPath, {\n',
      "task identifier");
    source = replace(source,
      '      const finish = (callback: () => void) => {\n        if (settled) return;\n        settled = true;\n        clearTimeout(timeout);\n        callback();\n      };\n',
      '      const finish = (callback: () => void) => {\n' +
      '        if (settled) return;\n' +
      '        settled = true;\n' +
      '        clearTimeout(timeout);\n' +
      '        this.activeProjectIndexes.delete(taskId);\n' +
      '        callback();\n' +
      '      };\n' +
      '      const cancel = () => finish(() => {\n' +
      '        void worker.terminate();\n' +
      '        reject(new Error("Project indexing was cancelled."));\n' +
      '      });\n' +
      '      this.activeProjectIndexes.set(taskId, { worker, cancel });\n',
      "task lifecycle");
    source = replace(source,
      '              projectId: input.projectId || null,\n              phase: String(message.phase || "working"),\n',
      '              taskId,\n' +
      '              projectId: input.projectId || null,\n' +
      '              phase: String(message.phase || "working"),\n' +
      '              completed: Number.isFinite(Number(message.completed)) ? Number(message.completed) : 0,\n' +
      '              total: Number.isFinite(Number(message.total)) ? Number(message.total) : null,\n',
      "progress payload");
  }
  if (!source.includes('ipcMain.handle("brace:cancel-project-index"')) {
    const marker = '  ipcMain.handle("brace:reindex-project", (_event, projectId: string) => service.reindexProject(String(projectId || "")));\n';
    source = replace(source, marker, marker + '  ipcMain.handle("brace:cancel-project-index", (_event, taskId: string) => service.cancelProjectIndex(String(taskId || "")));\n', "reindex IPC");
  }
  write("electron/memory-service.ts", source);
}

// Narrow preload event subscription + cancellation command.
{
  let source = read("electron/preload.ts");
  if (!source.includes("cancelBraceProjectIndex")) {
    source = replace(source,
      '  reindexBraceProject: (projectId: string) =>\n    ipcRenderer.invoke("brace:reindex-project", projectId),\n',
      '  reindexBraceProject: (projectId: string) =>\n' +
      '    ipcRenderer.invoke("brace:reindex-project", projectId),\n' +
      '  cancelBraceProjectIndex: (taskId: string) =>\n' +
      '    ipcRenderer.invoke("brace:cancel-project-index", taskId),\n' +
      '  onBraceProjectIndexProgress: (listener: (progress: unknown) => void) => {\n' +
      '    const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => listener(progress);\n' +
      '    ipcRenderer.on("brace:project-index-progress", handler);\n' +
      '    return () => ipcRenderer.removeListener("brace:project-index-progress", handler);\n' +
      '  },\n',
      "preload reindex bridge");
  }
  write("electron/preload.ts", source);
}

// Renderer types.
{
  let source = read("src/lib/brace/types.ts");
  if (!source.includes("export interface ProjectIndexProgress")) {
    const marker = 'export interface BraceElectronApi {\n';
    source = replace(source, marker,
      'export interface ProjectIndexProgress {\n' +
      '  taskId: string;\n' +
      '  projectId: string | null;\n' +
      '  phase: string;\n' +
      '  completed: number;\n' +
      '  total: number | null;\n' +
      '}\n\n' + marker,
      "progress type");
    source = replace(source,
      '  reindexBraceProject: (projectId: string) => Promise<unknown>;\n',
      '  reindexBraceProject: (projectId: string) => Promise<unknown>;\n' +
      '  cancelBraceProjectIndex: (taskId: string) => Promise<boolean>;\n' +
      '  onBraceProjectIndexProgress: (listener: (progress: ProjectIndexProgress) => void) => () => void;\n',
      "Electron progress API");
  }
  write("src/lib/brace/types.ts", source);
}

// Zustand tracks one visible indexing task while Electron supports task ids.
{
  let source = read("src/lib/brace/store.ts");
  if (!source.includes("ProjectIndexProgress,")) {
    source = replace(source, '  ConnectorId,\n  SearchResponse,\n', '  ConnectorId,\n  ProjectIndexProgress,\n  SearchResponse,\n', "progress import");
  }
  if (!source.includes("indexTask: ProjectIndexProgress")) {
    source = replace(source,
      '  notice: string | null;\n',
      '  notice: string | null;\n' +
      '  indexTask: ProjectIndexProgress | null;\n',
      "task state");
    source = replace(source,
      '  reindexProject: (id: string) => Promise<void>;\n',
      '  reindexProject: (id: string) => Promise<void>;\n' +
      '  cancelIndexing: () => Promise<void>;\n',
      "cancel action");
  }
  if (!source.includes("let detachIndexProgress")) {
    source = replace(source,
      'function message(error: unknown) {\n',
      'let detachIndexProgress: (() => void) | null = null;\n\nfunction message(error: unknown) {\n',
      "listener storage");
  }
  source = source.replace(
    '    } catch (error) {\n      set({ error: message(error) });\n',
    '    } catch (error) {\n' +
    '      const detail = message(error);\n' +
    '      if (/cancelled/i.test(detail)) set({ notice: detail, error: null });\n' +
    '      else set({ error: detail });\n',
  );
  if (!source.includes("indexTask: null,")) {
    source = replace(source, '    notice: null,\n', '    notice: null,\n    indexTask: null,\n', "initial task state");
  }
  if (!source.includes("onBraceProjectIndexProgress")) {
    source = replace(source,
      '    bootstrap: async () => {\n      set({ loading: true, error: null });\n      try {\n',
      '    bootstrap: async () => {\n' +
      '      set({ loading: true, error: null });\n' +
      '      try {\n' +
      '        const api = desktop();\n' +
      '        if (!detachIndexProgress && api?.onBraceProjectIndexProgress) {\n' +
      '          detachIndexProgress = api.onBraceProjectIndexProgress((progress) => {\n' +
      '            const total = progress.total;\n' +
      '            const suffix = total && total > 0 ? ` ${Math.min(progress.completed, total)}/${total}` : "";\n' +
      '            set({ indexTask: progress, operation: `Indexing project · ${progress.phase}${suffix}` });\n' +
      '          });\n' +
      '        }\n',
      "bootstrap listener");
  }
  source = source.replace(
    '        const result = await api.addBraceProject();\n        if (result) {\n',
    '        let result;\n' +
    '        try { result = await api.addBraceProject(); } finally { set({ indexTask: null }); }\n' +
    '        if (result) {\n',
  );
  source = source.replace(
    '        await api.reindexBraceProject(id);\n        await refresh();\n',
    '        try { await api.reindexBraceProject(id); } finally { set({ indexTask: null }); }\n' +
    '        await refresh();\n',
  );
  if (!source.includes("cancelIndexing: async")) {
    const marker = '    toggleSkill: async (name, enabled) =>\n';
    source = replace(source, marker,
      '    cancelIndexing: async () => {\n' +
      '      const task = get().indexTask;\n' +
      '      const api = desktop();\n' +
      '      if (!task || !api?.cancelBraceProjectIndex) return;\n' +
      '      await api.cancelBraceProjectIndex(task.taskId);\n' +
      '      set({ indexTask: null, operation: null, notice: "Project indexing cancelled." });\n' +
      '    },\n' + marker,
      "cancel store action");
  }
  write("src/lib/brace/store.ts", source);
}

// Upgrade existing operation toast into a bounded progress task surface.
{
  let source = read("src/components/brace/brace-app.tsx");
  if (!source.includes("indexTask,")) {
    source = replace(source,
      '    operation,\n    error,\n',
      '    operation,\n    indexTask,\n    cancelIndexing,\n    error,\n',
      "app store destructure");
  }
  if (!source.includes("Cancel indexing")) {
    source = replace(source,
      '      {operation && (\n        <div className="fixed bottom-5 right-5 z-[80] flex items-center gap-3 rounded-xl border border-white/10 bg-[#171b20]/95 px-4 py-3 text-xs text-white/75 shadow-2xl backdrop-blur" role="status">\n          <LoaderCircle className="h-4 w-4 animate-spin text-[#7dd3fc]" />\n          {operation}\n        </div>\n      )}\n',
      '      {operation && (\n' +
      '        <div className="fixed bottom-5 right-5 z-[80] w-[min(360px,calc(100vw-2.5rem))] rounded-xl border border-white/10 bg-[#171b20]/95 px-4 py-3 text-xs text-white/75 shadow-2xl backdrop-blur" role="status">\n' +
      '          <div className="flex items-center gap-3">\n' +
      '            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-[#7dd3fc]" />\n' +
      '            <span className="min-w-0 flex-1 truncate">{operation}</span>\n' +
      '            {indexTask && <button type="button" onClick={() => void cancelIndexing()} className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/60 hover:bg-white/5 hover:text-white" aria-label="Cancel indexing">Cancel</button>}\n' +
      '          </div>\n' +
      '          {indexTask?.total && indexTask.total > 0 && (\n' +
      '            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8" aria-hidden="true">\n' +
      '              <div className="h-full rounded-full bg-[#7dd3fc] transition-[width] duration-200" style={{ width: `${Math.min(100, Math.round((indexTask.completed / indexTask.total) * 100))}%` }} />\n' +
      '            </div>\n' +
      '          )}\n' +
      '        </div>\n' +
      '      )}\n',
      "operation toast");
  }
  write("src/components/brace/brace-app.tsx", source);
}

// Regression coverage for core progress behavior and narrow bridge wiring.
const testPath = path.join(root, "tests/project-index-progress.test.js");
if (!fs.existsSync(testPath)) {
  fs.writeFileSync(testPath, `"use strict";\n\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst os = require("node:os");\nconst path = require("node:path");\nconst test = require("node:test");\nconst { MemoryStore } = require("../core/memory-store");\nconst { indexProject } = require("../core/project-indexer");\n\ntest("project indexing emits bounded file progress", async (context) => {\n  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brace-progress-"));\n  const project = path.join(directory, "project");\n  fs.mkdirSync(project, { recursive: true });\n  for (let index = 0; index < 12; index += 1) fs.writeFileSync(path.join(project, \`file-\${index}.md\`), \`# File \${index}\\nprogress fixture\`);\n  const store = new MemoryStore(path.join(directory, "brace.sqlite3"));\n  context.after(() => { try { store.close(); } catch {} fs.rmSync(directory, { recursive: true, force: true }); });\n  const progress = [];\n  const result = await indexProject(store, { rootPath: project, onProgress: (item) => progress.push(item) });\n  assert.equal(result.filesSeen, 12);\n  assert.equal(progress[0].phase, "scanning");\n  assert.ok(progress.some((item) => item.phase === "indexing" && item.total === 12));\n  assert.deepEqual(progress.at(-1), { phase: "indexing", completed: 12, total: 12 });\n});\n\ntest("desktop bridge exposes progress subscription and cancellation without raw IPC", () => {\n  const preload = fs.readFileSync(path.join(__dirname, "..", "electron", "preload.ts"), "utf8");\n  assert.match(preload, /cancelBraceProjectIndex/);\n  assert.match(preload, /onBraceProjectIndexProgress/);\n  assert.match(preload, /removeListener/);\n});\n`);
}
