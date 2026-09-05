# Recovery and migrations

Before opening a real database with an older schema, BRACE checkpoints WAL, creates a mode-0600 versioned recovery copy, opens it read-only, runs `PRAGMA quick_check`, and only then migrates. The newest five automatic pre-migration backups are retained.

Restore is preview-first:

1. Select a SQLite backup.
2. BRACE opens it read-only, verifies integrity and schema identity, and shows version/count metadata.
3. Confirm restoration.
4. The active database is displaced to a timestamped safety backup.
5. The verified copy is moved atomically into place and BRACE restarts.

If replacement fails after displacement, the active database is put back. BRACE never interprets corruption as permission to wipe data.

Portable JSON export is for interoperability and excludes absolute project roots. SQLite backups are complete and sensitive. Store both with appropriate OS permissions and disk encryption.

Regression coverage lives in `tests/database-recovery.test.js` and the released-schema migration cases in `tests/memory-store.test.js`.
