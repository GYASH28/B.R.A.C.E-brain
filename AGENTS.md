# BRACE contributor guidance

## Product boundary

BRACE is a local-first personal AI memory layer. Application source belongs in
this repository; real user memories, imported files, indexes, databases,
credentials, logs, screenshots, and machine-specific configuration do not.

## Privacy and data safety

- Use only the synthetic workspace under `examples/demo-workspace` in tests,
  screenshots, documentation, and the website.
- Store runtime state under the operating system application-data directory or
  an explicitly selected user directory, never under the installed app.
- Never commit generated indexes, SQLite databases, backups, diagnostics,
  absolute home-directory paths, `.env` files, or provider credentials.
- Treat imported projects and memories as user data. Tests that mutate data must
  operate inside an isolated temporary directory.
- Preserve user files. Imports index sources; they do not rewrite them. Restore
  and deletion flows require previews and narrowly scoped targets.

## Engineering workflow

- Node.js 24 or newer is the supported development runtime.
- Read the nearest package scripts before inventing commands.
- Add behavior through tested public seams. Keep Electron IPC explicit and
  validate renderer input in the main process.
- Electron must keep `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, navigation blocking, and a restrictive CSP.
- Run focused tests after each slice, then `npm run verify` before release.
- Do not claim semantic retrieval unless an embedding adapter produced vectors;
  lexical-only results must be labeled accurately.

## Public-release gate

Before committing or publishing, run the privacy and secret scanners. A match
for personal data, a home-directory path, a credential, or a generated runtime
database blocks release until reviewed and removed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
