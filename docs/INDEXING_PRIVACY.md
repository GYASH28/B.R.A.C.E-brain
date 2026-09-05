# Project indexing and privacy

BRACE indexes only a specific folder the user selects. It rejects filesystem roots, does not follow symlinks, verifies containment, and never rewrites imported originals.

The worker applies file-count and size caps, skips dependencies/build/temp/credential filenames, honors `.braceignore`, reports unsupported or unreadable files, and scans ordinary text for common secret, token, private-key, and password patterns. Redaction is defense in depth, not a guarantee.

Each changed source is committed atomically after reading, redaction, chunking, and any enabled embedding work completes. A cancelled or failed replacement leaves the previous complete source index usable. Progress reports phase, scanned/changed/unchanged/skipped/error/redaction/chunk/embedding counts and elapsed time.

Watching is disabled by default and enabled per project. Bursts are debounced and coalesced; generated and temporary trees are ignored. Watch jobs pause on suspend and conservative resource policy. BRACE never silently watches the whole device.

Project URIs exposed to MCP, portable export, and support diagnostics are private-path-free. The desktop can show a shortened provenance path for a folder the same user explicitly selected; it never places that path in a support bundle or public fixture.
