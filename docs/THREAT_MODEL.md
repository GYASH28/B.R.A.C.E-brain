# Threat model

## Protected assets

- Memory content, evidence, imported source chunks, selected project paths, backups, provider credentials, and client configuration.
- Database integrity and lifecycle state.
- The authority to write, forget, import, restore, configure a connector, or send context to an AI provider.

## Trust boundaries

- The Electron main process, preload bundle, local core, and explicitly launched stdio MCP client are trusted according to their granted mode.
- Renderer content is untrusted even when it ships with BRACE.
- Imported files are untrusted input and remain canonical outside BRACE.
- AI providers and CLI clients are external processors. Context crosses that boundary only after a visible preview and confirmation.
- Skills and automations are data, not executable code.

## Principal controls

- Sandbox, context isolation, no Node integration, restrictive navigation/CSP, permission denial, sender validation, and runtime IPC schemas.
- No shell, `eval`, or dynamic skill import; declarative allowlisted actions only.
- Read-only MCP by default, with separate write and destructive gates.
- Root containment, symlink skipping, file/size/count caps, `.braceignore`, and best-effort secret redaction.
- Loopback-only Ollama, HTTPS-or-loopback advanced endpoints, redirect rejection, and byte/time/vector validation.
- WAL, foreign keys, staged source replacement, pre-migration backups, integrity-checked restore, and content-erasing forget.
- Privacy, secret, dependency, and package scanning before release.

## Accepted preview risks

Unsigned Windows artifacts can be replaced outside the GitHub trust path; users must verify checksums. SQLite is not application-encrypted and relies on operating-system/full-disk protections. Best-effort secret detection cannot prove an imported corpus is credential-free. A client granted MCP write authority can add durable data; destructive memory still requires a separate process flag.
