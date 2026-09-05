# Current limitations

- BRACE 0.7.0 is a preview. Windows artifacts are not Authenticode-signed and there is no automatic updater.
- The local organization foundation provides workspaces, roles, member records, and audit events on one device. It does not provide cloud collaboration, SSO, SCIM, remote tenant administration, or cryptographic multi-user authorization.
- The SQLite database is not application-encrypted. Use operating-system account protection and full-disk encryption.
- Secret scanning is best-effort and cannot certify imported content safe.
- Local scheduling runs while the desktop application is open. It is not an operating-system background daemon.
- Watch mode depends on operating-system filesystem notifications and may require a manual reindex after missed or unavailable events.
- Semantic and hybrid retrieval require real compatible embedding vectors. Otherwise the product labels results lexical.
- Import supports bounded Markdown, plain text, and BRACE JSON profile data. PDF, DOCX, OCR, audio, image, and browser-history ingestion are not included.
- macOS signed and notarized distribution is not qualified.
