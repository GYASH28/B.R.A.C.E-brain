import { parentPort, workerData } from "node:worker_threads";
import memoryModule from "../core/memory-store";
import projectModule from "../core/project-indexer";
import embeddingModule from "../core/embedding-adapters";

const { MemoryStore, redactSecrets } = memoryModule as any;
const { indexProject } = projectModule as any;
const { createOllamaEmbeddingAdapter } = embeddingModule as any;

interface WorkerInput {
  databasePath: string;
  rootPath: string;
  projectId?: string;
  name?: string;
  embeddingConfig?: {
    enabled?: boolean;
    endpoint?: string;
    model?: string;
  } | null;
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Project indexing failed.");
  return redactSecrets(message).value.slice(0, 2_000);
}

async function run() {
  const input = workerData as WorkerInput;
  const store = new MemoryStore(input.databasePath);
  try {
    const config = input.embeddingConfig;
    const embedder = config?.enabled && config.model
      ? createOllamaEmbeddingAdapter({
          endpoint: config.endpoint || "http://127.0.0.1:11434",
          model: config.model,
        })
      : null;
    parentPort?.postMessage({ type: "progress", phase: "started" });
    const result = await indexProject(store, {
      rootPath: input.rootPath,
      projectId: input.projectId,
      name: input.name,
      embedder,
    });
    parentPort?.postMessage({ type: "result", result });
  } finally {
    store.close();
  }
}

run().catch((error) => {
  parentPort?.postMessage({ type: "error", error: safeError(error) });
  process.exitCode = 1;
});
