# BRACE business-grade product roadmap

Status date: 2026-09-07  
Product boundary: local-first personal memory plus optional governed company workspaces  
Source plan: `BRACE_CINEMATIC_WEBSITE_AND_BUSINESS_PRODUCTION_MASTER_PROMPT.md`

This document turns the business program into a sequence of independently
shippable product slices. It is deliberately honest about the difference
between a local company preview and a multi-user production service.

## Status language

| Label | Meaning |
| --- | --- |
| **Verified** | Implemented and covered by current automated or inspected evidence. |
| **Candidate** | Implemented in the current worktree, but final integrated qualification is still running. |
| **Foundation** | A useful local seam exists, but it is not the complete business capability. |
| **Planned** | Architecture or product work is defined but not shipped. |
| **External gate** | Completion depends on credentials, infrastructure, or an independent review outside this repository. |

## The product in one sentence

BRACE should give each employee a private, useful second brain and give a
company a permission-safe shared brain, with every answer traceable to evidence
and every agent action inspectable before it changes the outside world.

It must not become employee surveillance. An executive can see company-owned
projects, decisions, risks, owners, approved sources, and workflow outcomes.
They cannot silently browse private memories or arbitrary content on an
employee's computer.

## Simple experience model

All roles use the same underlying knowledge and graph. BRACE changes the lens,
not the truth.

| Person | First screen | Primary questions | Primary actions |
| --- | --- | --- | --- |
| Employee | **My day** | What needs my attention? What context do I need? | Capture, recall, update a task, prepare a handoff, share deliberately. |
| Manager | **Team pulse** | What is blocked, stale, or waiting for a decision? | Review evidence, assign outcomes, approve workflows, resolve missing context. |
| Executive | **Company brief** | What changed? What is at risk? Which decisions need me? | Open a source-backed brief, inspect dependencies, decide, delegate, approve. |
| Administrator | **Control room** | Who can access what? Are connectors and policies healthy? | Manage membership, scopes, connectors, retention, incidents, and audit export. |

Every summary must retain a path back to the source memory, document, event, or
decision that produced it. Metrics describe declared company work; BRACE does
not generate productivity scores from hidden activity.

## Program status

| Phase | Current status | Evidence now | Missing before the phase is complete |
| --- | --- | --- | --- |
| B0 — Preserve and measure | **Verified foundation** | Personal memory, import, retrieval, graph, recovery, diagnostics, MCP, automation, privacy scans, stress harness, and Electron journeys have regression seams. | Keep the integrated release suite green after every business slice; add explicit business workload baselines when shared services exist. |
| B1 — Organization foundation | **Verified local identity foundation** | Local organizations, workspaces, members, roles, lifecycle state, and audit events exist. Schema v9 verifies bounded Ed25519 human assertions against explicitly provisioned HTTPS issuers/audiences, rejects replay, stores no raw token, keeps the current session in main-process memory, and rechecks local expiry and subject status before protected operations. Personal mode remains independent and no issuer is trusted by default. | Complete OIDC/SAML enrollment, administrator trust provisioning and rotation, invitations, groups, SCIM reconciliation, remote sessions, multi-device immediate revocation, recovery/break-glass, and server-enforced authorization. |
| B2 — Permission-aware shared graph and replica | **Verified local foundation** | Schema v8 provides immutable shared publications and authorized search/graph/export/context projections; schema v9 supplies the verified local session boundary. Schema v10 queues only explicit shared revisions/tombstones into AES-256-GCM envelopes with external key references, exact tenant/workspace/device metadata, replay handling, conflict records, ordered reconciliation, leases, and local revocation. Cross-workspace, personal-data, tamper, reorder, and tombstone tests pass. | Production enrollment, remote tenant service/TLS transport, managed and self-hosted deployment, object storage, production keystore integration and rotation, permission-aware semantic retrieval, cross-infrastructure tenant tests, and remote closure drills. |
| B3 — Role workspaces | **Verified local preview** | The local Company area, privacy-scoped Company brief, project attention, Employee/Manager/Executive/Administrator presentation lenses, and four-part Company Operations surface (Project hub, People & teams, Decision room, Governance) pass focused tests. | Production lenses still require verified identity and already-authorized server projections; local lens, role, and subject-binding labels do not grant access. |
| B4 — Connectors and workflows | **Verified local approval foundation** | Local MCP connectors and typed local automations support preview, bounded permissions, retry, cancellation, recovery, and run history. The assignment-first agent control room and advanced workflow canvas are verified over that same engine. Schema v11 adds a service-only, immutable/expiring plan request, human-only decision, one-time consumption, plan-change invalidation, and a per-organization tamper-evident audit chain; it cannot execute an external effect. | Business connector protocol, consent, service enrollment, scoped sync, production secret references, execution-time policy/budget enforcement, cancellation/compensation, remote signed audit checkpoints, and external-write qualification. |
| B5 — Enterprise retrieval | **Foundation** | Explainable local lexical retrieval, optional embeddings, provider context preview, redaction, and evaluation fixtures exist. | Permission-aware hybrid retrieval, company-scale evaluation, leakage/refusal suites, reranking, provider policy, and unsupported-claim enforcement. |
| B6 — Governance and operations | **Foundation** | Local recovery, migration, diagnostics, export controls, audit records, package audits, and release provenance exist. ADR-006 defines encrypted sync and deployment boundaries. | Retention/classification, legal hold semantics, remote backup drills, tenant observability, key rotation, incident operations, regional controls, and a signed update channel. |
| B7 — Production qualification | **Planned / external gate** | Local verification, stress, website, packaging, privacy, dependency, and accessibility harnesses exist. | Multi-tenant security review, authorization fuzzing, failure injection, load/soak, deletion drills, support readiness, Windows signing credentials, and proven signed upgrades. |

