# BRACE Frosted Workspace design system

## Product contract

BRACE is a private desktop memory instrument, not a generic analytics dashboard. Its core loop is **recall → inspect evidence → retain or capture → continue work**. The default interface is a luminous workspace because local context should feel readable and owned, not hidden inside a dark control room. Every visible metric must come from the local snapshot. Every action must produce a real state or explain why it is unavailable.

## Screen contract

- **Home** answers “what is worth continuing?” with one featured memory and a maximum of three next useful moves derived from real review, project, automation, and connection state.
- **Recall** is the primary retrieval surface. Durable memory and source evidence remain visually separate at every size.
- **Capture** has two explicit outcomes: a durable memory or a decision with rationale. It never stores a raw AI transcript by default.
- **Ask AI** prepares a visible local context capsule before crossing a provider boundary. A memory can seed an editable handoff draft; nothing is sent until the user presses Send.
- **Library** views organize memory, chronology, and relationships. They do not repeat generic dashboard metrics.
- **System** views expose projects, automations, connections, skills, and settings with permissions and failure states beside the relevant action.

Navigation is grouped as Work, Library, and System. Recall, Capture, and Ask AI must remain reachable from the first group and from the command palette. No more than one primary action dominates a page.

## Colour roles

| Role | Dark | Light | Purpose |
| --- | --- | --- | --- |
| Canvas | `#071a34` | `#cfe4ff` | Dim navy field or luminous blue atmosphere |
| Surface | `rgba(15, 24, 39, .68)` | `rgba(255, 255, 255, .64)` | Optical glass with contextual blur |
| Raised | `#111a29` | `#f8fbff` | Neomorphic controls and selected objects |
| Ink | `#f5f8ff` | `#101724` | Primary readable text |
| Ink soft | `#a8b6ca` | `#4c5b70` | Secondary copy, never low-contrast gray |
| Signal | `#7dd3fc` | `#0369a1` | Primary action, focus, active memory |
| Spectral | `#c4b5fd` | `#6d28d9` | Relationships and AI handoff only |
| Success | `#6ee7b7` | `#047857` | Local, verified, complete |
| Danger | `#fb7185` | `#be123c` | Destructive actions and errors |

Orange is not a brand colour. Amber may not be used as decoration or selection. Warnings use rose with explicit text.

## Material rules

- Glass represents navigation, a provider boundary, a receipt, a floating control, or selected context. Indexed content uses quieter paper surfaces instead of turning every object into glass.
- Each glass surface combines a translucent fill, 1px optical edge, backdrop blur, and one offset canvas-tinted shadow.
- Neomorphism is limited to pressable controls and inset wells. Raised and inset states must remain obvious at 200% zoom and in forced colours.
- Maximum three elevation levels. Nothing receives a zero-offset coloured halo.
- Radius scale: 10, 16, 24, and full circle only.

## Typography

- System display stack: `SF Pro Display`, `Segoe UI Variable Display`, `Avenir Next`, system UI.
- System text stack: `SF Pro Text`, `Segoe UI Variable Text`, system UI.
- Monospace only for paths, retrieval modes, commands, and machine-readable state.
- Headings use tight tracking and balanced wrapping. Body measure stays between 45 and 72 characters.
- No serif accent words, gradient text, all-caps paragraph copy, or decorative micro-labels on every section.

## Motion

- Press feedback: `scale(.975)` plus a short inset response.
- Hover: 140–220ms. Panels and view transitions: 320–520ms. Opening choreography: at most 1.4s before the interface is usable.
- Continuous motion uses transform and opacity; clip-path is allowed for material reveals.
- Reduced motion removes travel and parallax, keeps opacity cues, and immediately exposes final readable states.
- One or two key animated elements per view. Activity must never compete with recall results.

## Interaction and accessibility

- Minimum pointer target 40px desktop and 44px touch.
- Every icon-only action has an accessible name and tooltip when discoverability benefits.
- Focus-visible is a 2px ice-blue ring with offset and sufficient contrast.
- Graph meaning uses shape, labels, relationship text, and an adjacency inspector in addition to colour.
- Loading, empty, error, success, permission, disabled, and destructive confirmation states are first-class.

## Reject

- Generic dashboard card grids, fake telemetry, decorative bento layouts, equal feature tiles, and twelve destinations presented at equal hierarchy.
- Orange/ember branding, violet-to-blue AI gradients, neon buttons, excessive glow, and black-on-black surfaces.
- Controls with no outcome, invisible hover-only meaning, squeezed desktop mobile layouts, and endless opening screens.
- Emoji used as interface icons, `transition: all`, and custom cursor behavior on touch or reduced motion.
