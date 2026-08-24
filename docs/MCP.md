# MCP connection guide

BRACE exposes the same local memory database to compatible AI clients through Model Context Protocol stdio. It uses the official TypeScript SDK v2, structured tool results, output schemas, annotations, and protocol support current to the 2026-07-28 revision.

Primary implementation references:

- [MCP TypeScript SDK stdio server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/stdio.md)
- [MCP TypeScript SDK server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)
- [MCP protocol 2026-07-28 migration notes](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/support-2026-07-28.md)

## Packaged desktop configuration

Open **Connections** in BRACE and copy the generated configuration. It uses the installed executable itself. On Linux, the generated block is:

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
| `brace_get_memory` | Read one memory with its evidence |
| `brace_list_timeline` | Read real project, memory, decision, evidence, and skill events |
| `brace_get_graph` | Read project, source, memory, decision, entity nodes and typed edges |
| `brace_list_projects` | List project identity without absolute roots |
| `brace_list_skills` | Inspect declarative skills, status, and approved permissions |
| `brace_status` | Read schema, content counts, semantic mode, and permission mode |

The server also exposes the `brace://status` JSON resource.

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

- `brace_remember`
- `brace_record_decision`
- `brace_run_skill`

Inputs are schema-validated and size-bounded. Exact duplicate memory is idempotently reused; near duplicates are review signals.

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

## Threat model

- The client launching BRACE can read any result returned to it.
- Environment variables are the authorization boundary for mutation, not user authentication.
- MCP has no TCP listener and no cross-user access mechanism.
- A model provider used by the client may receive BRACE results according to that client's own data flow.
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
