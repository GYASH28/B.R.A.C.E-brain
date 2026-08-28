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

## Next memory-quality work

- Richer evidence promotion and rejection workflows.
- Saved recall filters and scoped evaluation sets.
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
