#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, "electron/memory-service.ts");
let source = fs.readFileSync(target, "utf8");

function required(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Index worker patch could not locate ${label}`);
  source = source.replace(search, replacement);
}

if (!source.includes('import { Worker } from "node:worker_threads";')) {
  required(
    'import * as path from "node:path";\n',
    'import * as path from "node:path";\nimport { Worker } from "node:worker_threads";\n',
    "path import",
  );
}

if (source.includes('import projectModule from "../core/project-indexer";\n')) {
  source = source.replace('import projectModule from "../core/project-indexer";\n', "");
  source = source.replace('const { indexProject } = projectModule as any;\n', "");
}

if (!source.includes("async runProjectIndexWorker(input:")) {
  const marker = '  async addProject() {\n';
  const index = source.indexOf(marker);
  if (index < 0) throw new Error("Index worker patch could not locate addProject method.");
  const method = [
    '  async runProjectIndexWorker(input: { rootPath: string; projectId?: string; name?: string }) {',
    '    const embeddingConfig = this.store.getSetting("embedding.ollama", null);',
    '    const workerPath = path.join(__dirname, "project-index-worker.js");',
    '    if (!fs.existsSync(workerPath)) {',
    '      throw new Error("The BRACE project indexing worker is missing. Reinstall BRACE.");',
    '    }',
    '    return await new Promise<any>((resolve, reject) => {',
    '      const worker = new Worker(workerPath, {',
    '        workerData: {',
    '          databasePath: this.databasePath,',
    '          rootPath: input.rootPath,',
    '          projectId: input.projectId,',
    '          name: input.name,',
    '          embeddingConfig,',
    '        },',
    '      });',
    '      let settled = false;',
    '      const timeout = setTimeout(() => {',
    '        if (settled) return;',
    '        settled = true;',
    '        void worker.terminate();',
    '        reject(new Error("Project indexing exceeded the 30 minute safety limit."));',
    '      }, 30 * 60 * 1_000);',
    '      timeout.unref?.();',
    '      const finish = (callback: () => void) => {',
    '        if (settled) return;',
    '        settled = true;',
    '        clearTimeout(timeout);',
    '        callback();',
    '      };',
    '      worker.on("message", (message: any) => {',
    '        if (message?.type === "progress") {',
    '          const window = this.getWindow();',
    '          if (window && !window.isDestroyed()) {',
    '            window.webContents.send("brace:project-index-progress", {',
    '              projectId: input.projectId || null,',
    '              phase: String(message.phase || "working"),',
    '            });',
    '          }',
    '          return;',
    '        }',
    '        if (message?.type === "result") finish(() => resolve(message.result));',
    '        if (message?.type === "error") finish(() => reject(new Error(String(message.error || "Project indexing failed."))));',
    '      });',
    '      worker.once("error", (error) => finish(() => reject(error)));',
    '      worker.once("exit", (code) => {',
    '        if (!settled && code !== 0) finish(() => reject(new Error(`Project indexing worker exited with code ${code}.`)));',
    '      });',
    '    });',
    '  }',
    '',
  ].join("\n");
  source = source.slice(0, index) + method + source.slice(index);
}

required(
  '    return indexProject(this.store, {\n      rootPath: selected.filePaths[0],\n      embedder: this.embeddingAdapter(),\n    });\n',
  '    return this.runProjectIndexWorker({ rootPath: selected.filePaths[0] });\n',
  "addProject index call",
);

required(
  '    const result = await indexProject(this.store, {\n      rootPath: project.root_path,\n      projectId: project.id,\n      name: project.name,\n      embedder: this.embeddingAdapter(),\n    });\n',
  '    const result = await this.runProjectIndexWorker({\n      rootPath: project.root_path,\n      projectId: project.id,\n      name: project.name,\n    });\n',
  "reindexProject call",
);

fs.writeFileSync(target, source.replace(/\r\n/g, "\n"));
process.stdout.write("Applied BRACE project indexing worker integration.\n");
