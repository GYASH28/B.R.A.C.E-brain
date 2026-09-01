# BRACE 0.6.0 preview

BRACE 0.6.0 makes the local-first second brain substantially easier to understand and use while expanding its long-running automation and memory workflows. The desktop now presents a small set of clear destinations, reveals secondary tools in context, and uses plain language without weakening the evidence, permission, or provider boundaries underneath.

## Highlights

- Eight clear main destinations: **Home**, **Search**, **Capture**, **Ask BRACE**, **Library**, **Projects**, **Automations**, and **AI connections**.
- Contextual **Timeline**, **Map**, and **Review** tabs inside Library, plus **Skills** beside Automation workflows.
- Task-based help for finding, saving, continuing with AI, and connecting an AI client, with a compact six-key shortcut reference.
- Progressive Quick Capture that keeps common memory types visible and tucks project, uncommon type, and tag fields behind **More options**.
- A protected two-step memory-forget flow that states exactly what is removed and confirms that source files remain untouched.
- A clearer light frosted first run with a direct project-folder choice, removable example workspace, and plain-language local privacy promise.
- A typed local automation system with safe templates, schedules and BRACE events, bounded conditions, permission previews, dry runs, immutable traces, retries, and global pause.
- Pinned working context, saved searches, explicit time scopes, memory-to-AI handoff drafts, and a persistent duplicate-review workflow.
- Refreshed synthetic product screenshots and an updated integrated beginner guide matching the final navigation.

## Verification

- 56 unit, integration, migration, privacy, security, MCP, skill, search, graph, and automation tests pass.
- Native synthetic Electron E2E covers onboarding, help routes, command capture, draft recovery, protected forgetting, Search, Library context tabs, review resolution, memory pin/copy/AI handoff, all five graph layouts, Capture, Ask BRACE, Automations, Skills, AI connections, settings persistence, history, and compact navigation with zero renderer console errors.
- A 5,002-memory stress profile passes search latency, churn, WAL concurrency, backup recovery, restart persistence, redaction, memory growth, and SQLite integrity ceilings.
- The launch site and integrated guide pass WCAG 2.2 AA, responsive layout, focus, reduced-motion, film, gallery, download, and interaction gates.
- Linux and Windows native CI build and smoke-test the packages and packaged MCP executable before the prerelease is published.

## Packages

- `BRACE-Setup-0.6.0.exe` — Windows x64 per-user NSIS installer
- `brace-brain_0.6.0_amd64.deb` — Debian and Ubuntu x64 package
- `BRACE-0.6.0.AppImage` — portable Linux x86_64 image
- `SHA256SUMS.txt` — checksums for every attached artifact
- `brace-0.6.0.cdx.json` — CycloneDX dependency SBOM

The packages are not code-signed. Verify the published SHA-256 checksum before installation; Windows SmartScreen may show an unknown-publisher warning.
