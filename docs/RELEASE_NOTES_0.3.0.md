# BRACE 0.3.0 preview

BRACE 0.3.0 is the liquid-memory release: the local-first architecture is unchanged, while the complete public experience—from first website frame to graph traversal—has been rebuilt around clarity, motion, provenance, and native-feeling control.

## What changed

- Arctic Glass replaces the previous warm/orange visual system across the desktop, launch surface, download journey, and beginner guide.
- The launch surface now uses a custom provenance lens, a live forget/remember split, operable synthetic recall, a local-boundary vault, real packaged-product panorama, and a cinematic platform-aware download close.
- The desktop adds a real command palette (`Ctrl/⌘ K`), global quick capture (`Ctrl/⌘ N`), numbered navigation, a keyboard reference, and locally persisted density, motion, and contrast settings.
- The knowledge graph now has Orbit and Flow layouts, distinct node shapes, keyboard travel, relationship labels, zoom/reset controls, and a readable adjacency inspector.
- First-run and loading states explain useful progress and preserve the local/no-network boundary instead of presenting an uninformative spinner.
- The native E2E harness now fails with the correct process status and exercises the new interactive surfaces against an isolated synthetic SQLite profile.

## Packages

- `BRACE-0.3.0.AppImage`
- `brace-brain_0.3.0_amd64.deb`
- `BRACE-Setup-0.3.0.exe`
- `SHA256SUMS.txt`
- `brace-0.3.0.cdx.json` CycloneDX dependency SBOM

Linux artifacts are built, inspected, and smoke-tested on Linux. The Windows NSIS installer is built and tested on a native Windows GitHub Actions runner. Both packaging paths run the synthetic Electron journey before publication.

## Important preview note

The installers are not code-signed. Verify a downloaded file against `SHA256SUMS.txt`; Windows SmartScreen may report an unknown publisher. BRACE has no automatic update channel and does not claim macOS support in this release.
