# Getting started

This guide covers a source checkout. If you downloaded an installer, launch BRACE and begin at [First launch](#first-launch).

## Requirements

- Node.js 24 or newer
- npm
- Linux or Windows for the packaged 0.4.0 desktop
- A graphical desktop session for Electron

Optional:

- Ollama on loopback for semantic and hybrid retrieval
- An MCP-compatible AI client

## Install from source

```bash
git clone https://github.com/GYASH28/B.R.A.C.E-brain.git
cd B.R.A.C.E-brain
npm ci
```

Run the core quality gate:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run electron:compile
```

Start desktop development:

```bash
npm run electron:dev
```

Build a production package for the current platform:

```bash
npm run electron:dist
```

Generated output goes to `dist/installer/` and is intentionally ignored by Git.

## First launch

A fresh database starts empty. BRACE does not silently load sample memories or scan the computer.

Choose one action:

- **Import a project** opens a native folder picker. Select one specific repository or notes folder.
- **Explore synthetic demo** creates the fictional Northstar workspace and two bundled declarative skills.

The demo can be initialized more than once without duplicating its records.

## Index a project

Open **Projects**, choose **Import folder**, then select a focused directory. BRACE refuses a filesystem root and the current user's home directory.

The indexer:

- reads only allowlisted text extensions;
- skips binary files and files larger than 2 MB by default;
- stops after 20,000 files by default and reports truncation;
- ignores credentials, environment files, databases, logs, dependencies, build output, caches, and version-control metadata;
- never follows symlinks;
- stores stable `brace-project://` URIs rather than an absolute root inside provenance;
- replaces changed chunks and removes missing sources during reindex.

Imported originals remain canonical. BRACE never edits or moves them.

## Create durable memory

Open **Memories**, choose **New memory**, and record one focused piece of context. Choose the narrowest useful scope and a specific kind:

- `decision`
- `lesson`
- `warning`
- `preference`
- `summary`
- `hypothesis`
- `fact`
- `procedure`
- `project`

Attach a source URI and excerpt when available. BRACE redacts common credential-like values before durable storage, but redaction is a safety net, not permission to paste secrets.

Exact normalized duplicates reuse the active record. Similar records are returned as review candidates and are not auto-merged.

## Recall

Open **Recall** and search in plain language. Results are separated into:

- **Durable memories**, created explicitly or through an authorized skill or MCP write.
- **Source evidence**, rebuilt from imported project files.

The response reports its mode:

- `lexical` when FTS5 alone is used;
- `semantic` when a compatible real vector is used without lexical matches;
- `hybrid` when both result lists are fused.

## Optional local embeddings

Start Ollama separately and pull an embedding model, for example:

```bash
ollama pull nomic-embed-text
```

In **Settings**, enable local Ollama embeddings, keep the endpoint on `http://127.0.0.1:11434`, and save the model name. Reindex projects to create vectors for existing source chunks.

If Ollama is down or returns incompatible vectors, BRACE completes lexical search and reports a warning. It does not invent vector scores.

## Connect an AI

Open **Connections** and copy the generated executable configuration. MCP starts read-only. See [MCP.md](MCP.md) before enabling write flags.

## Back up before experimenting

Open **Settings** and choose **Create SQLite backup**. Portable JSON export is useful for inspection and migration, but a SQLite backup is the complete recovery artifact.

Both contain private data. Store them outside the source repository, preferably on encrypted storage.

## Next steps

- [Privacy model](PRIVACY.md)
- [MCP guide](MCP.md)
- [Skills guide](SKILLS.md)
- [Troubleshooting](TROUBLESHOOTING.md)
