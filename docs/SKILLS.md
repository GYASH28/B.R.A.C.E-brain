# BRACE Skills

BRACE Skills are declarative local workflows stored in a versioned `brace-skill.json`. They are intentionally smaller and less powerful than general code plugins.

## Security properties

- A manifest must declare a license or private-distribution status.
- Its name, semantic version, permissions, action identifiers, and steps are validated.
- Every step maps to a fixed built-in operation and required permission.
- Installation requires approval of the exact requested permission set.
- Third-party skills install disabled unless the caller explicitly chooses otherwise.
- The normalized manifest is copied with user-only file permissions.
- A stored SHA-256 checksum blocks execution after on-disk modification.
- Input values are checked against the action's limited JSON schema.
- Templates can substitute only `{{input.<name>}}` and `{{now}}`.
- There is no arbitrary shell, JavaScript, dynamic import, filesystem, or network operation.

## Permissions

| Permission | Built-in operations |
| --- | --- |
| `memory:read` | `memory.search` |
| `memory:write` | `memory.create` |
| `source:read` | `source.search` |
| `timeline:read` | `timeline.list` |
| `decision:write` | `decision.create` |
| `graph:read` | `graph.read` |

Unknown permissions and operations are rejected.

## Minimal example

```json
{
  "schemaVersion": 1,
  "name": "project-recall",
  "displayName": "Project Recall",
  "version": "1.0.0",
  "description": "Search durable memory and imported sources for one project question.",
  "license": "MIT",
  "permissions": ["memory:read", "source:read"],
  "actions": [
    {
      "id": "recall",
      "label": "Recall project context",
      "description": "Return memory and source evidence separately.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "scope": { "type": "string", "maxLength": 200 },
          "projectId": { "type": "string", "maxLength": 200 },
          "query": { "type": "string", "maxLength": 1000 }
        },
        "required": ["scope", "projectId", "query"],
        "additionalProperties": false
      },
      "steps": [
        {
          "use": "memory.search",
          "with": {
            "scope": "{{input.scope}}",
            "query": "{{input.query}}",
            "limit": 10
          }
        },
        {
          "use": "source.search",
          "with": {
            "projectId": "{{input.projectId}}",
            "query": "{{input.query}}",
            "limit": 10
          }
        }
      ]
    }
  ]
}
```

## Authoring rules

1. Keep one action focused on one explainable outcome.
2. Request only permissions used by declared steps.
3. Set `additionalProperties` to `false` for predictable inputs.
4. Give every string a practical `maxLength`.
5. Keep search results and writes scoped.
6. Never ask users to put credentials into an action input.
7. Use a recognized SPDX license identifier for public skills, or a clear private distribution value.
8. Test failure cases: missing input, unknown input, missing permission, disabled status, and checksum mismatch.

## Installation

Open **Skills**, choose **Install manifest**, select a file named `brace-skill.json`, review the permission dialog, and approve only if the workflow matches the description.

Bundled skills are installed from the synthetic examples on first database creation. User enable/disable choices survive later launches.

## MCP execution

`brace_run_skill` exists only in MCP write mode. The runtime rechecks installed permissions and integrity on every run. Enabling MCP write mode does not automatically enable a disabled skill.

## Distribution policy

This repository includes only the two synthetic example manifests in `examples/skills`. It does not redistribute locally installed Codex skills or other third-party skill packages.
