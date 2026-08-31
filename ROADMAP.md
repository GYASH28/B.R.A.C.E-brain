# BRACE roadmap

This roadmap is directional, not a promise of dates. Privacy, data portability, and clear provenance take priority over feature count.

## 0.5 preview stabilization

- Validate Windows installer and packaged MCP behavior on more machines.
- Add signed artifact attestations and document reproducibility constraints for every release.
- Expand screen-reader journey coverage beyond the existing keyboard-reachable graph and dialog controls.
- Improve large-project indexing benchmarks and cancellation feedback.
- Add an in-app disclosure before configuring any non-loopback embedding provider.

## Shipped in 0.5

- Review queue for near-duplicate and potentially superseded memories.
- Inbox triage, explicit evidence-backed recall, and AI Workspace retention.
- Five deterministic graph projections with accessible inspection.
- Guided Codex CLI, Claude Code, and Antigravity configuration with recoverable backups.
- Explicit session-start and session-handoff continuity through MCP.

## Implemented after 0.5

- Typed local automation recipes with manual, schedule, memory, decision, project-index, and handoff triggers.
- Bounded AND/OR conditions, permission-derived actions, dry-run previews, immutable traces, retries, and global pause.
- Time-scoped recall over both durable memory and indexed source evidence.
- Durable pinned working context, device-local saved recall questions, and a release-blocking 5,000-record stress/recovery gate.

## Next memory-quality work

- Richer evidence promotion and rejection workflows.
- Scoped recall evaluation sets.
- Opt-in operating-system background scheduling only after platform lifecycle and consent behavior are defined.
- Permissioned connector actions only after each external data boundary has its own threat model and failure semantics.
- Import adapters for additional plain-text knowledge tools without copying their private data into the repository.

## Later, only after the boundary is clear

- Signed Windows and Linux packages plus an opt-in update channel.
- macOS packaging and notarization.
- Optional database-at-rest encryption with documented recovery tradeoffs.
- Additional embedding adapters with explicit per-provider data-flow disclosures.
- A stable declarative skill registry format and automated permission review.

## Non-goals

- A hosted BRACE account or mandatory cloud sync.
- Silent capture of every conversation or application event.
- Storing credentials, raw chain-of-thought, or private data in the public repository.
- Arbitrary JavaScript or shell execution from skill manifests.
- Claiming semantic retrieval when no compatible real vectors exist.
