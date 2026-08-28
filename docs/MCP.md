# MCP connection guide

BRACE exposes the same local memory database to compatible AI clients through Model Context Protocol stdio. It uses the official TypeScript SDK v2, structured tool results, output schemas, annotations, and protocol support current to the 2026-07-28 revision.

Primary implementation references:

- [MCP TypeScript SDK stdio server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/stdio.md)
- [MCP TypeScript SDK server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)
- [MCP protocol 2026-07-28 migration notes](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/support-2026-07-28.md)

## Packaged desktop configuration

Open **Connections** in BRACE. Codex CLI, Claude Code, and Antigravity have guided setup:

1. Choose **read-only** or **remember** access.
2. Review the client, local command, mutation scope, and model-provider disclosure.
3. Approve one narrowly scoped configuration change.
4. BRACE creates a recoverable backup, uses the client's supported configuration seam, and re-reads the result before displaying **Configured**.
5. Run a turn in **AI Workspace** to verify the live client and provider path.

A configuration entry is not described as a live connection. If setup fails or the expected entry is missing, BRACE restores the previous configuration. Provider credentials remain owned by the client and are never copied into BRACE.

For another stdio-compatible client, copy the generated manual configuration. It uses the installed executable itself. On Linux, the generated block is:

```json
{
  "mcpServers": {
    "brace": {
      "command": "<path-to-BRACE-executable>",
      "args": ["--mcp"]
    }
  }
}
```

The `--mcp` launcher mode starts the bundled stdio server without creating an Electron window.

On Windows, Electron GUI executables do not reliably preserve redirected stdio. BRACE therefore generates a Windows-specific configuration that runs the bundled MCP file through the same executable's Node mode. Keep the generated `args`, `ELECTRON_RUN_AS_NODE`, and `BRACE_MCP_DIRECT` values unchanged. These two variables select the transport entrypoint; they do not enable memory writes.

## Source checkout configuration

```json
{
  "mcpServers": {
    "brace": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "<path-to-B.R.A.C.E-brain>"
    }
  }
}
```

The source server and desktop use the same cross-platform default data root.

## Read-only tools

These tools are always available:

| Tool | Purpose |
| --- | --- |
| `brace_search` | Search durable memories and imported sources, preserving separate provenance |
| `brace_session_start` | Build a bounded task capsule from relevant memory, evidence, and recent events |
| `brace_get_memory` | Read one memory with its evidence |
| `brace_list_timeline` | Read real project, memory, decision, evidence, and skill events |
| `brace_get_graph` | Read project, source, memory, decision, entity nodes and typed edges |
| `brace_list_projects` | List project identity without absolute roots |
| `brace_list_skills` | Inspect declarative skills, status, and approved permissions |
| `brace_status` | Read schema, content counts, semantic mode, and permission mode |

The server also exposes the `brace://status` JSON resource.

It also registers the `brace_memory_compass` prompt. The prompt tells a capable client to start with `brace_session_start`, keep memory separate from evidence, avoid inventing missing context, and prepare an explicit handoff only when retention is enabled.

## Write mode

Add this environment variable only for a trusted client:

```json
{
  "env": {
    "BRACE_MCP_WRITE": "1"
  }
}
```

Write mode adds:

- `brace_session_handoff`
- `brace_remember`
- `brace_record_decision`
- `brace_run_skill`

Inputs are schema-validated and size-bounded. Exact duplicate memory is idempotently reused; near duplicates are review signals.

`brace_session_handoff` stores one structured summary with optional decisions, lessons, open questions, and next actions. It is deliberately not a raw transcript sink and must not contain hidden reasoning or credentials.

## Destructive mode

Forgetting is not included in write mode. It requires both flags:

```json
{
  "env": {
    "BRACE_MCP_WRITE": "1",
    "BRACE_MCP_DESTRUCTIVE": "1"
  }
}
```

This adds `brace_forget_memory`, annotated as destructive. Do not enable it globally when a client only needs recall.

## Data and embedding variables

| Variable | Meaning |
| --- | --- |
| `BRACE_DATA_DIR` | Specific cross-platform BRACE data directory |
| `BRACE_DATABASE_PATH` | Advanced explicit SQLite file override |
| `BRACE_OLLAMA_ENDPOINT` | Loopback Ollama origin; defaults to `http://127.0.0.1:11434` |
| `BRACE_OLLAMA_EMBED_MODEL` | Enables semantic queries with this Ollama model |
| `BRACE_MCP_WRITE` | Adds non-destructive mutation tools when equal to `1` |
| `BRACE_MCP_DESTRUCTIVE` | Adds forgetting only when write is also enabled |

Root data directories and root database paths are rejected.

## Suggested client instruction

```text
Search BRACE before asking me to repeat durable project context. Keep BRACE memories separate from source evidence and cite brace-project URIs when available. Do not write memory unless the conclusion is explicit, durable, and free of credentials or hidden chain-of-thought.
```

## Cross-tool session workflow

1. Call `brace_session_start` with the task topic.
2. Use returned durable memories and source evidence as separate, attributed inputs.
3. Work in Codex CLI, Claude Code, Antigravity, or another MCP client normally.
4. If the connection is read-only, show the user a proposed handoff without writing it.
5. If remember access is enabled, call `brace_session_handoff` only with explicit durable outcomes.
6. In the next client or session, call `brace_session_start` again. The same local database supplies the retained handoff.

This is shared durable memory, not automatic transcript synchronization. BRACE does not retain every chat and does not claim access to a client's hidden reasoning.

## Threat model

- The client launching BRACE can read any result returned to it.
- Environment variables are the authorization boundary for mutation, not user authentication.
- MCP has no TCP listener and no cross-user access mechanism.
- A model provider used by the client may receive BRACE results according to that client's own data flow.
- The embedded AI Workspace invokes the selected installed client in a read-only working directory, but the client's configured model provider can still receive the prompt and selected BRACE context.
- Project list tools omit absolute roots, but returned source content is still private project data.
- Local stdio does not protect against a malicious process already running as the same operating-system user.

## Troubleshooting

If a client cannot connect:

1. Copy the exact executable path from the Connections screen.
2. Keep every generated argument and environment value unchanged; Linux uses `--mcp`, while Windows uses the bundled server path and Node-mode variables.
3. Restart the client after editing its configuration.
4. Check the client's MCP stderr log for a BRACE startup message.
5. Run `brace_status` before testing search.
6. Confirm the desktop and client run as the same operating-system user or use an explicit `BRACE_DATABASE_PATH`.

Do not paste logs containing private paths or query results into a public issue.
