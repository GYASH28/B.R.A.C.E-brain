# Data model and memory lifecycle

Schema version 5 is stored in SQLite and migrated transactionally by `MemoryStore`. WAL mode supports safe concurrent readers from the desktop and MCP processes.

## Tables

| Table | Purpose | Lifecycle |
| --- | --- | --- |
| `projects` | Selected project identity and private root used only locally | User-created, reindexable |
| `sources` | One indexed file with stable URI, hash, and metadata | Rebuildable |
| `source_chunks` | Heading-aware text chunks and optional vectors | Rebuildable |
| `source_chunks_fts` | FTS5 lexical index for chunks | Rebuildable |
| `memories` | Explicit durable context and optional vector | Durable until superseded, forgotten, or deleted |
| `memories_fts` | FTS5 lexical index for active memory | Maintained with memory lifecycle |
| `evidence` | Observations supporting or challenging a memory | Removed when that memory is forgotten |
| `decisions` | Explicit decision record with rationale and alternatives | Durable |
| `events` | Timeline of real product actions | Append-oriented, cleared by delete-all |
| `entities` | Deterministically extracted tags and wiki-link topics | Rebuildable or explicitly related |
| `relations` | Typed edges between projects, sources, memories, decisions, and entities | Follows endpoint lifecycle |
| `memory_reviews` | Resolved overlap pairs and the chosen canonical memory, without duplicated content | Removed with either memory or delete-all |
| `skills` | Normalized manifest, install path, permissions, status, checksum | User-controlled |
| `settings` | Versioned local configuration | User-controlled |
| `automations` | Typed local recipe, derived permissions, enablement, schedule cursor, and version | User-controlled |
| `automation_runs` | Redacted trigger, immutable recipe snapshot, step trace, outcome, timing, and retry relationship | Append-oriented; retained if a recipe is deleted |

## Memory fields

A durable memory contains:

- stable identifier;
- kind and scope;
- title, summary, and content;
- active, superseded, or forgotten status;
- confidence and importance in the inclusive range 0 to 1;
- an explicit pinned flag for recurring working context;
- tags;
- source identifier, stable URI, and bounded excerpt when known;
- optional embedding model and vector;
- creation, update, and access timestamps;
- duplicate and redaction metadata.

## Creation

Before storage, BRACE:

1. validates required fields and bounded values;
2. redacts common secret-like patterns;
3. normalizes content for exact hashing;
4. reuses an existing active exact duplicate;
5. records a near-duplicate candidate without auto-merging;
6. lets the user resolve that pair by keeping either record as canonical or confirming both as distinct;
7. persists the review outcome so the same pair is not suggested again;
8. inserts FTS content, relationships, and a timeline event.

BRACE does not store raw chain-of-thought. Users and authorized clients should write concise durable outcomes, not hidden model reasoning.

Pinned memory is a presentation and retrieval-priority signal, not a second copy. Pinning updates the same durable record, survives restart and backup, and can be filtered independently. It does not bypass lifecycle, provenance, redaction, or forgetting rules.

## Evidence

Evidence has an outcome of `promoted`, `rejected`, `deferred`, or `observed`, plus a bounded summary, reference, and observation time. It is displayed separately from the memory's own content.

## Decisions

A decision contains context, the chosen decision, rationale, alternatives, project association, and status. Creating one adds a timeline event and graph relationships. Decisions are not inferred from every chat message.

## Supersession and forgetting

Supersession retains the old record with a pointer to the new one. It is appropriate when context evolved and history still matters.

Forgetting removes the memory's content, summary, source excerpt, evidence, FTS record, and vector. BRACE retains only a non-sensitive tombstone with an identifier, forgotten status, and audit timestamps. Search excludes it.

Delete-all is broader: it removes projects, sources, chunks, memories, review outcomes, decisions, events, entities, relations, skills, automations, run history, and settings while leaving a valid empty schema. Imported project originals remain untouched.

## Retrieval

Lexical recall uses FTS5 rank. Semantic recall uses cosine similarity only for compatible real vectors. Hybrid recall combines ranked lists with reciprocal-rank fusion.

Recall can also apply an explicit ISO timestamp boundary to memory and source-chunk update times. The desktop exposes Today, 7 days, 30 days, and All time without conflating memory timestamps with source provenance.

Every response reports:

- retrieval mode;
- model identifier when vectors contributed;
- separate memory and source lists;
- per-result lexical and semantic ranks when applicable;
- a warning when semantic retrieval failed and lexical fallback completed.

## Backup and export

SQLite backup uses the database backup mechanism and is the complete recovery artifact.

Portable JSON is designed for inspection and migration. It omits absolute project roots and vector blobs, but it still contains user-authored memory and source-derived content. Treat it as private.
