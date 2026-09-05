# Distribution and verification

BRACE 0.7.0 targets 64-bit Linux and Windows.

## Release artifacts

| Platform | Artifact | Packaging |
| --- | --- | --- |
| Linux | `BRACE-0.7.0.AppImage` | Portable AppImage |
| Debian / Ubuntu | `brace-brain_0.7.0_amd64.deb` | Debian package |
| Windows | `BRACE-Setup-0.7.0.exe` | Per-user NSIS installer |

Tagged releases also include `SHA256SUMS.txt`.
They also include a CycloneDX dependency SBOM named `brace-0.7.0.cdx.json`.

## Build locally

Install exact dependencies and run the production build:

```bash
npm ci
npm run electron:dist
```

Electron Builder writes to `dist/installer/`. The build config includes:

- compiled Electron main, memory service, preload, and packaged MCP server;
- the static Next.js application export;
- the synthetic demo workspace and example skill manifests;
- `electron-log` as the only unpackaged runtime dependency.

It excludes source databases, backups, exports, local skills, verification labs, and project folders.

## Verification matrix

Every candidate should pass:

| Gate | Linux | Windows |
| --- | --- | --- |
| `npm ci` and moderate-or-higher dependency audit | Required | Required |
| Dependency/license policy | Required | Required |
| ESLint and TypeScript | Required | Required |
| Core test suite | Required | Required |
| Static Next.js export | Required | Required |
| Electron compile | Required | Required |
| Synthetic desktop E2E | Required under Xvfb | Required natively |
| Executable MCP stdio smoke | Required under Xvfb | Required natively |
| Native package build | AppImage and Debian | NSIS |
| Package content inspection | Required | Required |
| Website accessibility/layout/focus/interaction/performance/visual audit | Required | Covered in Linux job |

The tagged-release workflow runs native jobs and attaches their output to a prerelease. A package built for another platform is not described as runtime-tested until its native job passes.

Dependency audit calls may retry transient registry/service failures, but the severity threshold is not weakened: a real moderate, high, or critical advisory still fails the release gate.

## Linux smoke test

Run a package against disposable XDG directories:

```bash
npm run electron:smoke -- "dist/installer/BRACE-0.7.0.AppImage"
```

The smoke harness starts the application with a unique token, waits for both renderer and shell readiness in the local log, checks that the process exits, and removes the temporary profile.

The full source E2E uses a temporary profile, initializes only the synthetic Northstar demo, exercises task help, command capture, protected forgetting, Search, contextual Library/Timeline/Map/Review navigation, Capture, preview-first Ask BRACE, Automations/Skills, AI connections, Settings, and persistence, captures real product screenshots, and fails on renderer console errors or leaked workspace paths.

## Package inspection

Before release:

1. Extract `app.asar` from each unpacked package.
2. Confirm `dist/electron`, `dist/mcp`, `out`, and synthetic examples exist.
3. Confirm no `*.sqlite*`, `*.db`, backup, export, `.env`, personal seed, local skill tree, or verification lab exists.
4. Confirm every project screenshot uses the synthetic profile.
5. Scan strings for home-directory patterns, known private identifiers, and token formats.
6. Generate hashes only after every package is final.

## Windows installer behavior

The NSIS installer is per-user, does not require elevation, permits choosing an install directory, and creates Start-menu and optional desktop shortcuts.

The 0.7.0 installer is not code-signed. Users should verify its SHA-256 digest and expect Windows SmartScreen to show an unknown-publisher warning.

## Linux behavior

The AppImage is suitable for distributions with the required FUSE compatibility or AppImage extraction fallback. The Debian package registers BRACE in the Office category and installs the `brace` executable.

## Signing and provenance

0.7.0 does not claim code-signing, notarization, or reproducible byte-for-byte builds. Tagged workflow artifacts receive GitHub build-provenance attestations that bind their digests to the repository, commit, and workflow identity. The Windows build consumes a protected Authenticode certificate when maintainers configure one, and the release can enforce a valid signature with `BRACE_REQUIRE_WINDOWS_SIGNATURE=1`. Until that protected infrastructure is provisioned and enforced, releases remain unsigned previews and no automatic updater is enabled. See [RELEASE_TRUST.md](RELEASE_TRUST.md) and [UPDATE_MODEL.md](UPDATE_MODEL.md).

Unsigned packages must remain clearly marked preview/prerelease; passing CI does not make an unsigned executable equivalent to a signed stable distribution.

## Repository protection requirement

Before treating BRACE as stable, protect `main` with a GitHub branch ruleset or branch protection policy that requires the production CI checks before merge, blocks force pushes/deletion, and prevents routine direct pushes. Protect release tags from being moved after publication as well. The code repository cannot enforce these administrator-level settings from inside a workflow.

## Release procedure

1. Update `CHANGELOG.md`, release notes, security/privacy disclosures, and version-specific documentation.
2. Open a release-candidate pull request into protected `main`; do not push the candidate directly to `main`.
3. Require the current Linux and Windows quality jobs, website audit job, dependency/license gate, and security analysis to pass on the final candidate. Resolve review conversations and re-run checks after any code-affecting change.
4. Merge only the exact reviewed and verified candidate commit. Confirm the resulting `main` CI is green.
5. Tag that verified `main` commit (for example `v0.7.0`) and push the immutable release tag.
6. Wait for the native Linux and Windows release jobs to build, verify, and smoke-test their respective packages.
7. Verify `SHA256SUMS.txt`, inspect the CycloneDX SBOM, and confirm each attached artifact matches the expected version and platform.
8. Run the released Windows installer smoke workflow against the published tag to verify checksum, install, launch, MCP entry point, and uninstall behavior.
9. Inspect the GitHub release page and keep the release marked prerelease while packages remain unsigned.
10. Only remove the prerelease/preview qualification after the project has appropriate code-signing/provenance and the repository protection requirements are active.