## Architecture sequence

The order below is a safety dependency, not merely a development preference.

```text
Personal local authority
        |
        | explicit publish preview
        v
Authorized company record
        |
        +--> permission-filtered search and AI context
        +--> permission-filtered graph and summaries
        +--> connector and automation inputs
        +--> export, audit, retention, and deletion
```

1. **Identity and authorization first.** Define human and service identities,
   session lifecycle, workspace membership, capabilities, policy decisions, and
   immediate revocation.
2. **Publish and scope second.** A private record becomes shared only through an
   explicit, previewed publish operation that creates a new scoped revision.
3. **Shared retrieval third.** Search, graph, AI context, caches, suggestions,
   and exports consume only an already-authorized projection.
4. **Connectors and agents fourth.** External systems and persistent agents use
   separate identities, narrow tool grants, budgets, previews, and approval.
5. **Governance and qualification last.** Retention, deletion, backup, incident
   response, audit integrity, tenant isolation, and signed delivery are proven
   under realistic failure conditions.

The proposed decisions are recorded in:

- `architecture/adr-005-business-scope-and-authorization.md`
- `architecture/adr-006-encrypted-sync-and-deployment.md`
- `architecture/adr-007-connectors-agents-and-audit.md`

## Product workstreams

### 1. Company home and role lenses

One composable shell should expose four focused lenses. Role selection in a
local demo is a presentation preview only; production data must already be
authorized before it reaches the renderer.

**Company brief**

- What changed since the last review.
- Decisions waiting for an owner or approval.
- Blocked or stale projects based on declared project state.
- Source and connector health issues.
- A short cited brief with a visible confidence and freshness boundary.
- Direct navigation from every item to its memory, project, document, person,
  or graph neighborhood.

**Project hub**

- Goal, owner, team, lifecycle state, milestones, dependencies, risks, and next
  review.
- Documents, decisions, meetings, tasks, people, and agent runs in one timeline.
- A graph-focused view that reveals dependency and evidence paths without
  replacing the simpler list view.
- Source coverage and freshness indicators that never pretend to be progress
  estimates.

**People and teams**

- Directory information, role, active company workspaces, declared ownership,
  handoffs, and approvals.
- No private notes, keystrokes, screen capture, emotion inference, or hidden
  individual productivity scores.
- Access explanations: why the viewer can see a record and which policy applies.

**Decision room**

- Decision, status, owner, deadline, alternatives, assumptions, sources,
  affected projects, and required approvers.
- Revision history and a visible difference between evidence, inference, and
  unresolved uncertainty.
- Follow-up tasks or workflows created only after review.

### 2. The Brain as the main company object

The graph remains central, but it must be useful at both 50 and 50,000 visible
records.

- Default to a bounded, meaningful projection, not every node at once.
- Preserve semantic search, scope, source type, owner, date, confidence,
  freshness, and review-status filters.
- Use progressive detail, clustering, incremental layout, Web Worker
  computation, viewport culling, and a list-equivalent accessibility surface.
- A selected node opens a stable inspector with evidence, relationships,
  permissions, freshness, and actions.
- Fullscreen is an application focus mode with reliable `F`, `Escape`, Fit, and
  Reset controls.
- Every graph result is filtered by authorization before layout or caching.

### 3. Digital agent control room

The default interface should feel like assigning work to a capable teammate,
not programming a workflow engine.

