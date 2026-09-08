# Recovery and migrations

Before opening a real database with an older schema, BRACE checkpoints WAL, creates a mode-0600 versioned recovery copy, opens it read-only, runs `PRAGMA quick_check`, and only then migrates. The newest five automatic pre-migration backups are retained.

Restore is preview-first:

1. Select a SQLite backup.
2. BRACE opens it read-only, verifies integrity and schema identity, and shows version/count metadata, including organization, shared-publication, encrypted sync-operation/replica/conflict, approval-request, and governance-audit counts when present. Governance-audit evidence is exported separately only after the active audit role verifies its local integrity chain.
3. Confirm restoration.
4. The active database is displaced to a timestamped safety backup.
5. The verified copy is moved atomically into place and BRACE restarts.

If replacement fails after displacement, the active database is put back. BRACE never interprets corruption as permission to wipe data.

Portable JSON export is for interoperability and excludes absolute project roots and sync/session internals. SQLite backups are complete and sensitive. Sync payloads in them are encrypted, but personal memory and other local records are not database-encrypted; store backups with appropriate OS permissions and disk encryption. Workspace key material is not stored in SQLite, so a sync replica backup alone cannot replace the external keystore or its recovery process.

Regression coverage lives in `tests/database-recovery.test.js` and the released-schema migration cases in `tests/memory-store.test.js`.
