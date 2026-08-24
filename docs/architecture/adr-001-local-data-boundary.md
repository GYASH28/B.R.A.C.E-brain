# ADR-001: Keep application code separate from external user data

Status: Accepted

## Context

BRACE imports files from user-selected projects, stores durable structured
memory, exposes local MCP access, and ships as a desktop app. The installed
baseline mixed generated vault data with application source, which made a safe
public repository impossible and coupled the app to one machine layout.

## Options considered

| Option | Benefits | Costs |
| --- | --- | --- |
| Keep the repository as the vault | Simple paths | Unsafe distribution, accidental commits, read-only install locations, poor multi-user behavior |
| Store everything only in Markdown | Portable and inspectable | Weak transactional updates, migrations, ranking, deduplication, and audit queries |
| External SQLite plus source adapters | Transactional structured memory, FTS, migrations, backup, provenance, portable files | Requires a clear canonical-source rule and migration tests |

## Decision

BRACE uses an external SQLite database under the operating system application
data directory for structured memory, evidence, timeline events, decisions,
relations, skill state, and settings. Imported files stay canonical in their
original locations; the database stores provenance, hashes, derived chunks,
and retrieval metadata. Synthetic demo data lives in the repository but is
copied into an isolated demo profile at runtime.

## Consequences

- Installing or updating BRACE cannot overwrite user memory.
- The repository and installers can be scanned without opening private data.
- Export, backup, migration, restart, and delete-all behavior have explicit
  boundaries and can be tested with temporary profiles.
- Files and structured memories can disagree; provenance and refresh status must
  be visible instead of silently treating derived data as the source of truth.
- SQLite support requires Node.js 24 for development; Electron supplies the
  runtime to packaged users.

## Revisit trigger

Reconsider the storage engine if multi-user synchronization becomes a product
requirement or Node's built-in SQLite support is no longer portable across the
supported Electron targets.
