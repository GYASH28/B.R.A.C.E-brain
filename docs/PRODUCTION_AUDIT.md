# BRACE production audit

Baseline commit: `4d676edb571c1e7432b95723ec2d17aaa522c3e9`  
Starting application version: `0.7.0`  
Audit scope: desktop renderer, Electron boundary, indexing, local data, graph, automations, public website, packaging, and release infrastructure.

This register records evidence, intended proof, and actual status. A checked implementation item is not a claim that BRACE is production/stable ready; the completion gates at the end remain authoritative.

| Severity | Subsystem | Evidence / risk | Intended fix and proof | Status |
| --- | --- | --- | --- | --- |
| P0 | Electron IPC | `electron/memory-service.ts` previously registered privileged handlers without validating their renderer origin. | Route every handler through one exact-origin/top-frame guard; regression-test packaged, development, malformed, and hostile origins. | Implemented; tests in `tests/ipc-trust.test.js`. |
| P0 | IPC payloads | Main-process handlers previously accepted unbounded `any` payloads. | Validate every registered channel at runtime, reject unknown fields, and cap strings/lists/objects. | Implemented contract gateway in `src/shared/ipc/schemas.ts` and typed preload surface; contract tests pass. |
| P0 | Project content | Ordinary source files could contain credentials even when filenames looked safe. | Best-effort content scanning/redaction before chunks or embeddings; never log recovered values. | Implemented with synthetic regression coverage; documented as defense in depth. |
| P0 | Framework dependencies | The original production prompt identified Next.js 16.3.2 as requiring review; the August 2026 security release requires 16.3.3 or newer. | Upgrade to the current Active LTS patch, refresh lockfile, audit, build, package, and run E2E. | Upgraded to 16.3.4 with matching ESLint config; dependency audit reports zero vulnerabilities. Full packaged E2E remains part of the final gate. |
| P1 | Graph scale | Snapshot exposed only 500 records per graph category and layout collision work was quadratic. | Support a 10k-class logical graph, render bounded LOD, and spatially index collision relaxation. | Implemented; 10k projection and maximum-detail layout benchmarks pass. |
| P1 | Graph fullscreen | Browser Fullscreen API behavior was unreliable inside Electron and could fail silently. | App-level focus surface with visible exit, `F`, and `Escape`; verify viewport bounds in browser and Electron. | Implemented; browser interaction verified. Packaged Electron visual check remains open. |
| P1 | Graph accessibility | SVG was the only complete traversal surface. | Add keyboard spatial traversal and a list-equivalent node index tied to current filters/detail. | Implemented; automated accessibility E2E remains open. |
| P1 | Project indexing thread | Traversal and file reads previously executed from the trusted Electron process. | Move traversal/read/chunk/scan to a Worker with a narrow protocol, cancellation, bounded progress, and staged source commits. | Implemented in `core/project-index-worker.js` / `core/project-index-jobs.js`; cancellation and atomic-source tests pass. |
| P1 | Recovery | Backups existed without a first-class validated restore and pre-migration backup flow. | Add integrity preview, current-state safety backup, atomic restore, restart, and old-schema fixtures. | Implemented in `core/database-recovery.js` and Settings; migration/recovery tests pass. |
| P1 | Distribution | Windows artifacts are unsigned and no verified updater path exists. | Add signing, timestamp verification, provenance, upgrade tests, then opt-in signed updates. | Artifact provenance is wired for tagged builds. Signing and an updater remain external release blockers; packages remain preview-only. |
| P1 | App architecture | `brace-app.tsx` and `memory-store.js` were large multi-domain modules. | Split by real domain seams with behavior and regression coverage. | In progress: Graph, Automations, Organization, task center, page primitives, desktop adapters, indexing/recovery/import/watch services, and organization repository are extracted. Further view/repository splits are maintainability work, not a data-safety blocker. |
| P1 | Enterprise product | No organization or workspace boundary existed. | Preserve Personal local memory and add optional governed workspaces with transparent ownership. | Local organization/workspace/member/role/audit foundation implemented. Networked collaboration, SSO/SCIM and remote policy enforcement are deliberately not claimed. |
| P2 | Documents UX | Sources were mainly discoverable through search/project cards. | Add a provenance-first Documents ledger with project filtering, recall, and direct graph-node focus. | Implemented. |
| P2 | Navigation | The graph was prominent but not the initial product surface. | Make Brain first/default, retain Home as the attention surface, and connect every domain page back to Brain. | Implemented. |
| P2 | Diagnostics | Sanitized logging existed without a user-auditable support bundle. | Add local diagnostics, integrity status, job health, redacted preview, and explicit export. | Implemented; support bundle excludes memory/source content, project names/paths, credentials, and logs by default. |
| P2 | Website architecture | Legacy versioned CSS/JS layers accumulated. | Consolidate loaded assets, remove proven dead layers, and retain interaction/a11y/performance tests. | Implemented in current website worktree; deployment verification pending. |
| P2 | Website experience | Public site lacked a coherent opening/product story. | Cinematic opening, deterministic product film, reduced-motion path, and real guide launchpad. | Implemented in current website worktree; external deployment pending. |

## Baseline evidence

At the recorded starting commit plus pre-existing worktree changes:

- `npm run typecheck`: passed.
- `npm test`: 60/60 passed.
- `npm run lint`: passed with one pre-existing unused-expression warning in the graph keyboard handler.
- `npm run electron:compile`: passed after the first security slice.
- Focused graph, IPC, and indexing suites pass after their corresponding changes.

## Business-grade architecture boundary

Enterprise BRACE must be additive:

```text
BRACE Personal data plane (local/offline/private)
                │ explicit publish/sync
                ▼
BRACE Team workspaces (shared, cited, permission-aware)
                │ organization policy
                ▼
BRACE Enterprise control plane (identity, policy, audit, integrations)
```

Personal memory is not an employer surveillance surface. Company administrators may govern company-owned workspaces, sources, retention, and access; they do not silently acquire private local memory.

## Current release assessment

`PREVIEW READY` only. The repository now includes worker-isolated indexing, staged source commits, recovery, diagnostics, graph LOD, guarded imports, automation resilience, and a local organization foundation. Stable production remains blocked by Windows code-signing credentials, native packaged release evidence for the candidate commit, and a proven signed upgrade channel. Networked enterprise collaboration is a separate product phase and is not implied by the local company workspace UI.