| State | What the user sees |
| --- | --- |
| Assigned | Goal, owner, approved inputs, tools, budget, due state, and expected output. |
| Running | Current typed step, elapsed time, cost, source receipts, and safe pause/cancel. |
| Needs approval | Exact target, payload or diff, data leaving BRACE, credentials used, risk, and rollback. |
| Completed | Structured result, evidence, external changes, cost, and a reusable handoff. |
| Failed | Clear cause, completed effects, safe retry point, and recovery choices. |

The n8n-style canvas is an advanced view over the same typed workflow—not a
separate execution format. Plain-language assignments compile into triggers,
conditions, steps, permissions, approvals, and expected outputs. Users can move
between the brief and canvas without losing meaning. Arbitrary executable code
is not stored in a workflow definition.

Initial agent templates should be practical:

- Daily company brief from approved workspaces.
- Meeting follow-through with proposed decisions and tasks.
- Project risk scan based on stale decisions, broken sources, and declared
  blockers.
- Onboarding pack assembled from approved, current sources.
- Leadership brief with citations and mandatory human approval.
- Connector health triage that diagnoses but does not change credentials.

### 4. Company connectors

Connector priority should follow actual customer evidence. The first framework
must support documents, cloud drives, calendars, mail, chat, issue tracking,
source control, and meeting systems without special-casing security rules.

Every connection declares:

- owner, organization, workspace, resource allowlist, and requested scopes;
- exactly what it reads, writes, stores, and sends;
- credential reference, expiry, health, last sync, and revocation state;
- incremental cursor, webhook or polling mode, idempotency, throttling, retry,
  deletion behavior, and source provenance;
- whether an operation is read-only or requires approval.

Imported sources remain canonical and unmodified. A partial connector failure
must not corrupt unrelated memories or advance a sync cursor past missing data.

### 5. Permission-aware AI

The AI layer is a consumer of authorization, not a bypass around it.

- Filter before lexical search, vector search, reranking, caching, summarizing,
  suggestion generation, and provider context construction.
- Show the exact context and redactions before sensitive provider calls.
- Label lexical-only retrieval accurately when no embedding adapter produced
  vectors.
- Cite supporting sources and warn when a requested conclusion is unsupported.
- Route models by organization policy, data class, cost, latency, and task—not
  by opaque model preference.
- Require human review for external actions and high-impact outputs.

### 6. Administration and governance

The administrator surface should answer six questions without exposing private
content:

1. Who can access this workspace?
2. Which sources and providers handle its data?
3. Which agents can act, with what tools and budgets?
4. What changed, who approved it, and did it succeed?
5. How is data retained, exported, restored, and deleted?
6. Is the deployment, connector, backup, or policy unhealthy right now?

Required controls include groups, role capabilities, connection scope,
classification, retention, external sharing, approval policy, audit export,
device/session revocation, recovery, and incident diagnostics. Compliance
language remains descriptive until independent evidence supports a formal
claim.

## Concrete delivery slices

Each slice ends with a runnable application, migration/recovery coverage, and
an explicit rollback path.

### Slice 1 — Local company cockpit

- Complete Company brief, project attention, and role-lens navigation.
- Preserve the private/team/organization wording on every relevant record.
- Link every brief item into Memory, Projects, Documents, or Brain.
- Add keyboard, reduced-motion, responsive, and synthetic Electron journeys.
- Ship only as a local preview; do not imply remote access or live employee data.

### Slice 2 — Authorization kernel

- Introduce subjects, capabilities, policies, protected resources, and decision
  explanations as a service boundary.
- Require authorization in repository, IPC, MCP, graph, retrieval, export, and
  automation seams.
- Add denial-by-default, cross-workspace, cross-organization, role-change, and
  immediate-revocation tests.
- Keep Personal usable without enrollment.

### Slice 3 — Explicit publishing and shared projections

- Add share/publish preview, scoped revisions, lineage, revocation, and audit.
- Create permission-aware graph and search projections.
- Prevent private content from entering shared caches, analytics, summaries,
  logs, exports, or provider context.
- Test duplicate, stale, revoked, deleted, and conflicted records.

### Slice 4 — Company sync service

- Build the operation log, materialized projections, encrypted object path,
  offline leases, tombstones, and conflict records described in ADR-006.
- Support isolated managed and self-hosted qualification profiles.
- Prove tenant boundaries in data, cache, queue, search/vector, object storage,
  logs, and background jobs.
- Run key rotation, lost-device, backup, restore, export, and closure drills.

