# BRACE 0.2.0 preview

BRACE 0.2.0 is the experience release: the same local-first memory architecture, rebuilt into a product that feels alive and makes provenance easier to understand.

## What changed

- A cinematic, responsive launch site with live recall, a visual local boundary, an interactive provenance handoff, real product captures, and direct Windows and Linux downloads.
- A redesigned desktop overview centered on live memory, real index health, recent context, and fast recall.
- A new interactive memory constellation with deterministic layout, search, type filters, zoom, animated relationship paths, keyboard navigation, and a details inspector.
- Richer view transitions, responsive behavior, micro-interactions, focus states, and a complete reduced-motion experience across the app and site.
- Version-safe release automation so tagged builds discover and publish the correct installer names.

## Packages

- `BRACE-0.2.0.AppImage`
- `brace-brain_0.2.0_amd64.deb`
- `BRACE-Setup-0.2.0.exe`
- `SHA256SUMS.txt`
- `brace-0.2.0.cdx.json` CycloneDX dependency SBOM

Linux artifacts are built, inspected, and smoke-tested on a native Linux runner. The Windows NSIS installer is built, inspected, launched, and MCP-smoke-tested on a native Windows runner. Both run the synthetic Electron E2E flow before publication.

## Important preview note

The installers are not code-signed. Verify the downloaded file against `SHA256SUMS.txt`; Windows SmartScreen may report an unknown publisher. BRACE still has no automatic update channel.
