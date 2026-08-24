# BRACE product audit

Audit baseline: installed BRACE 5.3.0 source, inspected before the clean public
repository was initialized.

## Executive finding

The installed product is a substantial Next.js and Electron application, not a
static mock. It has a real Markdown index, full-text search, link-derived graph,
read-only MCP server, protected AI workspace, provider adapters, encrypted
credentials, checkpoints, backup/restore code, and a Linux package. It is not a
safe public release yet. Runtime data and personalized demo-era source were
mixed into the application tree, several advertised memory concepts were
dormant seed-driven modules, and the verification suite relied heavily on
source-string contracts.

The public worktree was therefore created as a filtered copy. The installed app
and all runtime data remain untouched.

## Capability matrix

| Capability | Baseline | Evidence and required action |
| --- | --- | --- |
| Markdown ingestion | Exists, refine | Incremental index, sections, tasks, links, hashes, and safe path resolution exist. Generalize folder discovery and add project-level provenance. |
| Lexical search | Exists, refine | MiniSearch-backed title/content/tag/path search passes integration tests. Add pagination and query diagnostics. |
| Semantic/hybrid search | Missing | A dormant personalized hash-vector module was not a semantic model and was excluded. Add explicit embedding adapters and never mislabel lexical fallback. |
| Structured memory | Missing | Renderer returns an empty memory list; the Prisma schema and seed memory are unused. Add an external SQLite memory store with migrations. |
| Provenance/evidence | Partial | Indexed files keep relative paths, hashes, timestamps, and sections. Durable memories need source records and evidence links. |
| Timeline/decisions | Missing | Timeline UI reads excluded seed snapshots and is absent from production navigation. Add real append-only events and decision records. |
| Knowledge graph | Exists, refine | Real Markdown links and backlinks drive the graph. Add project, memory, entity, decision, and evidence nodes without invented relationships. |
| Consolidation/forgetting | Missing | No production deduplication, supersession, retention, or explicit forgetting flow. |
| MCP | Exists, refine | Five real read-only stdio tools work. Add structured content, pagination, memory/timeline/graph resources, and separately gated writes. |
| Provider adapters | Exists, refine | Codex, Gemini, GLM, NVIDIA, Ollama, routing, retry, and encrypted-key boundaries exist. Improve provider independence and embedding capability discovery. |
| BRACE Skills | Missing | Demo workflows and agents were intentionally removed; no production skill manifest, permission model, installer, or runtime exists. |
| Onboarding | Missing | The app expects a pre-shaped vault and has no clean first-run guided setup or demo-mode choice. |
| Import/export/backup | Partial | Safe Markdown capture, legacy preview, ZIP backup, and conflict-preserving restore exist. Desktop ZIP code is Windows-specific; memory export and delete-all are absent. |
| Privacy controls | Unsafe | Personalized source/index files and absolute machine paths existed in the installed source. The clean copy excludes them and needs automated release blocking. |
| Electron security | Partial | Context isolation, sandboxing, encrypted secrets, and constrained IPC exist. Add CSP, navigation/window blocking, strict IPC schemas, and redacted diagnostics. |
| Packaging | Partial | Linux AppImage exists. Windows NSIS is configured but no clean current artifact or cross-platform installer test was verified. |
| Website/docs | Missing | No public landing page, current getting-started guide, or screenshot-based How-to page. |
| Tests | Partial | 51 baseline tests, lint, typecheck, renderer build, and Electron compile passed. Persistence restart, migration, skills, privacy, true E2E, and cross-platform coverage are missing. |

## Baseline verification

| Command | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass, 51/51 |
| `npm run build` | Pass |
| `npm run electron:compile` | Pass |

These results describe the installed baseline only. They are not release
evidence for the rebuilt repository.

## Release blockers

1. Remove all personalized seed/index artifacts and absolute paths.
2. Establish an external, migrated, backed-up structured-memory database.
3. Implement actual timeline, decision, evidence, consolidation, and forgetting
   behavior.
4. Add a permissioned declarative Skills runtime and real MCP coverage.
5. Replace static-only contracts with storage, restart, migration, IPC, MCP,
   Electron, installer, privacy, and accessibility execution tests.
6. Produce synthetic demo data and use it for every screenshot and public page.
7. Verify Linux and Windows artifacts, dependency licenses, secrets, and CI.
