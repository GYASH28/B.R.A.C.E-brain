# Changelog

All notable changes to BRACE are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow semantic versioning while the project is in preview.

## [Unreleased]

### Planned

- Collect structured feedback from the 0.7.0 preview.
- Add native signing and update-channel work when maintainers have signing infrastructure.

## [0.7.0] - 2026-09-01

### Added

- Promoted the knowledge graph to a primary **Brain** workspace in navigation, a persistent header beacon, and a live interactive Home preview.
- Added real Fullscreen API support, drag-to-pan, wheel zoom, fit-to-view, collapsible inspection, keyboard traversal, and saved Overview, Focus, and All detail levels.
- Added explicit dense-graph clusters, aggregated relationships, query-neighborhood projection, type counts, grouped-node counts, and a 2,500-node projection stress contract.
- Added document provenance, media/project metadata, indexed passage and section counts, project document counts, and direct continuation into the underlying memory or source search workflow.
- Added the maintained Brain UX contract covering node language, density, performance, responsive behavior, empty/search/filter/fullscreen states, and reduced motion.

### Changed

- Replaced the fixed all-elements SVG renderer with a deterministic level-of-detail model that prioritizes selection, matches, neighbors, projects, degree, and recency while preserving the full graph counts.
- Reworked all five layouts with collision relaxation and density-aware node sizing and labels.
- Limited motion to the selected neighborhood instead of creating a perpetual animation for every relationship.
- Renamed source nodes to user-facing document nodes and made the inspector a real workflow surface rather than a passive description panel.

### Fixed

- Fixed the misleading fullscreen control that previously reset zoom without entering fullscreen.
- Fixed dense-project overlap, multi-second node entrance delays, repeated linear node lookups, unbounded SVG edge/label work, and hidden inspector behavior on narrow desktop windows.

### Verified

- Electron end-to-end coverage now proves real fullscreen entry/exit, zoom, five layout transitions, source selection, keyboard travel, responsive behavior, and zero renderer console errors.
- Dense-graph tests prove bounded node and edge projections, explicit clusters, selected-node retention, search context, and type-filter behavior across 2,500 nodes and roughly 5,000 relations.

## [0.6.0] - 2026-09-01

### Added

- Added task-based **Help & shortcuts**, Library and Automations context tabs, progressive Quick Capture options, a two-step memory-forget guard, and a light frosted first-run path that explains the local boundary in plain language.
- Added a typed local Automation Studio with templates, manual and schedule triggers, BRACE event triggers, bounded AND/OR conditions, derived permission previews, dry runs, global pause, immutable traces, and snapshot-based retries.
- Added schema version 4 with local automation definitions and durable execution history, followed by schema version 5 with durable pinned working context.
- Added Today, 7 days, 30 days, and All time recall scopes across durable memory and indexed source chunks, including MCP timestamp boundaries.
- Added workspace back/forward history, attention badges, recent command ranking, global recall focus, recoverable session capture drafts, type-and-tag capture controls, memory and timeline filters, and copy/related-context actions.
- Added device-local saved recall questions, explicit pin/unpin actions, pinned-memory ordering and filtering, and a 5,000-record long-running profile stress gate covering latency, churn, WAL concurrency, backup recovery, restart persistence, malformed input, redaction, and SQLite integrity.
- Added a memory-to-AI continuation workflow that prepares an editable, device-local handoff draft with the durable memory and its source reference; nothing crosses a provider boundary until the user sends it.
- Added a tactile context relay to the launch site that explains source custody, local memory, and explicit AI handoff through keyboard-operable stage controls and a range input.

### Changed

- Reduced the persistent sidebar from twelve competing destinations to eight clear entry points: Home, Search, Capture, Ask BRACE, Library, Projects, Automations, and AI connections. Timeline, Map, Review, and Skills now appear where their parent workflow is active; Settings and Help remain stable utilities.
- Replaced expert-facing navigation terms and premature focus actions with user-facing language and intentional submits. Global search no longer moves the workspace merely because the field receives focus.
- Rebuilt the desktop as a light-first Frosted Workspace with grouped Work, Library, and System navigation; a real next-useful-move home surface; clearer evidence paper; higher-contrast graph, automation, connection, capture, and AI states; and optional dim/system themes.
- Refined the keyboard flow, focus treatment, responsive navigation, compact-window header, filter toolbelts, transient success feedback, and reset/empty states around real local actions.
- Re-authored the public website as a quieter high-key cobalt and white Liquid Glass product reel, replacing the six competing interactive chapters with one scroll-scrubbed Remotion memory film, one local-custody passage, the retained sideways real-product gallery, and a calm equal-platform installation plate.
- Re-skinned the integrated beginner guide with the same white frosted-glass and blue atmospheric system while preserving every installation, memory, automation, connection, privacy, and troubleshooting workflow.

