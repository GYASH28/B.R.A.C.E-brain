# BRACE production audit

Baseline commit: `769afc901d934bd42d3e123848a961bf88b03a71`
Baseline product version: `0.7.0`
Hardening branch: `production-hardening-2026-09`

This is the live issue register for turning BRACE from preview software into a stable production-grade local-first product. An item is not marked complete merely because code exists; the relevant regression test and release gate must pass.

| Priority | Subsystem | Verified finding | Required invariant / fix | Regression evidence | Status |
| --- | --- | --- | --- | --- | --- |
| P0 | Dependencies | The baseline lockfile resolves Next.js 16.3.2, below the patched line for the August 2026 critical advisory. | Upgrade Next.js and compatible framework tooling to a patched supported release and regenerate the lockfile. | `npm audit`, full `verify`, Electron E2E and packaged/static export checks. | In progress |
| P0 | Electron IPC | Privileged IPC handlers accepted renderer calls without independently validating caller frame/origin. | Every privileged channel passes through one main-frame + exact-origin + expected-WebContents gate. | `tests/ipc-security.test.js`, `tests/electron-boundary.test.js`, Electron E2E. | Implementation in progress |
| P0 | Electron IPC | Many privileged payloads relied on TypeScript shapes / `any` at runtime. | Every registered channel has a bounded runtime Zod tuple schema. | malformed and oversized IPC unit tests + typecheck. | Implementation in progress |
| P1 | Embeddings | Initial endpoint validation did not explicitly prevent a provider redirect from crossing the validated trust boundary. | Provider requests reject redirects or validate every redirect target. Response size is bounded before JSON parsing. | redirect and oversized-response tests. | Implementation in progress |
| P1 | Website | Public deployment did not declare a global browser security-header policy. | CSP, frame protection, nosniff, referrer and permissions policies ship with the site. | `tests/website-security-headers.test.js` + deployed-header verification. | Implemented; CI pending |
| P1 | Indexing | Project traversal and file reads are synchronous and can block the Electron process on large projects. | Heavy scan/read/chunk work runs outside the interactive Electron event loop with cancellation and bounded progress reporting. | large-project responsiveness and cancellation tests. | Planned |
| P1 | Indexing | Filename exclusions cannot catch credentials embedded in ordinary source filenames. | Add `.braceignore` plus best-effort content secret detection/redaction before persistence/provider boundaries. | synthetic secret fixtures and exclusion tests. | Planned |
| P1 | Index consistency | Chunk rows are replaced before optional embeddings finish, so embedding failure can leave a changed source without its previous complete vector state. | Prepare source/chunks/embeddings before committing each changed source, preserving the last complete index on failure/cancel. | failure-injection indexing tests. | Planned |
| P1 | Recovery | Consistent backup exists, but verified automatic pre-migration recovery and first-class restore are not complete. | Create and verify a recovery snapshot before real schema migration; add integrity checks and atomic restore/restart flow. | released-schema migration + restore fixtures. | Planned |
| P1 | Architecture | The desktop product UI is concentrated in a roughly 170 KB `brace-app.tsx`; renderer state also spans a broad central store. | Split by product domain while preserving behavior and the current data/security model. | app E2E + visual/interaction regressions. | Planned |
| P1 | Renderer synchronization | Many mutations reconcile by fetching a broad snapshot. | Return/update affected entities selectively, with full refresh retained where safer. | mutation E2E + stale-state tests. | Planned |
| P2 | Website | Historic versioned CSS/JS layers have accumulated around the static launch surface. | Inventory what is actually loaded, remove proven dead assets, and establish reproducible source/build output rather than another versioned hotfix layer. | visual/layout/a11y/performance suite. | Planned |
| P2 | UX | Product capability has grown faster than the navigation mental model and long-running-task UX. | Simplify primary information architecture, improve onboarding, command navigation, task progress/cancel and actionable errors. | critical-journey usability + keyboard E2E. | Planned |
| P2 | Retrieval | Retrieval is source-aware but users lack a compact explanation of why a result ranked. | Add an optional retrieval/provenance inspector without invented confidence. | deterministic retrieval evaluation suite. | Planned |
| P2 | Distribution | Preview artifacts already have checksums/SBOM, but stable release still needs signing, provenance and upgrade qualification. | Code signing, artifact provenance and previous-release upgrade test precede any stable label. | release-candidate workflow. | Planned / signing credentials external |

## Existing strengths to preserve

- local SQLite + FTS5, WAL, foreign keys and transactional migrations
- source evidence kept distinct from durable memory
- sandboxed Electron renderer with context isolation and Node integration disabled
- explicit network/provider boundaries and read-only-by-default AI/MCP integration
- typed declarative automations rather than arbitrary code execution
- consistent SQLite backup support and explicit destructive confirmation
- Windows/Linux CI, Electron E2E, executable MCP smoke, package audit, SHA-256 manifest and CycloneDX SBOM
- CodeQL and dependency/license audit gates
- deterministic website accessibility, layout, focus, interaction, performance and visual audits

## Release rule

Do not label BRACE `PRODUCTION/STABLE READY` until all P0 findings are closed and migration/recovery, packaged Windows/Linux, accessibility, security, performance and previous-release upgrade gates have passed. If code signing is unavailable, the release must remain clearly labeled preview/release-candidate rather than stable.
