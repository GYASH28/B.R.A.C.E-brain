# Repository map

BRACE keeps product code, public examples, release tooling, and the launch website in one repository while keeping all real user memory outside it.

| Path | Owns | Must not contain |
| --- | --- | --- |
| `core/` | Memory store, retrieval, indexing, graph, lifecycle, and skills | Renderer concerns or machine-specific paths |
| `electron/` | Hardened desktop main process, preload bridge, and provider adapters | Unvalidated renderer input or broad filesystem access |
| `src/` | Next.js renderer and browser-safe UI state | Node/Electron privileges or database access |
| `tests/` | Core, privacy, product UI, MCP, and Electron boundary verification | Real user files or shared mutable databases |
| `examples/` | Synthetic Northstar workspace and declarative sample skills | Personal memories, credentials, or generated indexes |
| `scripts/` | Build, release, audit, packaging, and smoke-test entry points | Product behavior that belongs behind a tested public seam |
| `docs/` | Maintained user, architecture, privacy, integration, and release documentation | Generated output or private diagnostics |
| `artifacts/screenshots/` | Privacy-safe product screenshots generated from Northstar | Personal data or machine-specific UI state |
| `assets/` and `public/` | Brand and renderer assets | Secrets or runtime databases |
| `website/builds/brace/` | Deployable static launch site and its browser audits | Application runtime state or experimental drafts |
| `website/remotion-opening/` | Source project for the opening film | Render caches or unrelated site code |
| `website/lab/` | Non-production visual experiments | Assets assumed by the deployed site |
| `.github/` | CI, security, release, Pages, and contribution automation | Credentials committed in workflow files |

## Generated directories

`.next/`, `out/`, `dist/`, coverage output, package caches, local databases, diagnostics, and rendered video intermediates are generated. They should remain ignored unless a release process explicitly publishes a narrowly scoped artifact.

## Data boundary

Installed BRACE state belongs in the operating-system application-data directory or a user-selected directory. Imports index sources without rewriting them. Tests and screenshots use only `examples/demo-workspace` or an isolated temporary directory.

Read [Architecture](ARCHITECTURE.md) for runtime boundaries and [Privacy](PRIVACY.md) before changing storage, import, export, backup, or deletion behavior.