### Security

- Automation recipes reject arbitrary JavaScript, shell, HTTP, deletion, export, backup, and connector mutations; template lookup rejects prototype keys and secret-like run data is redacted.

### Verified

- The synthetic Electron journey now verifies the task-based help routes, six-key shortcut reference, progressive capture draft restoration, protected memory forgetting, contextual Library/Automation navigation, and compact utility rail in addition to the full product workflow.
- Synthetic Electron journeys now prove capture-draft recovery and clearing, multi-view history, memory and timeline filtering, memory-to-AI draft handoff, responsive collapse without horizontal overflow, automation execution, graph interaction, privacy-safe connections, and zero renderer-console errors.
- The release stress gate proves 5,000-memory operation with explicit p95/p99 recall, bounded graph/list payloads, export, restart, memory-growth, backup parity, concurrent-connection, and database-integrity ceilings.
- The new website film is rendered separately for desktop and portrait, encoded with dense scrub keyframes, and checked for continuous playhead movement, reduced-motion poster behavior, healthy lateral-gallery overflow, keyboard focus, responsive layout, and WCAG 2.2 AA contrast.

## [0.5.0] - 2026-08-28

### Added

- Restored the strongest original AI Second Brain workflows inside the public local-first BRACE boundary, including dedicated Inbox and AI Workspace surfaces.
- Added deterministic Rings, Living, Orbit, Flow, and Chronicle projections over one provenance-backed knowledge graph, with persistent choice, accessible controls, and a relationship inspector.
- Added guided read-only or remember setup for Codex CLI, Claude Code, and Antigravity, alongside platform-correct manual configuration for any stdio MCP client.
- Added the `brace_memory_compass` MCP prompt plus `brace_session_start` and permission-gated `brace_session_handoff` tools for explicit continuity across compatible AI clients.
- Added locally stored, secret-redacted AI Workspace history and an explicit **Retain latest answer** action; no response is promoted to durable memory automatically.
- Added trusted clipboard support through the narrow Electron preload boundary and a website screenshot synchronization gate that accepts only the synthetic Northstar profile.

### Changed

- Rebuilt the desktop navigation and high-signal surfaces around Command center, Knowledge map, Inbox, AI Workspace, Recall, Memory, Timeline, Projects, Skills, Connections, and Settings.
- Replaced placeholder identity elements with the real BRACE brain mark and refreshed the launch-site product proof with the current application, all five graph projections, Inbox, and AI Workspace.
- Expanded the integrated beginner guide with guided connections, provider-boundary disclosure, cross-session handoff, AI retention, and five-mode graph guidance.
- Connection health now says **Configured** when a BRACE config entry exists; only a real AI Workspace turn proves the live client/provider path.

### Fixed

- Guided connector setup now verifies that the expected BRACE entry survived the client command and restores the exact prior configuration when verification fails.
- Rollback removes a newly created config when no file existed before setup, instead of leaving a partial file behind.
- Windows connector path discovery no longer accepts empty application-data candidates.
- Synthetic E2E screenshots and connection output no longer expose the development machine's workspace path.

### Verified

- Native synthetic Electron E2E covers every primary workspace, all five graph views, graph selection/zoom/keyboard travel, retained preferences, review resolution, connections, and zero renderer-console errors.
- MCP source, packaged Linux, and Windows Node-mode simulations cover status plus memory-compass, session-start, and session-handoff behavior.
- AppImage and Debian packages pass local runtime and content audits; the Windows NSIS payload is byte-identical at the ASAR boundary and remains subject to native Windows CI before release publication.
- The launch site passes interaction, responsive-layout, WCAG 2.2 AA, and 111-frame Scrollcraft desktop/mobile/reduced-motion checks with no dead scroll and at least 4.5:1 cue contrast.

