# ADR-003: Merge the original workspace with the external memory core

- Status: Accepted
- Date: 2026-08-27

## Context

The original AI Second Brain 5.3.0 application provided a graph-first desktop
workspace, inbox, embedded AI surface, provider lifecycle, permissioned
workspaces, and recovery controls. The public BRACE 0.4 rewrite established a
safer distribution boundary and a stronger durable-memory model, but removed
much of that recognizable product surface.

Users need one product that preserves the original experience while keeping
the public build's privacy, provenance, and release guarantees. They also need
the same memory to be available to several AI clients without copying the
database into each client.

## Decision

BRACE will keep the external application-data SQLite service as the single
memory authority and rebuild the original workspace as a client of that
service.

The renderer will receive data and perform actions only through named Electron
IPC operations. Imported project files remain canonical and read-only to the
indexer. AI clients connect to the same database through the bundled local
stdio MCP server.

The product will expose five graph projections over one typed graph:

1. Rings;
2. Living;
3. Orbit;
4. Flow;
5. Chronicle.

Layout selection changes spatial semantics, not the underlying nodes or
relationships.

## Connector contract

Each connector adapter owns:

- client detection and version reporting;
- a platform-correct BRACE stdio launch definition;
- a configuration preview with read-only or write-enabled memory mode;
- an explicit installation action in the trusted Electron process;
- a recoverable configuration backup before any edit;
- a non-mutating health check;
- client-specific verification and removal guidance.

Configuration presence is reported as **Configured**, not **Connected**. A live
AI Workspace or MCP request is required to verify the runtime path through the
client and its selected model provider. After guided setup, the adapter must
re-read the target configuration; a missing BRACE entry is a failed
transaction and triggers restoration.

Adapters initially cover Codex CLI, Claude Code, Antigravity CLI/IDE, and a
generic MCP JSON block. New clients implement the same contract instead of
adding renderer-side filesystem access.

## Shared-memory lifecycle

Connection does not mean that every model message becomes memory. The MCP
surface separates four operations:

- recall relevant durable memory and source evidence;
- open one item with provenance;
- explicitly retain a durable outcome;
- record a session handoff containing decisions, lessons, open questions, and
  next actions.

Read-only mode remains the default. Non-destructive writes require explicit
connector permission. Forgetting remains a separate destructive capability.

## AI workspace boundary

The desktop AI workspace may launch or hand off to an installed client only
through allowlisted adapter commands. It cannot execute an arbitrary shell
string. A launch receipt records the chosen client, context scope, and time;
the prompt is not automatically persisted as durable memory.

File-changing agent work remains outside the memory database unless a future
version reintroduces the original staged-workspace engine with equivalent or
stronger tests for permission, diff, checkpoint, and undo behavior.

## Migration

The existing schema is migrated transactionally. New connector and handoff
metadata is application-owned state. No migration scans a user home directory,
imports old private databases automatically, or rewrites an imported project.

Legacy AI Second Brain content can be imported only through an explicit,
previewed migration flow in a later slice. The K.G. hard-disk source is a
fidelity reference, not a runtime dependency.

## Consequences

### Positive

- The original product identity returns without reviving its source/vault
  coupling.
- Every supported AI client sees the same durable memory.
- Connector support is testable and extensible.
- Graph presets remain honest projections of real data.
- The public privacy and release scanners remain applicable.

### Negative

- Some original 5.3 agent-edit functionality must be restored in stages rather
  than copied wholesale.
- Client configuration formats can change and require maintained adapters.
- A connected AI can receive private retrieval results according to that
  client's own provider policy; BRACE must explain this before connection.

## Rejected alternatives

### Replace the public app with the original source tree

Rejected because it couples application code and a private vault, carries
machine-specific assumptions, and weakens the external-data release boundary.

### Keep the public shell and only add more cards

Rejected because it does not restore the graph-first workflow, inbox, AI
workspace, or recognizable interaction model.

### Maintain a separate memory database per AI client

Rejected because it creates divergence, duplicate retention, and unclear
deletion semantics.

### Automatically save complete chat transcripts

Rejected because transcripts include transient context, secrets, and hidden or
low-value reasoning. BRACE stores explicit durable outcomes and handoffs.
