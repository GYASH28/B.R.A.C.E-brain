# IPC contracts

The renderer is untrusted. It can request named BRACE operations only through the context-isolated preload bridge; it cannot select an arbitrary channel.

```text
sandboxed renderer -> typed preload method -> trusted sender check -> Zod contract -> service -> SQLite/filesystem
```

`electron/ipc-trust.ts` accepts the top-level `brain://app/` renderer in production and the configured exact loopback development origin only in development. Subframes, foreign origins, malformed URLs, and unexpected callers are rejected before payload processing.

`src/shared/ipc/schemas.ts` is the runtime gateway. Schemas bound identifiers, text, arrays, prompts, URLs, automation recipes, clipboard data, filters, and destructive confirmation values. Unknown object fields are rejected where authority could otherwise expand.

The preload API in `electron/preload.ts` exposes product verbs such as `searchBrace`, `startBraceProjectIndex`, and `restoreBraceBackup`. It does not expose raw `ipcRenderer`, a filesystem path reader, a command launcher, or a network client.

Errors crossing the boundary are classified into a safe renderer shape. Technical details are sanitized for token-like values and absolute private paths.

Regression coverage: `tests/ipc-trust.test.js` and `tests/ipc-schemas.test.js`.
