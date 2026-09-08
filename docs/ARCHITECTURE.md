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
│ index worker  repositories  retrieval  skills  automations│
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

`core/memory-store.js` remains the compatibility facade and transaction owner. It uses Node's built-in `node:sqlite`, enables WAL mode, creates FTS5 indexes, and keeps durable memory separate from rebuildable source chunks. Bounded domains are moving behind repositories; organization persistence is the first extracted repository under `core/repositories/`.

Responsibilities include:

- projects, sources, source chunks, and chunk embeddings;
- memories, pinned working context, memory embeddings, evidence, and tombstones;
- explicit decisions and append-only timeline events;
- entities and typed relationships;
- installed skill metadata and settings;
- automation definitions and immutable execution history;
- lexical, semantic, and hybrid retrieval;
- backup, portable export, delete-all, and statistics.

### Project indexer

`core/project-indexer.js` defines guarded traversal and chunking. `core/project-index-worker.js` performs disk-heavy scanning away from Electron's main thread, while `core/project-index-jobs.js` owns the narrow job protocol, cancellation, bounded progress, and per-source staged commit. `core/project-watch-service.js` is an explicit per-project, debounced watcher; it is never globally enabled.

Source chunks are rebuildable. Durable memories are not automatically deleted when a project file changes or disappears.

### Embedding adapters

`core/embedding-adapters.js` defines two explicit network adapters:

- Ollama over loopback HTTP only.
- OpenAI-compatible embeddings over HTTPS or loopback HTTP.

Adapters return provider vectors and a model identifier. Search uses vector ranking only when dimensions and model identity are compatible.

### Skill runtime

`core/skill-runtime.js` parses a versioned JSON manifest, verifies declared permissions, copies only the normalized manifest into external data, stores a checksum, and dispatches a small allowlist of built-in operations.

It never imports code from the skill directory. There is no shell, `eval`, dynamic module, or arbitrary HTTP operation.

### Automation runtime

`core/automation-engine.js` validates and executes typed trigger-condition-action recipes. It derives a visible permission envelope from actions, renders only property placeholders, redacts durable trace data, bounds recipe size and schedule frequency, and supports mutation-free previews plus snapshot-based retries.

The Electron main process owns the 30-second scheduler. Schedules use local time and run only while the desktop is open. Event dispatch occurs after explicit memory, decision, project-index, and handoff operations. Automation actions do not recursively dispatch new automation triggers.

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

`electron/connector-service.ts` is the only client-configuration and AI-process seam. It detects allowlisted clients, builds platform-correct stdio definitions, backs up the exact configuration target, runs client-specific argument arrays without a shell, verifies the resulting BRACE entry, and restores the previous state on failure. The renderer receives connection metadata and named actions; it never receives a general process launcher.

The AI Workspace can invoke detected Codex CLI or Claude Code clients inside an isolated read-only working directory. The trusted service presents the selected context and model-provider boundary before execution. Prompt and response history is secret-redacted and local, and durable retention is a separate explicit operation.

## MCP boundary

`scripts/mcp-server.mjs` uses the official TypeScript SDK's stdio server. The release build bundles it into `dist/mcp/brace-mcp.cjs`. `electron/launcher.js` chooses between desktop mode and MCP mode before importing Electron application code.

MCP has no TCP listener. The client that launches the process controls its environment and is therefore inside the trust boundary.

Authorization has three modes:

1. Default read-only tools.
2. Write tools when `BRACE_MCP_WRITE=1`.
3. Forgetting only when both write and `BRACE_MCP_DESTRUCTIVE=1` are set.

Tool schemas cap query, title, content, list, and array sizes. Project listings omit absolute roots.

Session continuity uses the same permission split. `brace_session_start` is read-only and returns a bounded capsule of memory, source evidence, and recent events. `brace_session_handoff` exists only in write mode and stores one explicit structured outcome rather than a transcript. The `brace_memory_compass` prompt teaches capable clients to use those seams without inventing absent context.

## Browser preview boundary

The Next.js static export also runs in an ordinary browser for visual development. `src/lib/brace/browser-preview.ts` supplies a clearly labelled synthetic snapshot. Desktop mutations fail with an explanatory message instead of pretending to persist.

The preview is not a storage implementation and is not used by the packaged desktop when Electron's preload bridge is present.

## Business authorization boundary

