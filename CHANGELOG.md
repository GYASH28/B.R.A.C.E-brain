# Changelog

All notable changes to BRACE are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow semantic versioning while the project is in preview.

## [Unreleased]

### Planned

- Collect structured feedback from the 0.1.0 preview.
- Add native signing and update-channel work when maintainers have signing infrastructure.

## [0.1.0] - 2026-08-24

### Added

- Structured SQLite memory, evidence, decisions, timeline events, entities, relations, settings, and FTS5 indexes.
- Explicit memory lifecycle with redaction, deduplication, supersession, forgetting, backup, export, and delete-all.
- Guarded incremental project indexing with private-path-free provenance.
- Lexical, real semantic, and hybrid retrieval with Ollama and HTTPS-compatible embedding adapters.
- Declarative permission-scoped BRACE Skills with checksum integrity verification.
- MCP v2 stdio server with read-only defaults and separately gated write and destructive tools.
- Direct packaged executable MCP mode through `--mcp`.
- Hardened Electron desktop with first-run onboarding and implemented Overview, Recall, Memories, Timeline, Graph, Projects, Skills, Connections, and Settings views.
- Synthetic Northstar demo workspace, example skills, real application captures, Scrollcraft launch surface, and beginner How-to.
- Linux AppImage and Debian packaging, Windows NSIS packaging, CI, CodeQL, Pages, and tagged-release workflows.

### Security

- Removed private seed data, machine-specific paths, legacy local servers, arbitrary plugin execution, and broad renderer privileges from the public candidate.
- Added secret-pattern tests, dependency auditing, strict embedding endpoint validation, sandboxed rendering, CSP, and repository hygiene controls.

[Unreleased]: https://github.com/GYASH28/B.R.A.C.E-brain/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/GYASH28/B.R.A.C.E-brain/releases/tag/v0.1.0
