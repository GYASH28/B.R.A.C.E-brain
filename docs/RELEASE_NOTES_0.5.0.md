# BRACE 0.5.0 preview

BRACE 0.5.0 unifies the strongest original AI Second Brain experience with the public project's local-first, evidence-backed safety boundary. It is the first release where the desktop, knowledge graph, AI-client connections, session continuity, beginner guide, cinematic launch site, and native installers tell the same product story.

## What is new

- A complete workspace: Command center, Knowledge map, Inbox, AI Workspace, Recall, Memory, Timeline, Projects, Skills, Connections, and Settings.
- Five projections over the same real graph: Rings, Living, Orbit, Flow, and chronological Chronicle.
- Guided read-only or remember setup for Codex CLI, Claude Code, and Antigravity, plus exact manual configuration for any stdio MCP client.
- A `brace_memory_compass` prompt, `brace_session_start`, and permission-gated `brace_session_handoff` for explicit continuity between compatible AI tools.
- An AI Workspace that recalls bounded BRACE context, shows the model-provider boundary before execution, redacts secrets from local history, and never retains an answer automatically.
- A refreshed integrated beginner guide and cinematic launch site using only the synthetic Northstar workspace and the real BRACE mark.

## Connection and retention boundary

**Configured** means the BRACE MCP entry exists in the selected client's configuration. A real AI Workspace turn is the live connection test. BRACE backs up the existing config, verifies its entry after setup, and restores the prior file if setup fails.

Read-only access can recall context and start sessions. Remember access adds non-destructive durable writes and structured handoff. Forgetting is separately gated. Retrieved context may be sent to the provider configured by the selected client; BRACE does not copy provider keys, retain raw transcripts, or store hidden reasoning.

## Downloads

- `BRACE-Setup-0.5.0.exe` — Windows x64 per-user NSIS installer
- `brace-brain_0.5.0_amd64.deb` — Debian and Ubuntu x64 package
- `BRACE-0.5.0.AppImage` — portable Linux x86_64 image
- `SHA256SUMS.txt` — release artifact digests
- `brace-0.5.0.cdx.json` — CycloneDX dependency SBOM

The preview packages are not code-signed. Verify the SHA-256 manifest from the GitHub release before running an installer.

## Verification

- Node 24 quality gate: ESLint, TypeScript, core/privacy/product tests, static Next.js export, and Electron compilation.
- Isolated synthetic desktop E2E with all five graph views, persisted interaction state, AI and connection surfaces, and zero renderer-console errors.
- MCP source and packaged-entry smoke tests, including memory compass, session start, and explicit handoff.
- AppImage and Debian runtime smoke plus package-content, dependency, license, privacy, secret, and home-path audits.
- Native Windows CI builds and smokes the NSIS package; local Wine is not treated as native Windows evidence.
- Website interaction, layout, WCAG 2.2 AA, and Scrollcraft desktop/mobile/reduced-motion verification.

## Honest limitations

- Windows and Linux packages are unsigned and there is no automatic updater.
- macOS packaging is not included.
- Full-text retrieval is built in; semantic and hybrid claims require vectors from a configured real embedding adapter.
- Project import is text-oriented and does not parse PDF, image, audio, or proprietary document formats.
- BRACE does not encrypt its SQLite database at the application layer; use operating-system disk encryption and protect backups.