`core/business-authorization.js` is a pure authorization kernel. It accepts
freshly resolved subject, organization, workspace, membership, and resource
facts and returns an explicit allow/deny decision with a reason; it does not
read storage, manage sessions, persist policy, or enforce a remote tenant
boundary. Personal resources are owner-bound, while team and organization
resources require active workspace membership and a role or explicit
capability grant.

Schema v7 persists provider-scoped authorization subjects without converting
legacy labels into identities. Schema v8 adds nullable personal-owner bindings
and a separate immutable shared-publication/revision store; it performs no
identity or ownership backfill. Schema v9 adds bounded local identity-session
records. A compact assertion is accepted only after Ed25519 signature, trusted
HTTPS issuer, exact audience, key id, human kind, expiry, and maximum-lifetime
validation. Raw assertions are never stored; replay identifiers and hashes are
single-use. Active sessions recheck subject status and expiry on every protected
operation, and the current session identifier exists only in main-process
memory. Workspace-member mutation resolves fresh facts
and authorizes inside the same write transaction. Dedicated shared publication,
read, lexical search, graph, export, and AI-context-preview operations authorize
from the private Electron identity context on every call and never fall back to
the personal store. A server-derived UI capability hint only controls an
affordance; it never replaces service enforcement. The verifier has no default
trusted issuer and no renderer enrollment seam, so an unprovisioned production
build remains locked. A complete OIDC/SAML enrollment and administrator trust-
provisioning flow is not shipped; production role changes and the Publish to
company control therefore still fail closed.

Schema v10 adds a transport-neutral company-sync replica boundary. Only an
already-authorized `shared_publications` revision or revocation can be queued.
Payloads use AES-256-GCM with authenticated tenant, workspace, actor, device,
record, revision, key-id, and timestamp metadata. SQLite stores ciphertext,
nonce, tag, ciphertext hash, and an opaque key reference—never key material.
Workspace keys must be supplied by an external key provider. Incoming delivery
is idempotent, refuses cross-workspace devices, records out-of-order conflicts,
reconciles them after predecessors arrive, and materializes tombstones without
plaintext. Expired leases, device revocation, and workspace revocation fail
closed; workspace revocation removes the key reference and local materialized
replica while retaining undecryptable operation evidence.

This is the current local foundation, not a completed business deployment. The
kernel is not yet wired into organization/workspace creation, a real remote
sync transport/service, backup authorization, audit reads, connectors,
automations, or MCP seams.
The current shared projections are a local security foundation, not a remote
multi-tenant service. The business role lenses in the UI are presentation-only
views and never grant access; trusted service layers must authorize every
underlying projection and action.

The encrypted operation-log and replica core is implemented, but server policy,
Schema v11 adds a local approval boundary for a future service agent: exact
typed plan hash, target, bounded data-leaving description, opaque credential
references, budget declaration, human-only decision, expiration, one-time
consumption, and a tamper-evident governance audit chain. It grants no
connector access and does not execute external work.

TLS transport, managed/self-hosted deployment, object attachments, remote key
management, and cross-tenant infrastructure are not. Connector integrations,
persistent digital agents, remote audit/checkpointing, and external-effect
execution remain proposed architecture. They must satisfy the acceptance gates
in the related ADRs before being described or shipped as multi-tenant
capabilities.

## Data ownership

BRACE owns its external SQLite database and installed manifest copies. It does not own imported project originals. The distinction is visible in the UI, export format, provenance URIs, and deletion behavior.

See [ADR-001](architecture/adr-001-local-data-boundary.md), [ADR-002](architecture/adr-002-memory-lifecycle.md), [ADR-003](architecture/adr-003-unified-workspace-and-connectors.md), [ADR-004](architecture/adr-004-local-automation-runtime.md), [ADR-005](architecture/adr-005-business-scope-and-authorization.md), [ADR-006](architecture/adr-006-encrypted-sync-and-deployment.md), and [ADR-007](architecture/adr-007-connectors-agents-and-audit.md).

## Failure behavior

- Missing or incompatible embeddings fall back to lexical retrieval with a warning.
- Changed skill manifests fail integrity verification and do not run.
- Unsupported or dangerous project selections fail before traversal.
- Database schemas newer than the running application are rejected.
- Browser preview mutations fail explicitly.
- Connector setup fails and restores the exact prior configuration when the expected BRACE entry cannot be verified.
- An existing configuration entry is reported as configured, not as proof of a live provider connection.
- Failed automation attempts preserve their redacted trace and original recipe snapshot for inspection or retry.
- Missing packaged static output shows an application build error instead of opening a remote page.
