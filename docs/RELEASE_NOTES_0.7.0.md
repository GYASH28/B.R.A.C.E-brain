# BRACE 0.7.0 preview

BRACE 0.7 makes the knowledge graph the center of the second-brain experience. The new **Brain** workspace is built to remain understandable with a handful of files and responsive with thousands of nodes, while keeping every represented source, memory, decision, and idea connected to a real workflow.

## Brain workspace

- Brain is now a primary navigation destination, appears as a live node beacon in the header, and has an interactive preview on Home.
- The canvas supports drag-to-pan, wheel and button zoom, fit-to-view, keyboard travel, a collapsible inspector, and genuine fullscreen mode through the visible control or `F`.
- Overview, Focus, and All levels make the rendering trade-off explicit. The interface reports how many nodes are rendered and how many are represented by clusters.
- Dense graphs are projected deterministically. Selection, query matches, direct neighbors, project anchors, high-degree nodes, and recent signals receive priority.
- Overflow nodes become visible type clusters and their relationships are aggregated. BRACE never silently presents a partial projection as the whole graph.
- All five graph layouts now apply collision relaxation, density-aware sizing, and label level-of-detail.

## Documents, memories, and decisions

- Source nodes are presented as **documents** and show their original BRACE URI, project context, indexed passage count, section count, and last signal.
- Project nodes show a privacy-shortened folder path and indexed document count.
- Memory nodes open the real memory detail. Documents, projects, decisions, and ideas continue into source search with the node label already prepared.
- The inspector exposes up to eight direct relationships and can switch into a focused neighborhood.

## Performance and motion

- The renderer no longer creates a label, moving particle, and unbounded relationship element for every graph record.
- Overview renders at most 140 real nodes, Focus 280, and All 520, plus at most five explicit clusters.
- Relationship rendering is bounded at 420, 900, and 1,600 edges respectively.
- Motion is limited to the selected neighborhood and respects reduced-motion preferences.
- A dedicated 2,500-node / roughly 5,000-edge stress contract verifies bounded projections, clustering, selected-node retention, query context, and filtering.

## Verification

The release gate covers lint, type safety, the complete product and core test suite, production compilation, Electron compilation, the native synthetic desktop journey, MCP smoke tests, package audits, and executable smoke tests on Linux and Windows runners. The Electron journey explicitly proves fullscreen entry and exit, zoom, all five layouts, source selection, keyboard travel, responsive behavior, and zero renderer console errors.

## Downloads

- `BRACE-Setup-0.7.0.exe` — Windows x64 per-user NSIS installer
- `brace-brain_0.7.0_amd64.deb` — Debian and Ubuntu x64 package
- `BRACE-0.7.0.AppImage` — portable Linux x86_64 image
- `SHA256SUMS.txt` — SHA-256 digest list for every release file
- `brace-0.7.0.cdx.json` — CycloneDX dependency SBOM

The preview packages are not code-signed. Download only from this GitHub release and verify the matching digest before installation.

