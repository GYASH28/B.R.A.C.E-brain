# Distribution and verification

BRACE 0.6.0 targets 64-bit Linux and Windows.

## Release artifacts

| Platform | Artifact | Packaging |
| --- | --- | --- |
| Linux | `BRACE-0.6.0.AppImage` | Portable AppImage |
| Debian / Ubuntu | `brace-brain_0.6.0_amd64.deb` | Debian package |
| Windows | `BRACE-Setup-0.6.0.exe` | Per-user NSIS installer |

Tagged releases also include `SHA256SUMS.txt`.
They also include a CycloneDX dependency SBOM named `brace-0.6.0.cdx.json`.

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
| `npm ci` and dependency audit | Required | Required |
| ESLint and TypeScript | Required | Required |
| Core test suite | Required | Required |
| Static Next.js export | Required | Required |
| Electron compile | Required | Required |
| Synthetic desktop E2E | Required under Xvfb | Required natively |
| Executable MCP stdio smoke | Required under Xvfb | Required natively |
| Native package build | AppImage and Debian | NSIS |
| Package content inspection | Required | Required |
| Website accessibility audit | Required | Covered in Linux job |

The tagged-release workflow runs native jobs and attaches their output to a prerelease. A package built for another platform is not described as runtime-tested until its native job passes.

## Linux smoke test

Run a package against disposable XDG directories:

```bash
npm run electron:smoke -- "dist/installer/BRACE-0.6.0.AppImage"
```

The smoke harness starts the application with a unique token, waits for both renderer and shell readiness in the local log, checks that the process exits, and removes the temporary profile.

The full source E2E uses a temporary profile, initializes only the synthetic Northstar demo, exercises task help, command capture, protected forgetting, Search, contextual Library/Timeline/Map/Review navigation, Capture, Ask BRACE, Automations/Skills, AI connections, Settings, and persistence, captures real product screenshots, and fails on renderer console errors or leaked workspace paths.

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

The 0.6.0 installer is not code-signed. Users should verify its SHA-256 digest and expect Windows SmartScreen to show an unknown-publisher warning.

## Linux behavior

The AppImage is suitable for distributions with the required FUSE compatibility or AppImage extraction fallback. The Debian package registers BRACE in the Office category and installs the `brace` executable.

## Signing and provenance

0.6.0 does not claim code-signing, notarization, or reproducible byte-for-byte builds. GitHub Actions records the source ref and native runner logs. Future releases should add signing and artifact attestations before introducing automatic updates.

## Release procedure

1. Update `CHANGELOG.md` and release notes.
2. Run the full local quality gate and privacy scan.
3. Commit and push `main`.
4. Wait for Linux and Windows CI to pass.
5. Tag the package version (for example `v0.6.0`) and push the tag.
6. Wait for native release jobs.
7. Verify attached hashes and inspect the GitHub prerelease page.
8. Keep the release marked prerelease until community testing and code signing mature.
