# ADR-007: Company connectors, digital agents, approvals, and audit

- Status: Partially accepted — local approval and audit foundation
- Date: 2026-09-06

## Context

The local BRACE automation engine supports typed actions, previews, bounded
permissions, retries, and run history. A business version may connect company
documents, calendars, mail, chat, issue trackers, source control, and meeting
systems, and may assign work to persistent digital agents. Those capabilities
introduce credentials, external writes, background execution, and delegated
authority beyond the accepted local automation boundary.

## Decision

A connector is a versioned adapter with declared read, write, store, and send
behavior. Credentials live in a platform or service secret store and are
referenced by opaque identifiers. Each connection has an owner, organization,
workspace scopes, resource allowlist, permissions, health, last synchronization,
expiry, and revocation state. Imports index canonical sources and never rewrite
them.

A digital agent is a service identity plus a bounded workflow definition. It has
a goal, owner, organization, workspaces, approved tools, model policy, context
policy, monetary and runtime budgets, schedule, concurrency limit, and approval
rules. A CEO or manager can assign work in plain language, but BRACE compiles it
to inspectable typed steps before execution.

The primary interface is one simple agent control room:

- **Assigned** shows owner, goal, input boundary, and due state.
- **Running** shows the current typed step, elapsed time, budget, and live trace.
- **Needs approval** shows the exact external effect and affected records.
- **Completed** shows structured output, source receipts, changes, and cost.
- **Failed** shows a safe error, retry point, and whether anything changed.

A visual workflow canvas is an optional editing view over the same typed
definition. The plain-language brief and canvas remain round-trippable; neither
stores arbitrary executable code.

## Approval and execution

Read-only actions may run within policy. External messages, file writes,
permission changes, purchases, destructive operations, sensitive exports, and
policy-defined high-impact actions require an approval record. The preview shows
the exact target, payload or diff, data leaving BRACE, credentials used, rollback
availability, and expiration time.

Execution uses idempotency keys, bounded retry, cancellation, deadlines, and
compensating actions where possible. Approval applies to one immutable plan; any
material plan change invalidates it. Agents cannot approve their own work or
expand connector scope.

## Audit integrity

Identity, membership, policy, sharing, connector, agent, approval, export,
deletion, recovery, and privileged operations produce append-only events. Each
event includes tenant, workspace, actor, service identity, action, resource,
outcome, policy decision, request correlation, previous-event digest, and time.
Sensitive content is referenced, minimized, or redacted rather than copied into
logs. Periodic signed checkpoints make later modification detectable.

## Acceptance gates

- Credential rotation, scope reduction, throttling, outage, webhook replay, and
  partial-sync tests.
- Preview/approval binding, policy denial, idempotency, retry, cancellation, and
  compensation tests.
- Agent budget, concurrency, tool allowlist, context boundary, and revocation tests.
- Audit-chain verification, redaction, export, retention, and tamper tests.
- Human review of connector consent and approval UX before external writes ship.

## Current implementation boundary

Schema v11 implements the local, transport-free core of this decision: an
explicitly granted service identity can request one bounded, expiring,
inspectable plan; an active human manager, administrator, or owner can make the
decision; a service cannot decide its own request; a changed plan is
invalidated; and an approved plan can be consumed once by only the requesting
service. `governance_audit_events` forms a per-organization SHA-256 hash chain
over minimized metadata, with verification and tamper tests.

This is deliberately not a connector, background agent, remote audit service,
or external-write capability. No credentials, raw payloads, company data, or
connector invocation are stored by this approval core. Connector consent,
service enrollment, a durable remote audit/checkpoint service, budget
enforcement at execution, cancellation/compensation, and all external effects
remain acceptance gates before they may ship.

An active `audit.read` role can export a selected workspace's minimized local
governance evidence only after BRACE verifies the full organization hash chain
on-device. The report includes event metadata, subject identifiers, plan hashes,
and digest anchors; it excludes private memory/source content, connector
credentials, payload previews, and raw external data. Because a workspace
report intentionally omits events outside that workspace, its header clearly
states that full-chain verification happened locally before export. A portable,
independently verifiable tenant-wide ledger requires server-enforced
organization-level audit permissions and signed checkpoints, neither of which
exists yet.
