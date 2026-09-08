# ADR-005: Business scopes, identity, and authorization

- Status: Accepted; local foundation partially implemented
- Date: 2026-09-06

## Context

BRACE currently supports a private local profile plus local organization,
workspace, membership, role, and audit records. A business deployment needs
employees, managers, executives, administrators, guests, and service agents to
share company knowledge without turning a personal device into an unrestricted
employer data source.

Presentation filters are not authorization. Every source, memory, relationship,
search result, summary, suggestion, export, automation input, and model-context
item must be filtered before it crosses a workspace boundary.

## Decision

BRACE keeps three explicit ownership scopes:

1. **Personal** is owned by one person and remains local by default.
2. **Team** is deliberately published to a bounded company workspace.
3. **Organization** is governed company knowledge available according to policy.

Moving a record between scopes is a publish operation. The preview shows the
content, attachments, provenance, destination, recipients, retention policy,
provider exposure, and permissions that will result. The operation creates a
new scoped revision and an audit event; it does not silently relabel the private
record.

The authorization subject is a verified human or service identity. The initial
business roles are owner, administrator, manager, member, guest, auditor, and
service agent. Roles grant bounded capabilities; workspace membership supplies
the resource boundary. Suspension or removal invalidates active sessions and
tokens before the next protected operation.

The local owner may preview role-specific product lenses, but a lens never
grants access. Server and local service layers return an already authorized
projection. Renderer checks exist only for usability and defense in depth.

## Required enforcement points

One authorization decision must cover:

- source ingestion and source chunks;
- memory CRUD and lifecycle state;
- graph nodes, edges, neighbors, clusters, and cached layout summaries;
- lexical and vector retrieval, reranking, suggestions, and AI context;
- exports, backups, diagnostics, and analytics;
- connector reads and writes;
- automation triggers, inputs, actions, approvals, and results;
- audit access and organization administration.

Denial is the default when subject, organization, workspace, action, or policy
is missing. Resource identifiers are never treated as proof of access.

## Identity sequence

Local personal mode continues without an account. A company profile is enrolled
through an invitation or verified administrator flow. Recovery and break-glass
procedures must exist before SSO becomes mandatory. OIDC or SAML establishes
authentication; SCIM manages lifecycle only after immediate deprovisioning and
reconciliation are tested.

Service agents receive separate non-human identities, short-lived credentials,
declared tools, workspace scopes, budgets, and approval policy. They never
inherit the authority of the employee who configured a workflow.

## Rejected alternatives

- Copy every employee file into one executive database. This removes ownership
  boundaries and creates an unacceptable breach and insider-risk surface.
- Enforce roles only in the React application. IPC, MCP, exports, or a future API
  could bypass it.
- Reuse a human session for autonomous agents. Attribution, revocation, and
  least privilege would be impossible to prove.

## Acceptance gates

- Cross-organization and cross-workspace denial tests at every enforcement point.
- Immediate session and token revocation after membership suspension.
- Personal records absent from shared search, graph, summaries, exports, logs,
  analytics, caches, and model context.
- Publish preview and revocation tests with source lineage preserved.
- Authorization fuzzing and an external review before multi-tenant release.

## Implementation status

The pure business authorization kernel in `core/business-authorization.js` is
the reusable foundation for these decisions. Storage schema v7 adds provider-
scoped authorization subjects, organization lifecycle state, nullable subject
bindings, and allowlisted explicit member capabilities. Migration never infers
an identity from a legacy name, email, or role record.

Schema v8 adds explicit preview/commit/revision/revocation storage and bounded
authorized projections for company publications. Schema v9 adds a strict local
identity-session boundary: compact assertions must use an allowlisted Ed25519
key, trusted HTTPS issuer, exact deployment audience, human identity, short
lifetime, and unique assertion/provider-session identifiers. Raw assertions
are never persisted. The active session id is held only in main-process memory,
and every resolution checks current subject status and expiry; sign-out records
revocation. No issuer is trusted by default and no legacy subject or session is
inferred.

The Electron workspace-member mutation is the first enforced vertical seam. It
gets the acting subject only from the trusted service context, resolves current
subject, organization, workspace, and membership facts from SQLite inside the
same write transaction, and invokes `workspace.members.manage` before mutation
or audit. The renderer receives a per-workspace capability hint for affordance
state, but that hint is never authority and the service always re-authorizes.
Without verified company enrollment the operation fails closed and the Company
UI visibly locks role changes.

This remains a local preview, not production authorization. Explicit local
publication and shared-read enforcement now exist, as does local subject/session
revocation. A complete OIDC/SAML identity-provider flow, administrator trust
provisioning and key rotation, SCIM reconciliation, remote session/token
revocation, and encrypted multi-device tenant service do not. Organization and
workspace creation, personal snapshots, remote ingestion, backups, connectors,
automations, audit reads, and MCP must each resolve fresh facts and invoke the
kernel before multi-tenant release.
