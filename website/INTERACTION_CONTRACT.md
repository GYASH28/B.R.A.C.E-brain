# Launch-site interaction contract

The BRACE site is an explorable explanation of a local memory system, not an animation reel. Every effect must help a visitor understand custody, inspect provenance, see the real product, or complete a safe first run.

## Interaction map

| # | System | Product purpose | Inputs | Calm/reduced-motion behavior |
| --- | --- | --- | --- | --- |
| 1 | Memory ignition | Form fragments into the BRACE mark and establish the local-memory signal | Automatic, Skip, Replay, `Escape` | Skipped automatically; content is immediately available |
| 2 | Hero product film | Trace source-to-memory progress over a real packaged-app frame | Native scroll | Static poster; video is not requested |
| 3 | Context relay | Explain source, local memory, and explicit AI handoff boundaries | Stage buttons, range, keyboard | Immediate state changes |
| 4 | Product simulation | Demonstrate capture, indexing, recall, graph, handoff, and automation using deterministic synthetic data | Tabs, arrows, Previous/Next | Immediate state changes without entrance animation |
| 5 | Product proof reel | Browse real packaged-app screenshots from the synthetic Northstar profile | Scroll, Previous/Next | Native horizontal scrolling |
| 6 | Screenshot inspector | Expand product evidence without losing the gallery position | Open, Previous/Next, `Escape` | Opens without transform animation |
| 7 | Download advisor | Identify the visitor's platform while keeping Windows and Linux equal | Device hint, direct links | Identical |
| 8 | Guide launchpad | Adapt install instructions to Windows, Linux, or source builds | Platform buttons | Identical |
| 9 | Setup checklist | Let a beginner track seven local setup milestones | Checkboxes, Reset | Identical; persists only in browser local storage |
| 10 | Troubleshooter | Turn a first-run symptom into one safe diagnostic action | Symptom buttons | Identical |
| 11 | Command copy | Copy install and MCP commands with visible confirmation | Copy buttons | Identical |
| 12 | Reading progress | Show position in a long operational guide | Native scroll | Immediate progress updates |

## Non-negotiable behavior

- The opening is never mandatory: Skip and `Escape` work, Replay is optional, and reduced-motion users bypass it.
- Keyboard users can reach every control, operate the relay and simulation tabs, close dialogs, and see focus.
- `prefers-reduced-motion: reduce` removes the opening, smooth scrolling, scroll transforms, canvas motion, parallax, and nonessential transitions.
- Mobile uses reflowed controls and a readable single-column guide; it is not a squeezed desktop canvas.
- Motion never changes the factual meaning of a source, memory, platform, release, or privacy boundary.
- Product screenshots and examples use only the fictional Northstar workspace.
- The live demo is labelled as a non-persistent local simulation and cannot imply impossible product behavior.
- Imported sources remain canonical, local memory remains distinct, and an AI handoff remains an explicit permission boundary.
- The public site must make the unsigned-preview status visible near downloads.

Run `npm run audit:interactions`, `npm run audit:layout`, `npm run audit:focus`, and `npm run audit:a11y` from `website/builds/brace` after changing HTML, CSS, JavaScript, or public assets.
