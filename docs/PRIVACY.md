# Privacy model

BRACE is local-first, not magically private. This document states what crosses each boundary and what the user must still protect.

## Default behavior

With embeddings disabled, no AI workspace turn sent, and no MCP client connected:

- No BRACE account is created.
- No telemetry is sent.
- No project folder is scanned until the user chooses it.
- No BRACE network listener runs.
- Memory and indexes remain in the local SQLite database.
- Imported originals remain outside BRACE and unchanged.

## Data inventory

BRACE may store:

- selected project roots, locally, so a project can be reindexed;
- source-relative paths, hashes, headings, and text chunks;
- durable memories, summaries, source excerpts, tags, confidence, and importance;
- explicit decisions, rationale, alternatives, and statuses;
- evidence and timeline events;
- extracted tags and wiki-link topics plus relationships;
- skill manifests, approved permissions, status, checksums, and install paths;
- embedding configuration and optional vectors;
- local AI Workspace conversation history, including the user's prompt, the provider response, and counts describing the context used.

The database is private user data even when project provenance uses path-free URIs.

## Project indexing boundaries

The project indexer ignores or excludes:

- paths matched by the project's `.braceignore`;
- `.env` variants;
- filenames beginning with credential, secret, or token patterns;
- private key filename patterns and `.key`, `.pem`, `.p12`, and `.pfx` files;
- SQLite, database, and log files;
- version-control metadata;
- dependencies, virtual environments, caches, build output, and coverage output;
- symlinks and their targets;
- non-allowlisted extensions, binary files, and oversized text files.

For allowlisted ordinary text files, BRACE also performs best-effort recognition and redaction of common secret-like patterns before indexed content is persisted. Import/reindex completion reports when redaction, binary skipping, unreadable items, or scan truncation occurred.

These controls are defense in depth, not a data-classification guarantee. A credential or private value that does not match a recognized pattern can still be indexed. Use `.braceignore`, select a focused folder, and review sensitive repositories before import. BRACE never edits the original project files when redacting or indexing them.

## Stable provenance without public machine paths

Indexed sources receive URIs such as:

```text
brace-project://<project-id>/docs/architecture.md
```

The public MCP project list, portable export, and source results can use project identity and relative provenance without exposing the absolute project root.

The local database still keeps the root because reindexing requires it. The desktop can reveal local paths to the user. Do not share a screenshot or log that shows them.

## Ask BRACE and external AI providers

Previewing context is a local BRACE operation. Before a supported AI Workspace turn can be sent, BRACE prepares a short-lived context capsule for the exact selected client and exact prompt. The UI shows the durable-memory and indexed-source excerpts in that capsule before send is enabled.

If the user confirms the send:

- the selected prompt and the exact previewed context are passed to the selected Codex CLI or Claude Code client;
- that client and its configured model provider are part of the external data boundary;
- common secret-like patterns in the prompt are best-effort redacted before the provider-bound prompt is constructed;
- the same capsule that was previewed is consumed once rather than running a second context search at send time;
- changing the prompt or selected client requires a new preview;
- the provider response and local prompt history are stored in BRACE's local AI Workspace history;
- AI Workspace history is not automatically promoted into durable memory.

A preview does not make an external provider private. Before sending, review the visible context and understand the privacy terms of the model provider configured by the selected client. Best-effort redaction cannot guarantee detection of every secret or sensitive fact.

## Embeddings

The desktop exposes Ollama over HTTP loopback only. Text sent to `127.0.0.1`, `localhost`, or `::1` stays on the machine unless the local Ollama installation is separately configured to proxy it.

The advanced OpenAI-compatible adapter accepts:

- HTTP only for loopback hosts.
- HTTPS for non-loopback hosts.
- An API key for a non-loopback endpoint.

Validated embedding requests do not follow provider redirects, and provider responses are size-bounded before parsing. Using a remote provider still sends the indexed chunks or queries being embedded to that provider. HTTPS protects transport, not provider-side privacy. Review that provider's policies and never assume “compatible” means local.

## MCP clients

MCP uses stdio and has no network listener, but the launching client can read the tool results it requests. Treat the client process and its configured model provider as part of the data boundary.

Start with read-only tools. Write mode allows the client to create durable memory and decisions. Destructive mode allows forgetting. Environment flags are process-local so each client can receive a different capability set.

## Skills

BRACE Skills can only call the built-in operations covered by their installed permission set. A skill cannot open a socket, run a command, import code, or read an arbitrary file through the runtime.

Read permission descriptions before approving installation. A checksum mismatch blocks execution, but it does not prove the manifest's requested workflow is sensible.

## Backups, restore, and exports

- **SQLite backup** is a complete recovery copy and can include local roots, memory content, source-derived chunks, settings, AI Workspace history, and installed skill metadata.
- **Restore staging** verifies and copies the selected candidate before it can replace the live database; the live database is displaced only through the pending-restore startup flow rather than being overwritten during selection.
- **Portable JSON export** omits machine-specific project roots and vectors but includes memory, evidence, decisions, relationships, and other user-authored content.
- **Support bundles** are intended for diagnostics and must remain privacy-safe; review any bundle before sharing it externally.

Backups and exports are sensitive. Store them on encrypted media, exclude them from synchronization you do not trust, and never commit them.

## Forgetting and deletion

Forgetting one memory removes content, evidence, and vectors while preserving a non-sensitive tombstone. It does not edit the imported file that may have supported that memory.

Delete-all clears BRACE-owned tables but leaves imported project originals untouched. Existing external backups and exports are independent copies and must be removed separately.

SQLite, filesystems, and storage media can retain recoverable blocks after logical deletion. BRACE 0.7.0 does not claim forensic erasure.

## Encryption

BRACE 0.7.0 does not encrypt `brace.sqlite3` at the application layer. Use operating-system full-disk encryption, a strong login, automatic screen locking, and encrypted backup storage.

## Public repository policy

The repository must contain only synthetic examples and captures. Its privacy test rejects known private seed names, machine path patterns, database files, and common secret tokens. Contributors must still review changes manually because no scanner can prove that prose is non-personal.

## Incident response

If private data is accidentally committed:

1. Stop sharing the affected ref or artifact.
2. Rotate any exposed credential immediately.
3. Remove the data from current Git history and release artifacts.
4. Treat public Git objects and caches as permanently exposed.
5. Report the event through the repository's private security process.
