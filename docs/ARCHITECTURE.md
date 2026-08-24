# Architecture

BRACE separates private data, trusted local services, and untrusted presentation surfaces. The central design constraint is that changing an AI client must not require migrating the user's memory.

## Component map

```text
┌──────────────── selected project folders ────────────────┐
│ original files stay canonical                            │
└───────────────────────┬───────────────────────────────────┘
                        │ guarded, incremental read
                        ▼
┌──────────────── core modules ─────────────────────────────┐
│ project indexer  memory store  embeddings  skill runtime │
└───────────────────────┬───────────────────────────────────┘
                        │ parameterized SQLite operations
                        ▼
┌──────────────── external application data ────────────────┐
│ brace.sqlite3  skills/  demo-workspace/  backups/exports │
└───────────────────┬───────────────────────┬───────────────┘
                    │                       │
              narrow Electron IPC     local stdio MCP
                    │                       │
                    ▼                       ▼
           sandboxed desktop UI       compatible AI clients
```

## Core

The CommonJS modules under `core/` are environment-independent and directly testable with Node.js 24.

### Memory store

`core/memory-store.js` owns schema migration and every SQL query. It uses Node's built-in `node:sqlite`, enables WAL mode, creates FTS5 indexes, and keeps durable memory separate from rebuildable source chunks.

Responsibilities include:

- projects, sources, source chunks, and chunk embeddings;
- memories, memory embeddings, evidence, and tombstones;
- explicit decisions and append-only timeline events;
- entities and typed relationships;
- installed skill metadata and settings;
- lexical, semantic, and hybrid retrieval;
- backup, portable export, delete-all, and statistics.

### Project indexer

`core/project-indexer.js` resolves a user-selected root, rejects broad roots, traverses without following symlinks, filters directories and filenames, hashes content, chunks text by Markdown heading, and assigns private-path-free URIs.

Source chunks are rebuildable. Durable memories are not automatically deleted when a project file changes or disappears.

### Embedding adapters

`core/embedding-adapters.js` defines two explicit network adapters:

- Ollama over loopback HTTP only.
- OpenAI-compatible embeddings over HTTPS or loopback HTTP.

Adapters return provider vectors and a model identifier. Search uses vector ranking only when dimensions and model identity are compatible.

### Skill runtime

`core/skill-runtime.js` parses a versioned JSON manifest, verifies declared permissions, copies only the normalized manifest into external data, stores a checksum, and dispatches a small allowlist of built-in operations.

It never imports code from the skill directory. There is no shell, `eval`, dynamic module, or arbitrary HTTP operation.

## Desktop boundary

`electron/main.ts` is the trusted Electron process. It:

- owns the BrowserWindow and `brain://` static asset protocol;
- enforces path containment for packaged assets;
- sets a restrictive content security policy;
- enables context isolation, sandboxing, and web security;
- disables Node integration;
- denies popups, unexpected navigation, webviews, and permission requests;
- owns the memory service and registers a narrow IPC allowlist.

`electron/preload.ts` exposes only named BRACE operations. The renderer cannot ask for an arbitrary file path, IPC channel, command, network request, or module.

`electron/memory-service.ts` performs user-authorized folder selection, backup/export destinations, destructive confirmations, and skill permission dialogs in the trusted process.

## MCP boundary

`scripts/mcp-server.mjs` uses the official TypeScript SDK's stdio server. The release build bundles it into `dist/mcp/brace-mcp.cjs`. `electron/launcher.js` chooses between desktop mode and MCP mode before importing Electron application code.

MCP has no TCP listener. The client that launches the process controls its environment and is therefore inside the trust boundary.

Authorization has three modes:

1. Default read-only tools.
2. Write tools when `BRACE_MCP_WRITE=1`.
3. Forgetting only when both write and `BRACE_MCP_DESTRUCTIVE=1` are set.

Tool schemas cap query, title, content, list, and array sizes. Project listings omit absolute roots.

## Browser preview boundary

The Next.js static export also runs in an ordinary browser for visual development. `src/lib/brace/browser-preview.ts` supplies a clearly labelled synthetic snapshot. Desktop mutations fail with an explanatory message instead of pretending to persist.

The preview is not a storage implementation and is not used by the packaged desktop when Electron's preload bridge is present.

## Data ownership

BRACE owns its external SQLite database and installed manifest copies. It does not own imported project originals. The distinction is visible in the UI, export format, provenance URIs, and deletion behavior.

See [ADR-001](architecture/adr-001-local-data-boundary.md) and [ADR-002](architecture/adr-002-memory-lifecycle.md).

## Failure behavior

- Missing or incompatible embeddings fall back to lexical retrieval with a warning.
- Changed skill manifests fail integrity verification and do not run.
- Unsupported or dangerous project selections fail before traversal.
- Database schemas newer than the running application are rejected.
- Browser preview mutations fail explicitly.
- Missing packaged static output shows an application build error instead of opening a remote page.
