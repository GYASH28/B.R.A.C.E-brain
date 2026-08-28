# Dependency and license review

The 0.5.0 lockfile is the authoritative dependency inventory. `npm ci` verifies its integrity and `npm audit --audit-level=high` blocks known high or critical advisories in CI and release jobs.

Run:

```bash
npm run license:audit
npm audit --audit-level=high
npm sbom --sbom-format cyclonedx > brace-0.5.0.cdx.json
```

The license audit reads the installed lock metadata, reports every declared license expression, and fails on any expression outside the reviewed allowlist. The current set is permissive or notice-based, with two relevant qualifications:

- `axe-core` and build tooling may use MPL-2.0; they are development-only and are not shipped as BRACE application code.
- Sharp's prebuilt libvips packages declare LGPL-3.0-or-later (the Windows package metadata expresses this as `Apache-2.0 AND LGPL-3.0-or-later`). They are dynamically loaded during brand/static asset generation and are not included in the Electron application payload.

The release workflow publishes a CycloneDX SBOM beside the installers. `THIRD_PARTY_NOTICES.md` covers direct bundled dependencies; transitive package metadata and integrity hashes remain available in `package-lock.json`.
