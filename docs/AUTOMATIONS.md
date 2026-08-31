# BRACE Automations

BRACE Automations turn local memory events and schedules into small, inspectable workflows. They run inside the desktop process, use the same SQLite database as the rest of BRACE, and do not require a hosted automation account.

## Build a recipe

Open **Automations**, choose a template or **Create automation**, and define three parts:

1. **Trigger** — manual, interval, local daily schedule, memory created, decision recorded, project indexed, or explicit session handoff.
2. **Conditions** — optional AND/OR checks over a bounded set of event fields.
3. **Actions** — create a memory or decision, search memory, inspect memory quality, create a timeline digest, reindex one project, or run an installed declarative BRACE Skill.

New recipes start paused. Review the permission envelope, run a preview, inspect its trace, and then enable it when the rendered actions are correct.

## Safety model

The engine intentionally has no arbitrary JavaScript, shell commands, network requests, deletion, export, backup, or connector-configuration actions. Recipes are bounded to 12 conditions and 8 actions. Interval schedules cannot run more often than every five minutes.

Template values use simple placeholders such as `{{trigger.title}}`. They only read own properties from the event payload; prototype keys are rejected and no expression is evaluated. Secret-like values are redacted before payloads, inputs, outputs, or errors become durable run data.

Permissions are derived from actions rather than authored by the recipe. The builder shows them before save:

| Permission | Meaning |
| --- | --- |
| `memory:read` | Search or inspect durable memory |
| `source:read` | Search indexed source chunks |
| `memory:write` | Create an explicit memory or digest |
| `decision:write` | Create a decision record |
| `timeline:read` | Read recent local events for a digest |
| `project:read` / `source:write` | Reindex one selected project |
| `skill:run` | Run an installed, integrity-checked BRACE Skill |

## Scheduling and delivery

Schedules use the computer's local timezone and run only while the BRACE desktop app is open. BRACE checks for due recipes every 30 seconds. It advances a schedule from the completed run time, so reopening the app does not produce an unbounded catch-up loop.

The global pause control stops scheduled and event-driven runs. Manual previews remain available. Event automations cannot recursively dispatch more automation events from their own actions.

## Traces, retries, and history

Every attempt records an immutable recipe snapshot, redacted trigger payload, condition result, step inputs and outputs, duration, and terminal status: `preview`, `success`, `skipped`, or `failed`. Editing a recipe does not rewrite old history.

Failed and completed runs can be retried from their original snapshot. Use **Preview retry** to render the same attempt without mutation, or **Retry now** to execute it. Deleting a recipe removes its active definition but preserves run history with a null definition reference.

## Included templates

- **Daily memory brief** — creates a local summary from the last 24 hours of timeline activity.
- **Weekly memory health check** — reports provenance, confidence, and overlap without changing memory.
- **Decision follow-up** — turns an explicit decision event into a procedure-shaped follow-up memory.
- **Handoff context check** — searches related memory after an explicit AI handoff and records the result in the trace.

## Current limits

- The desktop app must remain open for schedules.
- There are no cloud/webhook triggers or external SaaS actions.
- Daily schedules use local wall-clock time; changing system timezone changes future firing time.
- Run history has no automatic retention limit yet; delete-all removes it with the rest of BRACE data.

These limits are deliberate for the first local runtime. Connector actions and background delivery should only be added with explicit consent, per-connector scopes, rate limits, and recoverable failure handling.
