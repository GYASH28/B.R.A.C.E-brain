# Launch-site interaction contract

The BRACE site is an explorable explanation of a local memory system, not an animation reel. Every effect must help a visitor recover context, inspect provenance, understand a boundary, view the real product, or choose a package.

## Interaction map

| # | System | Product purpose | Inputs | Calm/reduced-motion behavior |
| --- | --- | --- | --- | --- |
| 1 | Cinematic opening | Establish the fragment-to-memory story and real BRACE mark | Play, skip, `Escape` | Skipped automatically |
| 2 | Command palette | Jump directly to recall, graph, proof, guide, or download | Click, `Ctrl/Cmd+K`, arrows, `Enter` | Identical without entrance motion |
| 3 | Memory divider | Compare forgotten fragments with recovered context | Pointer drag, arrows, `Home`, `End` | Immediate state changes |
| 4 | Fragment recovery | Turn scattered questions into an explicit recovery action | Click/tap, reset | State and count update without travel animation |
| 5 | Provenance receipts | Inspect the distinction between an original source and durable memory | Click/tap, dialog keyboard controls | Dialog opens without transform animation |
| 6 | Recall query lab | Try synthetic questions and see source-backed results | Form submit, prompt chips | Loading delay is removed |
| 7 | Evidence layers | Isolate source, memory, and receipt in the retrieval result | Click/tap toggles | Immediate visibility change |
| 8 | Copy recall | Copy the displayed synthetic result with confirmation | Click/tap | Identical |
| 9 | Memory constellation | Explore typed relations instead of a decorative node cloud | Filters, node selection, arrow keys, center | Static readable graph; reshuffle is immediate |
| 10 | Constellation reshuffle | Show that relationships remain legible across layouts | Click/tap | Immediate layout change |
| 11 | Privacy vault | Inspect source, memory, and network boundaries | Click/tap | Readout changes without animation |
| 12 | Product proof gallery | Browse and expand real synthetic-workspace screenshots | Previous/next, expand, dialog controls | Scrolling and dialog opening are immediate |
| 13 | Package advisor | Match guided or portable intent to equal Windows/Linux release choices | Click/tap | Highlight changes immediately |
| 14 | Motion control | Let visitors choose a calmer experience independent of OS settings | Click/tap | Locked to system calm when reduced motion is requested |
| 15 | Memory pulse and card response | Reveal connected interactive surfaces and spatial depth | Click/tap, fine-pointer hover | Disabled or flattened |

## Non-negotiable behavior

- Keyboard users can reach every control, operate the divider and graph, close dialogs, and see focus.
- `prefers-reduced-motion: reduce` removes autoplay, smooth scrolling, parallax, magnetic motion, tilts, and nonessential transitions.
- Mobile uses a purpose-built single-column graph and package flow; it is not a squeezed desktop layout.
- Motion never changes the factual meaning of a source, memory, platform, release, or privacy boundary.
- Product screenshots and examples use only the synthetic Northstar workspace.
- The graph stays inspectable: typed nodes, readable connections, a selected-node explanation, and no random decorative particles masquerading as data.

Run `npm run audit:interactions` and `npm run audit:a11y` from `website/builds/brace` after changing HTML, CSS, JavaScript, or public assets.
