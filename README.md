# BRACE

**One memory. Every AI.**

[![CI](https://github.com/GYASH28/B.R.A.C.E-brain/actions/workflows/ci.yml/badge.svg)](https://github.com/GYASH28/B.R.A.C.E-brain/actions/workflows/ci.yml)
[![CodeQL](https://github.com/GYASH28/B.R.A.C.E-brain/actions/workflows/codeql.yml/badge.svg)](https://github.com/GYASH28/B.R.A.C.E-brain/actions/workflows/codeql.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-c8f45d)](LICENSE)

BRACE is a local-first personal AI memory layer for people who work across multiple AI tools. It turns selected project files, explicit decisions, durable memories, evidence, timelines, and relationships into one provenance-backed store. MCP-compatible clients can recall the same context without a BRACE cloud account or hosted middleman.

> Release status: **0.3.0 preview**. Linux is locally smoke-tested. Windows is built and tested by the repository's native GitHub Actions runner. Packages are not yet code-signed.

![BRACE Overview using the synthetic Northstar workspace](artifacts/screenshots/app-overview.png)

## What is implemented

- Structured SQLite memory with migrations, full-text search, evidence, decisions, events, entities, relationships, settings, and skills.
- Durable memory lifecycle: explicit creation, exact deduplication, near-duplicate review signals, supersession, retrieval tracking, and content-erasing forget tombstones.
- Project indexing with heading-aware chunks, incremental hashes, allowlisted text formats, ignored credentials/dependencies/build output, no symlink traversal, and private-path-free provenance URIs.
- Lexical search by default. Semantic and hybrid reciprocal-rank fusion only when a real embedding model returns compatible vectors.
- Optional loopback Ollama embeddings and an advanced HTTPS OpenAI-compatible adapter.
- A real decision timeline and a provenance-backed knowledge graph.
- Declarative, permission-scoped BRACE Skills. No arbitrary JavaScript, shell, or dynamic code execution.
- Official MCP v2 stdio tools with structured results and read-only defaults. Writes and destructive forgetting use separate opt-in flags.
- A hardened Electron boundary with context isolation, sandboxing, navigation and popup denial, a narrow preload bridge, CSP, and external application-data storage.
- Privacy-safe JSON export, consistent SQLite backup, per-memory forgetting, and confirmed delete-all.
- Synthetic Northstar demo data and screenshots. The repository contains no personal memory seed.

## Install

Download a package from the [BRACE 0.3.0 release](https://github.com/GYASH28/B.R.A.C.E-brain/releases/tag/v0.3.0):

- **Windows:** `BRACE-Setup-0.3.0.exe`
- **Debian / Ubuntu:** `brace-brain_0.3.0_amd64.deb`
- **Other Linux distributions:** `BRACE-0.3.0.AppImage`

Verify the artifact against `SHA256SUMS.txt` in the release before running it. The preview installers are not code-signed, so the operating system may display an unknown-publisher warning.

For the full first-run walkthrough, see the [beginner How-to](website/builds/brace/how-to/index.html) or the [source getting-started guide](docs/GETTING_STARTED.md).

## Run from source

Requirements:

- Node.js 24 or newer
- npm
- A desktop environment for the Electron application

```bash
git clone https://github.com/GYASH28/B.R.A.C.E-brain.git
cd B.R.A.C.E-brain
npm ci
npm test
npm run electron:dev
```

Useful verification commands:

```bash
npm run lint
npm run typecheck
npm run build
npm run electron:compile
npm run electron:e2e
npm run electron:mcp-smoke
```

## First run

A fresh BRACE database is empty. The desktop presents two explicit actions:

1. **Import a project** to index one specific folder you select.
2. **Explore synthetic demo** to create the fictional Northstar workspace.

The demo is idempotent, clearly labelled, and stored in the same local application-data boundary as other BRACE content. Imported originals remain where they are and are never edited.

![BRACE Recall keeps durable memory and source evidence separate](artifacts/screenshots/app-recall.png)

## Connect an AI through MCP

The packaged executable can launch the MCP server directly. Open **Connections** in BRACE and copy the exact platform-specific configuration for your installation. Linux uses the following form; Windows generates the bundled-server path and required Electron Node-mode environment automatically:

```json
{
  "mcpServers": {
    "brace": {
      "command": "<path-to-BRACE-executable>",
      "args": ["--mcp"]
    }
  }
}
```

A source checkout can also run:

```json
{
  "mcpServers": {
    "brace": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "<path-to-B.R.A.C.E-brain>"
    }
  }
}
```

The default exposes only read tools. To authorize a trusted client to write memory, add `BRACE_MCP_WRITE=1` to that server process. Forgetting remains unavailable unless `BRACE_MCP_DESTRUCTIVE=1` is also set.

See [MCP.md](docs/MCP.md) for the tool inventory, threat model, environment variables, and client examples.

## Local data boundary

| Platform | Default database |
| --- | --- |
| Windows | `%APPDATA%\BRACE\brace.sqlite3` |
| Linux | `$XDG_DATA_HOME/brace/brace.sqlite3`, falling back to `~/.local/share/brace/brace.sqlite3` |
| macOS source builds | `~/Library/Application Support/BRACE/brace.sqlite3` |

Set `BRACE_DATA_DIR` to use another specific directory, or `BRACE_DATABASE_PATH` for an advanced process-level database override. Root directories are rejected.

The public repository, installers, portable JSON export, MCP project listing, and project provenance never need to expose selected absolute project roots. Backups are intentionally complete and therefore sensitive.

Read [PRIVACY.md](docs/PRIVACY.md) before importing confidential work.

## Retrieval modes

| Mode | When it is used | Data movement |
| --- | --- | --- |
| Lexical | Always available and the default | None |
| Semantic | A real compatible query vector is supplied | Depends on configured adapter |
| Hybrid | Both full-text and compatible vectors are available | Depends on configured adapter |

BRACE never labels lexical search as semantic. Hybrid results use reciprocal-rank fusion and report the embedding model. The desktop exposes loopback Ollama configuration; the core also supports HTTPS OpenAI-compatible embedding endpoints for advanced deployments.

## BRACE Skills

BRACE Skills are declarative `brace-skill.json` manifests, not executable plugin bundles. Installation requires the exact declared permission set, third-party skills start disabled, and a stored checksum detects later tampering.

Two MIT-licensed synthetic examples live under [`examples/skills`](examples/skills). Locally installed Codex skills are not copied into this repository.

Read [SKILLS.md](docs/SKILLS.md) before authoring or installing a skill.

## Architecture

```text
selected project files ──> guarded indexer ──> SQLite + FTS5
                                                │
explicit memories + decisions ──────────────────┤
                                                ├──> desktop recall / timeline / graph
optional real embeddings ──> compatible vectors ┤
                                                └──> read-only MCP by default
```

The desktop renderer cannot read the filesystem, open a database, spawn a process, or make unrestricted network calls. Electron main owns a narrow IPC service. The MCP process opens the same external database through stdio and has no network listener.

See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [DATA_MODEL.md](docs/DATA_MODEL.md), and the [architecture decisions](docs/architecture).

## Documentation

- [Getting started](docs/GETTING_STARTED.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model and lifecycle](docs/DATA_MODEL.md)
- [Privacy model](docs/PRIVACY.md)
- [MCP connection guide](docs/MCP.md)
- [Skills guide](docs/SKILLS.md)
- [Distribution and verification](docs/DISTRIBUTION.md)
- [Dependency and license review](docs/DEPENDENCY_REVIEW.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Roadmap](ROADMAP.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## Honest limitations

- Preview installers are unsigned. There is no automatic update channel.
- macOS packaging is not part of 0.3.0.
- Full-text search works without another service; semantic ranking requires the user to run or configure an embedding provider.
- Remote HTTPS embeddings are an advanced source-level feature. The desktop settings intentionally expose loopback Ollama only.
- Project indexing is text-oriented and does not parse PDFs, images, audio, or proprietary document formats in 0.3.0.
- BRACE does not encrypt the database itself. Rely on operating-system full-disk encryption and protect exported backups.
- MCP stdio inherits the trust of the client process that launches it. Read-only is the default, not an authentication system.
- The knowledge graph uses deterministic entity and relationship extraction, not an opaque model. It is inspectable but intentionally conservative.

## License

BRACE is available under the [Apache License 2.0](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled dependency and asset notices.
