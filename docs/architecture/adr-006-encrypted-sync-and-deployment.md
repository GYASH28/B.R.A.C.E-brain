# ADR-006: Encrypted company sync, tenancy, and deployment

- Status: Accepted; transport-neutral local replica foundation implemented
- Date: 2026-09-06

## Context

Local SQLite is the authority for personal BRACE data. A company product needs
shared workspaces across devices, offline work, revocation, conflict handling,
regional deployment, and a choice between managed and self-hosted operation.
Adding a generic database sync would blur ownership and expose personal memory.

## Decision

Business sync is optional and workspace-scoped. The desktop client maintains a
local replica for enrolled company workspaces while personal memory remains in
its existing local authority. Only explicit company records and approved source
indexes enter the sync outbox.

Each operation carries organization, workspace, actor, device, logical record,
base revision, operation identifier, timestamp, and encrypted payload. The
server validates authorization and policy before accepting it. Replayed
operation identifiers are idempotent. The append-only operation log supports
audit and recovery; materialized views serve retrieval and graph queries.

Organization and workspace keys are wrapped through a documented key hierarchy.
Transport uses current TLS. Stored content, object attachments, indexes,
backups, and queues are encrypted with tenant-scoped keys. Managed operators may
need limited server-side decryption for authorized retrieval; that boundary must
be stated plainly. End-to-end encrypted modes require a separate design because
server-side search and policy evaluation change materially.

## Conflict and offline behavior

- Independent records merge by operation identifier.
- Scalar metadata uses explicit field revisions; concurrent edits produce a
  conflict record instead of silent last-write-wins loss.
- Rich memory content creates parallel revisions with a compare-and-resolve UI.
- Deletion creates a tombstone with retention metadata and propagates before
  compaction.
- Revocation blocks new reads immediately when online and removes local company
  keys and replicas at the next successful policy refresh.
- Offline access follows the last valid lease and policy. High-risk workspaces
  may forbid offline retention.

## Tenant isolation

Every persistent row, object key, cache entry, queue message, log field, metric,
and search/vector namespace carries a validated tenant boundary. Database row
security or equivalent service-level policy is mandatory. Background workers
receive one tenant and one job capability; they cannot enumerate all tenants.

Managed and self-hosted deployments share protocols, migration formats, and
export semantics. Managed regional placement is an organization policy. A
self-hosted deployment owns its keys and operations but must still pass the same
authorization, migration, recovery, and audit tests.

## Backup, closure, and portability

Backups are encrypted, versioned, and restorable into an isolated validation
environment. Organization export includes data, provenance, memberships,
policies, audit records, and an integrity manifest in a documented format.
Closure first disables new writes, exports if requested, revokes credentials,
deletes active data and replicas, applies legal holds, and later verifies backup
expiry. Personal local databases are outside organization closure.

## Acceptance gates

- Cross-tenant query, cache, queue, vector-index, object-store, and log tests.
- Offline edit, duplicate delivery, reorder, conflict, tombstone, and reconnect tests.
- Key rotation, revoked-device, lost-device, and compromised-worker exercises.
- Backup integrity and full restore drills from supported released schemas.
- Export completeness and verified organization deletion tests.
- Documented managed and self-hosted threat models before public availability.

## Implementation status

Schema v10 implements the local, transport-neutral portion of this decision.
Only an explicitly published shared-memory revision or revocation can enter the
outbox. Every envelope uses AES-256-GCM and authenticates the operation id,
organization, workspace, actor, registered device, record, operation kind,
base/result revision, key id, and creation time. SQLite stores ciphertext and
an opaque key reference, never key material; the caller supplies disposable
32-byte workspace keys through a key-provider boundary.

Inbound delivery re-authorizes the transport identity, validates the exact
remote device and workspace lease, rejects tampering and operation-id
collisions, treats exact redelivery idempotently, records out-of-order updates
as conflicts, automatically applies them when predecessors arrive, and
materializes deletion as a tombstone. Device revocation is checked before even
an idempotent replay. Workspace revocation removes the local key reference and
materialized replica and rejects pending outbox work, while preserving
undecryptable operation evidence for audit/recovery.

This is not a sync service release. TLS transport, server-side policy and row
isolation, remote queues/caches/search/object storage, production keystore and
key wrapping/rotation, attachments, managed/self-hosted control planes,
organization export/closure, and cross-infrastructure qualification remain
required. No renderer or public IPC surface enables this foundation yet.