**Current evidence:** the schema-v10 desktop core now covers the encrypted
operation log, materialized record pointers, offline lease expiry, idempotent
delivery, out-of-order conflict records and reconciliation, tombstones, device
revocation, and workspace replica/key-reference removal. It deliberately has
no network transport, server policy engine, remote object path, or production
keystore, so this slice remains incomplete.

### Slice 5 — Connector platform

- Implement the versioned connector contract and opaque credential references.
- Add one read-only document source first, then one event source, before any
  external write connector.
- Surface consent, resource scope, data flow, health, and revocation.
- Test pagination, webhook replay, cursor recovery, throttling, partial outage,
  credential rotation, and deletion.

### Slice 6 — Agent control room and approval service

- The simple state-based control room and advanced canvas are already present
  over typed local automations.
- Schema v11 now provides the local immutable-plan, human-decision, one-time
  approval binding and tamper-evident audit-chain core; no external execution is
  enabled.
- Next, promote qualifying typed automations into formally enrolled service-agent
  definitions with durable tool allowlists, context boundaries, concurrency, and
  enforced budgets.
- Add connector consent, idempotency, cancellation, compensation, signed remote
  audit checkpoints, and complete outage/revocation qualification before enabling
  any external write.

### Slice 7 — Enterprise retrieval and evaluation

- Add permission-aware hybrid retrieval and policy-based provider routing.
- Measure relevance, citation support, leakage, refusal, freshness, and latency
  on synthetic company fixtures.
- Add regression gates for unsupported claims and access-boundary changes.
- Keep provider context preview and data-flow explanations visible.

### Slice 8 — Operations and release qualification

- Finish classification, retention, deletion, observability, incident response,
  load/soak, failure injection, migration, and disaster-recovery drills.
- Run independent application and multi-tenant security reviews.
- Sign, timestamp, verify, update, roll back, and stage a real release artifact.
- Publish known limitations and support/escalation procedures.

## Verification matrix

| Boundary | Minimum proof |
| --- | --- |
| Privacy | A private record is absent from shared storage, graph, search, AI context, caches, exports, analytics, diagnostics, logs, and agent input. |
| Authorization | Cross-organization and cross-workspace denial, fuzzed resource identifiers, role changes, and immediate revocation. |
| Graph | Large-corpus projection and interaction budgets, stable fullscreen, keyboard traversal, equivalent list view, and permission-safe neighbor expansion. |
| Retrieval | Relevance, citation correctness, no-vector labeling, redaction, unsupported-claim warnings, and access leakage tests. |
| Connectors | Scope, cursor, replay, retry, throttling, outage, revocation, rotation, partial sync, and deletion behavior. |
| Agents | Preview, approval binding, policy denial, budgets, concurrency, idempotency, retry, cancel, compensation, and full effect trace. |
| Recovery | Supported-schema migration, failed-migration recovery, backup integrity, isolated restore, offline conflict, tombstone, and organization closure. |
| Desktop security | Runtime IPC validation, exact-origin checks, context isolation, sandbox, navigation blocking, restrictive CSP, and hostile renderer tests. |
| Accessibility | Keyboard and screen-reader-equivalent paths for every role-critical action, reduced motion, focus visibility, zoom, contrast, and responsive reflow. |
| Release | Privacy/secret/home-path/database scans, dependency and license gates, reproducible provenance, signed artifacts, update/rollback, and support readiness. |

## Release checkpoints

### Local business preview

May be claimed only when the integrated local suite passes and the UI states
plainly that organization data is local demo data. This checkpoint can include
Company brief, role previews, local workspaces, typed automations, and audit
history. It cannot claim live company collaboration, SSO, remote employee
access, or multi-tenant isolation.

### Private company pilot

Requires the authorization kernel, explicit publishing, encrypted company
sync, one qualified read-only connector, audited service identities, backup and
deletion drills, and pilot-specific operational ownership. External writes stay
disabled unless the approval service has passed its gates.

### Business release

Requires all applicable B0–B7 evidence, independent security and privacy
reviews, load and failure tests, signed delivery, verified upgrades and
rollback, incident operations, data portability, deletion proof, current
documentation, and support readiness.

## Current truthful claim

BRACE is a **business-grade local preview**, not yet a networked
enterprise service. The current work proves the personal/local core, scalable
graph, organization-shaped local data, source-backed company brief, typed local
automation with an assignment-first agent control room, recovery, release
tooling, verified local identity sessions, explicit shared publications, an
encrypted transport-neutral replica log, and a local immutable-plan approval/
audit foundation. Identity federation, an operational
remote sync service, server-enforced permissions, production company
connectors, external-action agents, multi-tenant infrastructure isolation, and
signed Windows delivery remain explicit future gates.