## [0.4.0] - 2026-08-27

### Added

- Added a persistent local memory-review workbench for near-duplicate records, with explicit keep-left, keep-right, and keep-both outcomes.
- Added provenance-link and confidence coverage signals to the desktop memory-health surface.

### Changed

- Supersession from the review queue now preserves the noncanonical record for recovery while removing it from active recall.
- Advanced the SQLite data schema to version 3 with transactional migration of review outcomes.
- Packaged asset delivery now derives strict CSP hashes from the exact exported Next.js bootstrap scripts and rejects non-app `brain:` origins.

### Fixed

- Fixed the packaged desktop app remaining on its startup sequence because its strict CSP blocked React hydration.
- Startup snapshot failures now produce a visible, retryable local error state instead of an endless loading screen.
- Removed the deprecated ASAR `fs.Stats` path from packaged asset delivery.

### Verified

- Native package smoke tests now require an interactive renderer state with no console errors; a window merely loading is no longer considered a pass.

## [0.3.0] - 2026-08-25

### Changed

- Replaced the rejected warm/orange identity with the Arctic Glass system: ink-blue depth, ice signal, spectral violet, optical glass edges, and restrained neomorphic pressure.
- Re-authored the launch surface as a split-memory film with an opening sequence, provenance lens cursor, operable recall workbench, local-boundary vault, real-product panorama, and collapsing native download finale.
- Rebuilt the beginner guide in the same responsive glass system and kept every install, recall, graph, skill, MCP, backup, privacy, and troubleshooting workflow grounded in implemented behavior.
- Added a real command palette, global quick capture, numbered workspace navigation, keyboard map, device-local density/motion/contrast preferences, and richer opening, success, error, and empty states.
- Added Orbit and Flow graph layouts, node shapes in addition to color, roving arrow-key navigation, relationship labels, zoom controls, and an accessible adjacency inspector.

### Verified

- Native Electron E2E now covers onboarding, command palette, quick capture persistence, recall, timeline, graph mouse and keyboard travel, both graph layouts, skills, MCP information, and persisted UI preferences using an isolated synthetic profile.
- Scrollcraft contact sheets cover every act at desktop, mobile, and reduced motion with no dead scroll and at least 4.5:1 cue contrast.
- Website WCAG 2.2 AA, native package smoke, persistence, privacy, secret, dependency, and artifact-content gates run before publication.

## [0.2.0] - 2026-08-24

### Changed

- Rebuilt the desktop shell as a layered, motion-rich private memory instrument with stronger hierarchy, responsive navigation, micro-interactions, and reduced-motion support.
- Replaced the static radial graph with a searchable, filterable, zoomable memory constellation, animated provenance paths, keyboard-selectable nodes, and a relationship inspector.
- Reworked Overview around a live memory signal, real local-index vitals, high-signal context, and direct recall and connection actions.
- Rebuilt the public site as a cinematic product journey with live recall, a local-boundary sequence, provenance handoff, packaged-app gallery, responsive layouts, and direct platform downloads.
- Made release artifact discovery version-safe in GitHub Actions and added platform-specific direct download links for Windows, AppImage, and Debian packages.

### Verified

- The launch site and How-to guide pass automated WCAG 2.2 AA checks at desktop and mobile widths with no overflow, unlabeled controls, focus failures, or console errors.
- Packaged Electron E2E uses only the synthetic Northstar profile and exercises Overview, Recall, Timeline, Graph, and Skills without renderer errors.

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

[Unreleased]: https://github.com/GYASH28/B.R.A.C.E-brain/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/GYASH28/B.R.A.C.E-brain/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/GYASH28/B.R.A.C.E-brain/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/GYASH28/B.R.A.C.E-brain/releases/tag/v0.5.0
[0.4.0]: https://github.com/GYASH28/B.R.A.C.E-brain/releases/tag/v0.4.0
[0.3.0]: https://github.com/GYASH28/B.R.A.C.E-brain/releases/tag/v0.3.0
[0.2.0]: https://github.com/GYASH28/B.R.A.C.E-brain/releases/tag/v0.2.0
[0.1.0]: https://github.com/GYASH28/B.R.A.C.E-brain/releases/tag/v0.1.0
