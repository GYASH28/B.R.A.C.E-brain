# Original AI Second Brain fidelity baseline

This document records the application-only product baseline recovered from the
user-owned AI Second Brain 5.3.0 source. It intentionally excludes vault
content, runtime databases, credentials, logs, backups, and machine-specific
configuration.

## Why the public app felt different

The public 0.4 application retained a strong local SQLite memory core but
replaced the original workspace with a smaller memory-management shell. The
rewrite removed or compressed several defining product surfaces:

- the always-present graph-first workspace;
- the original Rings and Living maps;
- the embedded AI workspace and its visible task lifecycle;
- inbox capture and note-oriented review flows;
- workspace permissions, staged changes, checkpoints, and undo;
- provider state, fallback visibility, and diagnostics;
- the original dense sidebar, top command bar, graph explorer, and reading
  panel;
- reflection, timeline playback, agent activity, and voice-oriented extension
  points.

The result was visually polished but behaved like a different, narrower
product.

## Product identity to preserve

BRACE is a local-first AI memory workspace. It should feel like a living map of
the user's work, not a static database browser. Its defining loop is:

1. capture or import context;
2. recall it with explicit provenance;
3. inspect how it connects;
4. hand the relevant context to an AI tool;
5. retain an explicit durable outcome;
6. review how the knowledge changed over time.

The graph, inbox, AI workspace, command center, and local memory service are
therefore one product loop, not separate feature pages.

## Original surfaces

### Workspace shell

- Collapsible left navigation with B.R.A.C.E branding and local-vault state.
- Persistent top command/search bar.
- Fast capture and AI workspace actions.
- Keyboard-first navigation and command palette.
- Dense dark spatial canvas with a reading/inspection panel.

### Knowledge map

- **Rings**: deterministic concentric map centered on the active knowledge
  core. It communicates layer and distance from the center.
- **Living**: animated department/cluster map with relationship motion and
  focus behavior. It communicates activity and neighborhood.
- Atlas/focus navigation, layer filtering, search, connected/island scopes,
  zoom, pan, keyboard travel, and a contextual reader.

### Capture and recall

- Inbox capture that never rewrites imported originals.
- Search across titles, content, tags, links, dates, and local source chunks.
- Separate durable memory and source-evidence results.
- Explicit memory review instead of automatic near-duplicate merging.

### AI workspace

- Persistent conversations and visible runtime stages.
- Stable references to notes and graph neighborhoods.
- Provider capability and connection state.
- Staged changes, diffs, approval, verification, checkpoints, and undo.
- No claim that chat-only providers can safely execute tool/edit tasks.

### Reliability and privacy

- Application state outside the installed app and public repository.
- Existing notes and imported files preserved.
- Context-isolated, sandboxed Electron renderer with narrow IPC.
- Redacted diagnostics and secrets held in the trusted process.
- Clear read-only, ask-before-change, and trusted workspace boundaries.

## Public 0.4 capabilities that remain canonical

- External application-data SQLite database.
- Durable memory lifecycle, evidence, decisions, tombstones, and review pairs.
- Provenance-preserving project indexing.
- Lexical retrieval with optional real-vector semantic ranking.
- Declarative, permission-scoped skill manifests.
- Read-only-by-default MCP stdio server.
- Orbit and Flow graph layouts.
- Synthetic demo workspace and public-release privacy tests.

## Unified navigation contract

The unified product exposes these destinations without duplicating concepts:

- **Command center**: current focus, recent memory, knowledge health, and next
  actions.
- **Knowledge map**: all five layouts and the contextual reader.
- **Inbox**: memory and decision capture plus pending review.
- **AI workspace**: connected-client launcher, retrieval context, and handoff
  receipts.
- **Recall**, **Memory**, **Timeline**, and **Projects**: the durable memory
  library.
- **Skills**, **Connections**, and **Settings**: extension and system surfaces.

## Five graph presets

The graph selector represents five different information structures:

| Preset | Lineage | Primary question |
| --- | --- | --- |
| Rings | Original | What surrounds the current knowledge core? |
| Living | Original | Which clusters and neighborhoods are active? |
| Orbit | Public 0.4 | What belongs to the selected project or memory? |
| Flow | Public 0.4 | How does evidence become a decision and durable memory? |
| Chronicle | Unified | How did this knowledge evolve over time? |

Chronicle is the fifth preset because time is the missing axis across the four
existing maps. It uses real creation, decision, indexing, and event timestamps;
it is not a decorative alternate arrangement.

## Non-goals

- Reintroducing private vault data or hard-coded machine paths.
- Treating generated indexes as canonical user memory.
- Automatically saving every chat turn as durable memory.
- Writing to AI client configuration without a preview, confirmation, and
  recoverable backup.
- Claiming universal background memory without a connected client invoking
  the BRACE tools.
- Restoring dormant demo panels whose values are synthetic or unverifiable.
