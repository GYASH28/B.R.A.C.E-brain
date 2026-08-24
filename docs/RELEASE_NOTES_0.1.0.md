# BRACE 0.1.0 preview

BRACE 0.1.0 is the first public release candidate of a local-first personal AI memory layer: **One memory. Every AI.**

## Included

- Structured SQLite memory, evidence, decisions, events, entities, relationships, FTS5 retrieval, migrations, consolidation signals, supersession, and content-erasing forget tombstones.
- Guarded project indexing with incremental hashes, provenance URIs, secret/build-directory exclusions, and no symlink traversal.
- Lexical retrieval by default, plus honest semantic and hybrid ranking only when a real embedding adapter returns compatible vectors.
- Recall, Memories, Timeline, Graph, Projects, Skills, Connections, Settings, export, backup, and confirmed deletion in a hardened Electron desktop.
- Official MCP v2 stdio integration, read-only by default, with separate write and destructive opt-ins.
- Declarative permission-scoped BRACE Skills and two synthetic example manifests.
- A synthetic Northstar demo, real synthetic-data product screenshots, a public launch site, and a beginner How-to guide.

## Packages

- `BRACE-0.1.0.AppImage`
- `brace-brain_0.1.0_amd64.deb`
- `BRACE Setup 0.1.0.exe`
- `SHA256SUMS.txt`
- `brace-0.1.0.cdx.json` CycloneDX dependency SBOM

All installers are unsigned preview artifacts. Verify the SHA-256 file before running them. Windows may show SmartScreen and Linux installations may require normal AppImage/FUSE setup.

## Known limits

- No macOS package, automatic updates, code signing, or database-level encryption in this preview.
- Semantic retrieval requires a user-configured embedding provider; local full-text retrieval needs none.
- Project indexing supports allowlisted text formats, not PDFs, images, audio, or proprietary documents.
- Deterministic graph extraction is intentionally conservative.

See `README.md`, `docs/GETTING_STARTED.md`, and `docs/DISTRIBUTION.md` for setup, verification, and the complete limitations list.
