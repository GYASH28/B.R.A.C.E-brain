# BRACE 0.4.0 preview

BRACE 0.4.0 is the memory-quality and packaged-runtime release. It adds an explicit local review workflow for likely overlapping memories and fixes a packaged Electron startup failure that could leave 0.3.0 users on the opening sequence indefinitely.

## What changed

- A persistent Memory Review queue compares likely overlaps and lets the user keep either record as canonical or confirm that both are intentionally distinct. BRACE never silently merges the pair.
- Superseded memories remain recoverable in SQLite while leaving active recall; explicit forgetting still erases their content and evidence.
- Overview now reports review, provenance-link, and high-confidence memory-health signals.
- The SQLite schema advances to version 3 with a transactional migration for review outcomes.
- The launch site and beginner guide now use the final synthetic product captures, including the new review workbench.

## Packaged desktop fix

The 0.3.0 AppImage could load its Electron window while a strict Content Security Policy blocked Next.js hydration. The result looked like a permanent startup animation even though the local database bridge was available.

0.4.0 derives SHA-256 CSP allowances from the exact exported inline bootstrap scripts, keeps arbitrary inline JavaScript blocked, restricts the custom protocol to `brain://app`, and displays a retryable error state if the local snapshot cannot open. Native smoke tests now require the renderer to reach an interactive `ready` state with zero console errors; loading a window alone cannot pass.

## Release assets

- `BRACE-0.4.0.AppImage`
- `brace-brain_0.4.0_amd64.deb`
- `BRACE-Setup-0.4.0.exe`
- `SHA256SUMS.txt`
- `brace-0.4.0.cdx.json` CycloneDX dependency SBOM

Linux packages are built and tested on Linux. The NSIS installer is built, installed silently, launch-smoked, MCP-smoked, and uninstalled on the native Windows GitHub Actions runner.

## Privacy and security

The release repository and packages contain only synthetic Northstar examples. Runtime databases, imported files, credentials, logs, machine paths, and local Codex skill sources are excluded. The renderer remains sandboxed with context isolation, no Node integration, denied navigation/popups/permissions, a narrow IPC bridge, and a hash-constrained Content Security Policy.

## Known limitations

The packages are not code-signed, so Windows may display an unknown-publisher warning. Verify downloads against `SHA256SUMS.txt`. BRACE still has no automatic update channel or macOS package, and `brace.sqlite3` relies on operating-system disk encryption rather than application-level database encryption.
