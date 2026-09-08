# BRACE Scrollcraft website + codebase audit

Date: 2026-09-08  
Branch: `design/scrollcraft-website-v2`  
Base: `codex/unified-second-brain` at `b299a1f`

## Executive assessment

The BRACE application code is materially stronger than the old marketing presentation suggests. The repository already has real local-first architecture, source-backed retrieval, strict IPC contracts, a deny-by-default business authorization kernel, bounded synchronization crypto, recovery flows, release/privacy checks, real packaged screenshots, and browser verification scripts. The visual problem is not a lack of substance; it is that the public surface gives too many scenes nearly the same pale Arctic-glass treatment, so the emotional curve feels flat and the product's strongest idea — an inspectable living graph with provenance — does not land as the singular peak.

This branch changes the website without rewriting the BRACE app or weakening its deployment/security model.

## Codebase findings

### Strong foundations preserved

- IPC arguments are parsed through strict Zod schemas with bounded strings, arrays, objects, and unknown-field rejection.
- The Electron service owns authorization context rather than accepting an actor from renderer IPC, uses trusted-sender checks, and redacts sensitive error/history material.
- Business authorization is deny-by-default and resolves verified subject, organization, workspace, resource, membership, role/capability, and personal-owner boundaries before allowing protected actions.
- Company sync payloads use AES-256-GCM with tenant/workspace/actor/device/record/revision/key/time metadata authenticated as AAD; payloads and keys are bounded and key/plaintext buffers are cleared after use.
- The website has dedicated interaction, accessibility, layout, focus, production-contract, visual, and performance audits.

### Release/product limitations that must remain explicit

- Windows preview artifacts are unsigned and there is no verified automatic updater path yet.
- The SQLite database is not application-encrypted; OS account/full-disk protection remains part of the threat model.
- Secret scanning is defense-in-depth rather than a proof that imported content is safe.
- Local schedules run while the desktop app is open; BRACE is not yet an OS background daemon.
- Networked enterprise collaboration, full OIDC/SAML/SCIM, production remote synchronization/key management, and external-action organization agents are not claimed as shipped production capabilities.
- macOS signed/notarized distribution is not qualified.

These limitations are intentionally not hidden by the website redesign.

## Why the previous website felt weaker than the product

1. **Uniform energy.** Hero, fragments, provenance, company, screenshots, custody, and download all lived in closely related pale glass surfaces. Good polish, weak contrast in emotional importance.
2. **The peak was visually underweighted.** The interactive graph was functionally the best part, but the page around it did not create enough silence before it or enough contrast when it arrived.
3. **Motion vocabulary was narrow.** Most movement was reveal, parallax, hover, and graph state changes. Scrollcraft calls for multiple device families and a designed feeling curve rather than one repeated animation system.
4. **Product proof read like standard SaaS screenshot cards.** The screenshots are real and valuable; their presentation did not make that evidence feel like a progressing product tour.
5. **The guide read primarily as documentation.** Its content is strong, but visually it did not feel like the product teaching the user through a controlled journey.
6. **The site already had a distinctive idea — Provenance Pulse — but the rest of the choreography did not consistently serve it.**

## Scrollcraft interpretation

The existing `BRIEF.md` is retained as the source of truth: persistent cognitive atlas, Arctic glass technical cartography, one singular working-brain peak, and the Provenance Pulse signature move.

The redesign follows these Scrollcraft constraints:

- visitor journey before decoration;
- one remembered peak;
- visible depth made from independently moving planes rather than a flat background fade;
- at least four motion/device families;
- no scroll hijacking;
- mobile recomposition rather than simply shrinking desktop transforms;
- useful semantic HTML remains readable without animation;
- reduced-motion has a complete static composition;
- real product screenshots remain the proof source;
- no invented testimonials, fake metrics, fake dashboards, or decorative neural blobs.

## Homepage design grammar

### Act 1 — Local seed / hero

A dimensional atlas hero now uses independent background, copy, atlas, receipt, and atmospheric movement. Pointer response is subtle and additive. Scroll creates a short spatial payoff rather than a blocking intro film.

### Act 2 — Fragments

Disconnected work remains intentionally quieter. Spotlight response, restrained card lift, and route drift make the scene tactile without turning it into a second peak. A scroll-velocity text band introduces a different device family before the provenance transition.

### Act 3 — Evidence route

The existing source → memory → permission strip remains semantic and receives a moving optical emphasis tied to page progress.

### Act 4 — Working brain / singular peak

