# ADR-002: Store durable memory records, not raw transcripts

Status: Accepted

## Context

BRACE must help multiple AI clients share durable context while preserving
privacy, provenance, correction, and deletion. Saving every conversation turn
would create noisy retrieval, unclear consent, and difficult retention.

## Decision

The production memory model stores concise typed records: project facts,
decisions, lessons, warnings, preferences, summaries, hypotheses, and evidence.
Each record has scope, confidence, importance, provenance, lifecycle state,
creation/update timestamps, and optional supersession. Conversations remain a
separate local feature and are not promoted to durable memory automatically.

Consolidation is deterministic first: exact content hashes, normalized-title
matches, source identity, and near-duplicate signals create reviewable merge
suggestions. BRACE never silently merges conflicting durable records. Forgetting
is explicit and auditable; deletion removes content and embeddings while keeping
only a non-sensitive tombstone when the user requests audit continuity.

## Consequences

- Retrieval has a smaller, higher-signal corpus.
- AI clients can cite the evidence behind a memory.
- Users can correct, supersede, export, or forget individual records.
- Automatic extraction is conservative and must display its source and status.
