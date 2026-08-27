# Troubleshooting

Do not attach a real database, export, backup, project file, or log containing private paths to a public issue.

## The desktop opens with an empty database

That is the intended first run. Choose **Import a project** or **Explore synthetic demo**. BRACE never silently imports an old prototype snapshot.

If content was expected after an upgrade, open **Settings** and inspect the database location. Confirm the old process and new process use the same `BRACE_DATA_DIR` or `BRACE_DATABASE_PATH` override.

## A project folder is rejected

BRACE refuses:

- a filesystem root;
- the current user's home directory;
- a missing path;
- a non-directory path.

Choose a specific repository or notes folder. This limit protects against accidentally indexing an entire machine.

## A file was not indexed

Check whether it is:

- a symlink;
- binary;
- larger than 2 MB by default;
- outside the selected project root;
- in `.git`, `node_modules`, `dist`, `build`, `out`, a cache, virtual environment, IDE metadata, or another ignored directory;
- named like an environment, credential, secret, token, private key, database, or log file;
- missing from the text extension allowlist in `core/project-indexer.js`.

Reindex after correcting the source. The project event summarizes changed, unchanged, removed, skipped-binary, embedded, and truncated counts.

## Recall returns lexical mode

Lexical mode is fully functional and is the default. Semantic or hybrid mode requires:

1. An enabled embedding configuration.
2. A reachable provider.
3. A real query vector.
4. Stored vectors using the same model and dimensions.

For desktop Ollama, confirm the endpoint is loopback, the model exists, and the project was reindexed after enabling it.

## Ollama connection fails

Check:

```bash
curl http://127.0.0.1:11434/api/tags
```

BRACE intentionally rejects a non-loopback HTTP endpoint. Use loopback for local Ollama. Advanced remote adapters require HTTPS and an API key.

Provider errors are bounded but may include a short provider response. Do not publish them if the provider included sensitive data.

## MCP client cannot connect

- Copy the installed executable path from **Connections**.
- Keep the entire generated platform-specific argument and environment block unchanged.
- Restart the client after editing configuration.
- Run `brace_status` first.
- Confirm desktop and client use the same operating-system user and data override.
- Check stderr for `BRACE MCP server is listening on stdio.`

Do not run the packaged executable through `npm`. Source checkouts can use `npm run mcp`; installed builds should use the exact configuration shown in **Connections**.

## MCP can read but cannot write

That is the default. Add `BRACE_MCP_WRITE=1` to that client's BRACE server environment and restart it.

Forgetting additionally requires `BRACE_MCP_DESTRUCTIVE=1`. Both flags must be present.

## A skill will not install

Confirm:

- the selected file is named `brace-skill.json`;
- `schemaVersion` is `1`;
- name and action IDs use lowercase letters, numbers, and hyphens;
- version is semantic;
- a license or private status is declared;
- every operation is supported;
- every operation's permission is requested;
- the approved permission dialog includes every requested permission.

## A skill changed on disk

BRACE stops execution when its manifest checksum differs from the installed record. Review the change, then reinstall and reapprove the permissions. Do not work around the integrity check.

## Windows shows an unknown publisher

0.4.0 is not code-signed. Download only from the repository release, compare the file against `SHA256SUMS.txt`, and proceed only if they match. Native signing is on the roadmap.

## AppImage does not start

Make it executable:

```bash
chmod +x BRACE-0.4.0.AppImage
./BRACE-0.4.0.AppImage
```

Some distributions need FUSE 2 compatibility. AppImage supports an extraction fallback:

```bash
./BRACE-0.4.0.AppImage --appimage-extract
./squashfs-root/AppRun
```

## The browser preview cannot persist changes

The ordinary browser build is a clearly labelled synthetic preview. Persistent operations require Electron's preload bridge. Run `npm run electron:dev` rather than `npm run dev` when testing storage.

## Where logs live

BRACE uses `electron-log` under the operating system's application log directory. Logs can contain timing, errors, and paths. Review and redact them before sharing.

## Recover from a bad database migration

BRACE rejects schemas newer than the running application. Do not edit `user_version` manually.

1. Stop every BRACE desktop and MCP process.
2. Copy the database and its WAL/SHM companions to encrypted recovery storage.
3. Restore a known-good SQLite backup to a new specific data directory.
4. Launch with `BRACE_DATA_DIR` pointing to the restored directory.
5. Report a reproducible synthetic case privately if corruption or data loss occurred.