The live graph is now the only deep night-world inversion on the page. The sudden contrast, grid perspective, luminous evidence links, and selected node state make this unmistakably the center of the experience while retaining all current graph controls and accessibility semantics.

### Act 5 — Company scope

The page returns to light. Role lenses get depth and spotlight response, but remain presentation only. The roadmap disclaimer stays visible.

### Act 6 — Product proof

The four real packaged screenshots become a scroll stack. This adapts the useful interaction grammar of ReactBits-style Scroll Stack while preserving native browser scrolling, semantic figures, the existing lightbox, and no third-party runtime dependency.

### Act 7 — Custody

A quiet dark custody section reuses the product's topology language to explain boundaries. It is deliberately calmer than the brain peak.

### Act 8 — Local start

Download surfaces settle back into Arctic light with modest magnetic/shimmer feedback and platform-specific real release links.

## Beginner guide grammar

The guide remains a task-first seven-step route rather than becoming a marketing page.

- The hero becomes a dimensional installation launchpad.
- A compact chapter dock and active route rail make position obvious.
- Each `.guide-step` becomes a large editorial chapter with a progress trace, oversized chapter numeral, and one clear goal.
- Steps 04–05 (create memory and inspect recall) form the learning peak through a restrained dark inversion.
- Real application screenshots receive view-position depth rather than autoplay animation.
- Completion checkboxes continue to drive local progress and now also mark completed route chapters.
- Troubleshooting resolves into a calm utility surface rather than an ornamental ending.

## Motion / 21st.dev / ReactBits pattern mapping

The public BRACE website is intentionally static and has a strict CSP, request budget, JS/CSS budget, and no runtime network dependency. Therefore this branch **does not import a full React/Motion application solely to add effects**. It adapts the interaction primitives while keeping the current architecture:

| Inspiration | BRACE implementation |
| --- | --- |
| Motion `useScroll` / scroll-linked transforms | one requestAnimationFrame scroll loop writes CSS progress variables; visual movement stays on transform/opacity paths |
| Motion `whileInView` / 21st scroll reveal | existing IntersectionObserver reveal system + upgraded clip/scale/translate choreography |
| ReactBits Scroll Stack | real product screenshot figures become native sticky scroll-stack chapters |
| ReactBits Scroll Velocity | semantic-free atmospheric velocity band between problem and provenance acts |
| ReactBits Spotlight Card / 21st pointer surfaces | pointer-derived CSS radial spotlight variables on selected surfaces |
| premium magnetic CTA patterns | bounded pointer translation on primary actions; no pointer lock or cursor capture |
| Scrollcraft hero depth | independent copy, atlas, atmosphere, pointer and scroll planes with separate mobile behavior |

This keeps BRACE's deployment model coherent instead of shipping a second framework/runtime inside the static marketing surface.

## Files changed on this branch

- `website/builds/brace/index.html` — loads the new experience layer.
- `website/builds/brace/experience.css` — homepage art direction, depth, scene contrast, scroll-stack, spotlight, magnetic, mobile, reduced-motion, forced-colors.
- `website/builds/brace/experience.js` — lightweight scene rail, scroll/pointer progress, sticky stack transforms, spotlight/magnetic state.
- `website/builds/brace/guide/index.html` — loads the new guide experience layer.
- `website/builds/brace/guide/experience.css` — field-guide visual grammar and responsive/reduced-motion art direction.
- `website/builds/brace/guide/experience.js` — active chapter state, progress, spotlight, screenshot depth, completion cues.
- `website/builds/brace/SCROLLCRAFT_AUDIT.md` — this audit.

## Verification gate

Do not merge based on source review alone. The repository's existing browser checks remain authoritative. Before merging, run from `website/builds/brace`:

```bash
npm ci
npm run serve
```

Then, in another terminal:

```bash
npm run audit:production
npm run audit:interactions
npm run audit:layout
npm run audit:focus
npm run audit:a11y
npm run audit:performance
npm run audit:visual
```

Also visually inspect at minimum:

- homepage opening, hero midpoint, and hero exit at 1440×900;
- fragments → provenance transition;
- working-brain peak before/after selecting a source and following an evidence path;
- each product-proof stack state;
- custody and download close;
- homepage at 390×844 and 360×640;
- guide hero, steps 01, 04, 05, 07, and help on desktop and phone;
- reduced-motion homepage and guide;
- keyboard navigation through nav, graph, role tabs, lightbox, guide route, code-copy controls, and troubleshooting.

The branch is intentionally isolated from `main` and `codex/unified-second-brain` until these checks are green and the visual frames are reviewed.