# Security policy

## Supported versions

BRACE is in preview. Security fixes are applied to the latest tagged release and the `main` branch.

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
| Older prototypes | No |

## Report a vulnerability

Use GitHub's **Report a vulnerability** private security advisory flow for this repository. If that interface is unavailable, open a minimal issue asking the maintainer for a private contact channel without disclosing exploit details.

Include:

- A concise description and affected version.
- Reproduction steps using synthetic data.
- Security impact and the boundary crossed.
- Suggested mitigation, if known.

Do not include a real `brace.sqlite3`, SQLite journal, export, backup, imported project file, credential, machine-specific path, or private screenshot.

## Security model

- The desktop has no BRACE cloud account or inbound network service.
- Electron renderer code is sandboxed and isolated behind a narrow IPC allowlist.
- MCP uses local stdio. The client process launching it is part of the trust boundary.
- MCP is read-only unless `BRACE_MCP_WRITE=1`; destructive forgetting additionally requires `BRACE_MCP_DESTRUCTIVE=1`.
- Project indexing uses a format allowlist, blocks credential-like and generated paths, enforces size limits, and does not traverse symlinks.
- SQLite queries are parameterized. Public project metadata and exports omit absolute project roots.
- HTTP embedding endpoints are accepted only on loopback. Non-loopback endpoints require HTTPS.
- BRACE Skills are declarative, permission-scoped, installed disabled, and integrity-checked. They cannot execute arbitrary shell or JavaScript.

## Important limitations

- The database is not application-level encrypted. Use operating-system full-disk encryption and lock the user session.
- A process running as the same operating-system user can potentially read the database file.
- A trusted MCP client with write flags can change memory. A client with both write and destructive flags can forget memory.
- HTTPS protects transport to a remote embedding provider but does not make that provider local or private.
- Preview packages are not code-signed.

See [docs/PRIVACY.md](docs/PRIVACY.md) for the complete data-flow disclosure.
