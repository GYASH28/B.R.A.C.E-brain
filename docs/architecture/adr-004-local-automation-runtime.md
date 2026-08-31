# ADR-004: Local typed automation runtime

- Status: accepted
- Date: 2026-08-29

## Context

BRACE needs repeatable memory maintenance and handoff workflows. A general automation product would introduce arbitrary code, remote delivery, hidden authority, credentials, and unreliable background behavior that conflict with BRACE's local-first memory boundary.

## Decision

BRACE uses a typed, in-process automation engine backed by SQLite.

- Definitions contain one supported trigger, optional bounded conditions, and one to eight supported actions.
- Permissions are derived from action types and shown before enablement.
- New definitions are paused by default.
- Scheduled work runs only while the desktop process is active and uses local time.
- Every attempt persists a redacted trigger payload, immutable definition snapshot, step trace, outcome, timing, and retry relationship.
- Preview executes validation and rendering without mutation.
- Event dispatch is one level deep; automation actions do not recursively emit automation triggers.
- The runtime rejects arbitrary JavaScript, shell, external HTTP, secrets, destructive actions, and prototype-path template access.

The database advances to schema version 4 with `automations` and `automation_runs`. Deleting a definition preserves its historical runs by setting the foreign key to null. Delete-all removes both tables' content.

## Consequences

The engine is explainable, testable, and recoverable. Run history provides evidence for what BRACE changed and why. It can work without an account or network.

Schedules are not an operating-system daemon and do not run while BRACE is closed. External service automations are not available. Adding either later requires a separate threat model, consent UI, credential boundary, delivery guarantees, and platform-specific lifecycle design.

## Rejected alternatives

- **Arbitrary scripts or shell commands:** too much ambient authority and impossible to permission accurately.
- **Hosted workflow execution:** breaks the default local data boundary and requires accounts, credentials, and remote retention.
- **Renderer-owned timers:** unreliable across reloads and violates the Electron trust boundary.
- **Mutable run references only:** editing a recipe would make historical execution impossible to audit.
