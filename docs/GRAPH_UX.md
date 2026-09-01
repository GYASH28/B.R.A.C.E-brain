# BRACE Brain UX contract

## Screen job

The Brain lets someone understand and traverse the relationships among local project folders, original documents, durable memories, explicit decisions, and extracted ideas without losing source provenance.

The graph is a primary workspace, not a dashboard illustration. It must remain discoverable from the main navigation, the global header, and a live Home preview.

## Primary user and action

The primary user has accumulated enough files and memories that lists no longer explain how their work fits together. Their primary action is to select a node, understand why it matters, and continue into the underlying memory, source search, or connected neighborhood.

## Node language

- Project: a local folder anchor. Show the canonical folder path.
- Document: one indexed source file. Show its original URI and project relationship.
- Memory: durable, AI-usable context. Open the real memory detail.
- Decision: an explicit choice with project context. Continue into source search/timeline.
- Idea: an extracted named entity used for traversal.
- Dense group: an explicit level-of-detail cluster. It must state how many nodes it represents and offer a way to unfold it.

## Density and performance rules

- Keep the full graph counts visible; never silently pretend a partial projection is complete.
- Render bounded deterministic projections: 140 nodes in Overview, 280 in Focus, and 520 in All.
- Rank selected nodes, query matches, direct neighbors, projects, high-degree nodes, and recent nodes first.
- Group the remaining eligible nodes by type and aggregate their edges.
- Only label selected, related, matched, clustered, or high-signal nodes in dense views.
- Only animate the selected neighborhood. Never start one perpetual animation per edge.
- Use indexed maps/sets for selection and adjacency work; avoid repeated full-node searches inside edge loops.

## Navigation and controls

- Drag empty canvas space to pan.
- Use the wheel or explicit buttons to zoom; `0` fits the graph.
- `F` enters real Fullscreen API mode; Escape exits it.
- Arrow keys move through the rendered node set; Enter/Space selects.
- Overview, Focus, and All state their trade-off through visible rendered/grouped counts.
- The inspector can collapse so the graph can own the full width.

## Required states

- Empty: explain that importing a project or capturing memory builds the Brain.
- Dense: preserve counts, expose clusters, and remain interactive.
- Search: show matches plus their immediate context.
- Filtered: retain the selected node while applying the requested type filter.
- Fullscreen: fill the viewport, retain controls, and exit through Escape or the visible control.
- Reduced motion: stop edge flow and background drift while preserving state changes.

## Responsive contract

- Desktop: canvas plus document/node inspector.
- Narrow desktop/tablet: inspector becomes an overlay rather than shrinking the graph.
- Mobile: canvas remains usable; secondary legend/hints yield to touch controls.

