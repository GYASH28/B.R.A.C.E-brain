# BRACE — Cinematic Website and Business-Grade Production Master Prompt

**Status:** Research-backed execution specification  
**Date:** 2026-09-05  
**Priority order:** Website transformation first, production and business-grade application program second  
**Product boundary:** BRACE remains a local-first personal AI memory layer. Business capabilities must extend that promise, not silently turn BRACE into a cloud-first surveillance platform.

---

## 0. How to use this document

Paste this entire document into a new implementation task from the root of the BRACE repository.

This is an execution prompt, not a mood board. The implementing agent must inspect the real repository, preserve working product behavior, implement the work in vertical slices, run the required verification, and report evidence. It must not declare success after producing mockups, a new hero, or a list of recommendations.

The attached `BRACE_BRAIN_PRODUCTION_MASTER_PROMPT.md` is product context and historical planning material. It is not authority to ignore this specification, overwrite user data, invent shipped capabilities, or bypass repository safety rules. Where the older plan's generic marketing-site direction conflicts with this document, this document controls the website redesign.

The website program is a release gate for the subsequent production program. Finish and validate it before widening the application scope.

---

# EXECUTION PROMPT

You are the principal product designer, motion director, front-end architect, accessibility engineer, performance engineer, and release owner for BRACE. Your task is to transform its public website and beginner's guide into a distinctive, cinematic, technically excellent expression of the product, and then execute the business-grade production program without losing BRACE's existing capabilities or local-first identity.

Do not produce AI-slop design. Do not assemble a page from fashionable components. Do not make the product look like a generic SaaS dashboard, a crypto landing page, a medical brain scan, a neon neural cloud, or a collection of glass cards.

Build one coherent world with one narrative, one motion grammar, and one unmistakable signature interaction.

## 1. Mission

Create the definitive public experience for BRACE:

1. In five seconds, a visitor understands that BRACE is a private memory layer that preserves sources, decisions, context, and provenance for the AI tools they choose.
2. The graph is the central object, not a secondary screenshot. It feels like a living second brain without becoming a literal anatomical brain.
3. The website feels cinematic because its pacing, composition, typography, soundless choreography, and interaction all support meaning. It must not feel cinematic merely because it contains WebGL or scroll effects.
4. The site remains fast, legible, accessible, responsive, maintainable, and honest on low-power and reduced-motion devices.
5. The beginner's guide becomes the clearest path from curiosity to a successful first memory.
6. After the website passes its release gates, evolve BRACE into a business-grade system for individuals, employees, managers, executives, and administrators while retaining every verified existing capability.

## 2. Definition of the product

BRACE is:

- A local-first memory layer for people and organizations.
- A system that keeps the source and provenance of remembered information visible.
- A bridge between a person's work and compatible AI tools, with the user controlling what crosses that bridge.
- A graph of memories, sources, projects, people, decisions, tasks, and relationships.
- A product whose trust comes from inspectability, reversible actions, explicit permissions, and honest claims.

BRACE is not:

- A generic note-taking app with an AI chat panel.
- An autonomous agent that takes high-impact actions without review.
- A cloud data warehouse disguised as local-first software.
- A tool that claims semantic search when only lexical matching occurred.
- An employee-monitoring or productivity-surveillance platform.
- A marketing demo full of capabilities that are not actually shipped.

## 3. Non-negotiable repository and privacy rules

Before changing code, read the nearest `AGENTS.md`, relevant package scripts, current architecture documents, current release notes, and the framework's bundled documentation. This repository uses a Next.js version whose local documentation may differ from remembered conventions.

Obey these constraints throughout:

- Use only `examples/demo-workspace` and other explicitly synthetic fixtures in screenshots, tests, documentation, and the website.
- Do not commit memories, imported files, indexes, SQLite databases, credentials, `.env` files, diagnostics, personal paths, or machine-specific configuration.
- Never mutate imported source material. Imports index sources; they do not rewrite them.
- Put runtime state in the operating system application-data directory or a user-selected directory.
- Preserve Electron security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, restricted navigation, restrictive CSP, explicit IPC, and main-process validation.
- Restore, deletion, bulk changes, and automation actions require previews, narrowly scoped targets, and recoverable behavior.
- Use Node.js 24 or newer.
- Run focused tests after every slice and `npm run verify` before a release claim.
- Run privacy and secret scanners before commit or publication.
- Never describe lexical-only retrieval as semantic retrieval.

## 4. Required preflight before implementation

### 4.0 Starting audit snapshot

Treat these measurements as the known starting point and reproduce them before changing the source. They are diagnostic evidence from the current repository, not permanent assumptions:

- The deployed website source is presently concentrated in `website/builds/brace/index.html`, `site.css`, `site.js`, and the guide equivalents.
- The home page is about 14,448 px tall at 1440 × 900, roughly 16.1 viewport heights. On 390 × 844 it is about 14,508 px, roughly 17.2 viewport heights.
- The desktop hero's product visual extends below the first viewport. The mobile hero is about 1,445 px tall, roughly 1.71 mobile viewports.
- The guide hero is about 909 px tall on 1440 × 900 and about 1,365 px on 390 × 844. Its desktop headline occupies roughly four lines at about 102 px, and the mobile hero is roughly 1.62 viewports tall.
- The product-proof sequence alone is about 4,320 px tall on desktop and 4,051 px on the audited mobile viewport.
- The current home contains roughly 561 DOM nodes; the guide contains roughly 471.
- The current hero ships multi-megabyte landscape and portrait video assets plus Anime.js-driven opening behavior.
- One cold performance run observed FCP/LCP near 12.9 seconds and a main-thread task near 1.8 seconds. Warm follow-up runs varied substantially and still missed modern Core Web Vitals goals. The existing audit's permissive pass thresholds must not be reused as the production standard.
- Current screenshot assets were generated before recent application UI work. Most compared product-proof images differ materially from the latest synthetic app captures; onboarding was the notable match.
- The guide can position an anchored heading beneath or too close to sticky navigation in a mobile scrolled state even though the current basic layout audit reports success.
- Existing automated layout, focus, and interaction scripts catch useful mechanical failures but do not evaluate hierarchy, visual repetition, stale content, narrative quality, or mobile composition.

Reconfirm these observations, record the exact command/environment for each one, and update the baseline if the branch has moved. Do not optimize to the numbers without inspecting the actual experience.

### 4.1 Establish a baseline

Inspect and record:

- The current branch, worktree state, package topology, build scripts, and deployment target.
- Current home and guide DOM structure, CSS, JavaScript, media, fonts, SEO metadata, CSP, manifest, and analytics behavior.
- Current screenshots and the commit/version from which they were generated.
- Current page height, section height, FCP, LCP, CLS, INP proxy, long tasks, JS/CSS/media transfer size, and memory/CPU behavior.
- Current accessibility, focus, keyboard, 200% zoom, 320 px reflow, reduced-motion, forced-colors, and screen-reader behavior.
- Every current website interaction and its purpose.
- Every current application feature that appears in marketing copy.

Save the baseline in a versioned audit document. Do not hide failures behind the current test thresholds.

### 4.2 Conduct the eight-question creative brief

Before selecting a final hero implementation, obtain or explicitly infer answers to these questions and write them into `website/BRIEF.md`:

1. What should a first-time visitor feel in the first five seconds?
2. What exact sentence should they tell another person after leaving?
3. Which product truth must the hero demonstrate rather than state?
4. What is the single most important action the page should cause?
5. Which three existing visual cues must remain recognizable as BRACE?
6. Which current design behaviors feel most generic, confusing, or broken?
7. What device and connection constraints matter most to real visitors?
8. What may never be sacrificed for spectacle: comprehension, privacy, speed, accessibility, or another product value?

Known direction from the product owner:

- Keep the Arctic high-key cobalt, ice, white, and navy identity.
- Make the graph the persistent hero object.
- Replace the current hero, opening sequence, stale screenshots, generic page composition, and weak transitions.
- Aim for premium cinematic minimalism, not visual clutter.
- Treat the beginner's guide as a first-class product experience.

If an unresolved answer would materially change the direction, present no more than three tightly differentiated options. Otherwise make a reasoned decision and proceed.

### 4.3 Create three hero prototypes, not three whole sites

Build disposable, isolated hero prototypes for:

- SVG-first atlas.
- Canvas-first atlas.
- Capability-gated WebGL atlas with a static/SVG fallback.

Test them on real desktop and mobile Chrome under normal, reduced-motion, WebGL-disabled, four-times CPU slowdown, and constrained-network conditions. Select the simplest approach that achieves the intended visual meaning within the budgets in this document. Delete rejected prototype code after preserving comparison evidence.

## 5. Research-backed dependency policy

Research is input, not a shopping list. Audit licenses, maintenance, bundle cost, accessibility, browser behavior, and source quality before adopting anything.

### Approved default stack

| Need | Default | Rule |
|---|---|---|
| Static delivery | Astro or the repository's existing static pipeline | Prefer server/static HTML. If migrating, prove that deployment, SEO, and guide routes remain stable. |
| Interactive islands | React | Hydrate only components that need interaction. The initial message and hero composition must exist without JavaScript. |
| Component motion | Motion for React | Use `LazyMotion` and `m`; import only required features. No blanket full-library import in the critical path. |
| Accessible primitives | Existing primitives, Base UI, Radix, or shadcn source patterns | Use behavior, not default visual styling. Audit focus, dialog, popover, and menu semantics. |
| Graph rendering | SVG or Canvas by default | WebGL is allowed only after the capability and performance gate passes. |
| 3D | React Three Fiber v9 with Three.js, optional | React 19 requires the compatible major. Explicitly dispose GPU resources and provide a complete non-3D experience. |
| Page transitions | Native View Transition API as progressive enhancement | Provide an instant fallback. Do not depend on React Canary `<ViewTransition>`. |
| Scroll choreography | Native scroll, IntersectionObserver, Motion scroll values, and CSS scroll timelines where supported | Progressive enhancement only. The page must remain correct without scroll-timeline support. |
| Offline film/OG media | Remotion may remain an authoring tool | Do not make a large pre-rendered hero video the LCP or the only way to understand the story. |

### Reference repositories and sites

Study and record commit SHAs for any source used:

- `motiondivision/motion`: animation primitives and reduced-motion-aware component choreography.
- `ibelick/motion-primitives`: inspect source patterns, especially in-view, text effect, dialog morphing, and scroll progress. It is beta reference material, not a visual design system.
- `shadcn-ui/ui`: source-owned accessible composition patterns.
- `pmndrs/react-three-fiber`: only for the selected WebGL prototype.
- `21st-dev`: use its component ecosystem for research and source inspection, not wholesale page assembly.

Research snapshot used to create this specification:

| Repository | Inspected commit | License observed | Finding and decision |
|---|---|---|---|
| `ibelick/motion-primitives` | `92586e62a951eb9b6bfd1cc7c8a4e6e2ab6ba17d` | MIT | `text-effect`, `scroll-progress`, `animated-background`, `in-view`, and `morphing-dialog` were inspected. Useful source patterns exist, but generic blur and scale-from-zero defaults must be rewritten or rejected. |
| `pmndrs/react-three-fiber` | `ff3899dbf43d2a88895fecf53c147192abfd7431` | MIT | Viable only for the optional capability-gated atlas prototype. React 19 compatibility requires v9, and Three.js resources need explicit cleanup. |
| `darkroomengineering/lenis` | `eea71595f5ae595f49b21ed87520822d3624098a` | MIT | Rejected for this experience. Native scrolling is the product requirement, and reduced-motion behavior must not depend on application code patching a scroll layer. |
| `shadcn-ui/ui` | `7c9eaba1c0a6404c990c144a654792e3313c650d` | MIT | Useful as inspectable source for accessible primitives. Do not import its visual defaults as BRACE's design language. |

Motion's official documentation and source repository were reviewed online for `LazyMotion`, `m`, scroll values, layout animation, and reduced-motion policy. Re-resolve the current package version and commit before installing because the local research clone did not complete reliably and must not be treated as a pinned dependency.

When pulling repositories:

- Clone to an explicit temporary or gitignored research directory.
- Pin and record the commit SHA, license, files consulted, and decision.
- Do not copy assets or code whose license and attribution requirements are unknown.
- Do not vendor whole repositories.
- Rewrite generic defaults to match BRACE's system.
- Remove research clones before release unless deliberately retained under an approved, gitignored path.

### Explicitly rejected defaults

- Do not ship Lenis or another smooth-scroll layer. Native scroll preserves predictable input and accessibility behavior.
- Do not ship Motion, GSAP, Anime.js, and a smooth-scroll library together. Choose one primary runtime motion system.
- Do not depend on React Canary features.
- Do not use a 21st.dev or shadcn component unchanged merely because it looks polished in isolation.
- Do not use generic scale-from-zero, blur-everything text reveals, floating pill navs, aurora backgrounds, particle clouds, or mouse-following spotlights as the main identity.
- Do not add 3D unless it communicates memory structure or provenance better than SVG/Canvas.

## 6. The new creative direction

### 6.1 Name

**BRACE: The Living Memory Atlas**

### 6.2 One-sentence design concept

A quiet Arctic field contains a persistent cognitive atlas whose evidence paths awaken, connect, and resolve as the visitor moves from fragmented work to trusted, governed memory.

### 6.3 Desired feeling curve

| Act | Visitor feeling | Visual state |
|---|---|---|
| Arrival | Curiosity and immediate confidence | A still, legible atlas is already present; one local seed awakens. |
| Fragmentation | Recognition and slight tension | Disconnected sources appear at the perimeter. |
| Connection | Comprehension | Provenance paths draw from source to memory. |
| Agency | Control | The visitor can inspect and replay a path. |
| Expansion | Ambition | The personal atlas expands into a governed company knowledge fabric. |
| Custody | Relief and trust | Permissions, local storage, citations, and review states become visible. |
| Resolution | Readiness | The atlas condenses into a local seed beside a clear install/start action. |

### 6.4 Visual world

Use **Arctic technical cartography**, not generic glassmorphism.

The world contains:

- High-key pearl and ice fields.
- Deep navy ink for hierarchy and reading comfort.
- Cobalt as the primary active signal.
- Muted cyan only for secondary energy or depth.
- Hairline routes, contour traces, coordinate ticks, source stamps, and evidence receipts.
- Subtle depth created through overlap, scale, focus, and atmospheric falloff.
- One meaningful translucent material: the evidence lens or inspector.

The world forbids:

- Purple AI gradients.
- Neon cyberpunk clouds.
- Literal brains, neurons, anatomy, or skull imagery.
- Repeated frosted cards.
- Fake terminal windows or fake dashboards.
- Decorative charts with meaningless numbers.
- Gradient text.
- Overuse of pills, badges, eyebrow labels, and tiny uppercase copy.
- Three equal feature columns.
- Every section being a rounded rectangle.

### 6.5 Color system

Derive exact tokens from the current application and logo, then consolidate them. The starting roles are:

- `--brace-ice-0`: primary page field.
- `--brace-ice-1`: quiet depth surface.
- `--brace-ink-950`: primary text and high-contrast structure.
- `--brace-ink-700`: secondary text.
- `--brace-cobalt-600`: active provenance, primary CTA, focus signal.
- `--brace-cobalt-400`: transit pulse and hover accent.
- `--brace-cyan-300`: sparse atmospheric highlight.
- `--brace-line`: neutral topology line.
- `--brace-success`, `--brace-warning`, `--brace-danger`: semantic state only.

All combinations must pass WCAG 2.2 AA. Do not lower text opacity to create hierarchy when a better size, weight, or spacing choice exists.

### 6.6 Typography

Stop using generic Inter marketing composition by default. First test the application's existing Geist Sans and Geist Mono so the site and product feel like one system. If a new display face materially improves the identity, run a documented typography bakeoff against Geist and use at most two font families total.

Rules:

- One display family and one text/technical family maximum; one variable family may serve both.
- Self-host fonts with a license record, a restrained set of axes/weights, `font-display`, preload only the critical face, and metric fallbacks to control layout shift.
- Hero headline: maximum two lines at every intended breakpoint.
- Hero area: maximum four text elements before the primary visual interaction.
- Body copy: roughly 45–75 characters per line.
- Navigation and UI copy must remain readable; do not turn it all into 11 px uppercase metadata.
- Use optical size, weight, leading, and whitespace before adding decorative text effects.
- Visible marketing copy must use direct punctuation and short sentences. Avoid em dashes and AI-copy clichés.

### 6.7 Spatial system

- Use a 12-column desktop grid with an asymmetric atlas field, not a centered card stack.
- Use a disciplined 4/8 px spacing foundation with larger editorial intervals.
- Treat every viewport as a composition. Do not simply stack desktop columns on mobile.
- Keep a persistent visual anchor across sections while varying section geometry.
- Use proximity, alignment, and whitespace before borders or containers.
- Total homepage journey should target 8–12 viewport heights and never exceed 14 without written justification.
- No single marketing section should consume more than roughly 2.25 viewport heights unless it is the one approved story peak.

## 7. Originality fingerprint

Update `website/FINGERPRINTS.md` before final implementation. The new build must differ from every existing fingerprint in at least four of six dimensions.

Proposed fingerprint:

| Dimension | Living Memory Atlas |
|---|---|
| Grammar | Persistent cognitive atlas |
| Navigation | Atlas-edge route and compact contextual controls |
| Hero | Live graph ignition with immediate static meaning |
| Sequence | Fragment, provenance draw, inspect, expand, resolve |
| Close | Atlas condenses into a local seed and platform choice |
| Signature | Provenance Pulse |

Do not dilute this fingerprint during implementation by reintroducing the existing frosted context relay, long horizontal pan reel, or floating white glass bar.

## 8. The signature interaction: Provenance Pulse

Build one bespoke interaction that teaches the core product truth.

### Behavior

When a visitor focuses, clicks, taps, or presses Enter/Space on a source node:

1. The source becomes clearly selected.
2. A cobalt pulse travels along real graph edges from source to memory.
3. The pulse continues only along the explicitly chosen route to an AI endpoint or business context.
4. A compact evidence receipt assembles with source, captured time, relationship, permission scope, and citation state.
5. The user may replay, inspect, or switch the selected source.

### Meaning

The interaction proves: BRACE remembers where context came from and lets the user see what is being carried forward.

### Input and accessibility

- Pointer, touch, keyboard, and switch-friendly controls must reach the same result.
- Provide a semantic list/table representation of the graph and selected route.
- Announce meaningful state changes politely without narrating decorative animation.
- No drag-only action. If nodes can be dragged in a demo, offer equivalent directional controls or a non-drag alternative.
- Targets should be 44 px where practical and never below WCAG 2.2 minimum target requirements without the applicable exception.
- Reduced motion replaces travel with a short state crossfade and preserves the evidence receipt.

### Motion limits

- One pulse at a time.
- The pulse uses transform, opacity, SVG stroke, or shader uniforms without causing layout.
- It must never flash or create a seizure risk.
- It pauses when the document is hidden or the atlas is offscreen.
- It does not continue consuming CPU after completion.

## 9. Hero and opening sequence

### 9.1 Working copy

Use this as a strong starting point, then validate it against actual product capabilities:

**Headline:** `Your work remembers.`

**Supporting line:** `BRACE keeps decisions, sources, and context private, then carries only what you choose into every compatible AI.`

**Primary action:** `Enter your Brain`

**Secondary action:** `Get BRACE`

Keep `One memory. Every AI.` as a supporting brand line elsewhere, not as competing hero copy.

Do not add unsupported security, AI-provider, team, or business claims. Label planned capabilities as planned.

### 9.2 Composition

The atlas occupies the visual center and majority of the first viewport. It should suggest two cerebral hemispheres through topology and negative space, never through literal anatomy.

Desktop:

- A compact brand/navigation layer remains quiet at the perimeter.
- Headline and supporting copy occupy a deliberate editorial block, not half of a two-column SaaS template.
- The atlas crosses the nominal grid and creates the composition's focal depth.
- Evidence receipts and source labels appear only when they help the demonstration.
- Both primary actions are visible without scrolling.

Mobile:

- The hero completes within roughly 100–115 svh, not 1.6–1.8 screens.
- Headline remains at most two lines at the target mobile widths.
- The atlas becomes a simplified vertical topology, not a tiny desktop graph.
- Primary action remains reachable by thumb and does not overlap browser chrome.
- Nonessential labels disappear; the semantic alternative remains available.

### 9.3 Non-blocking cold open

Replace the current full-screen, scroll-locking opening with a hero-local sequence. Final semantic HTML and a meaningful static atlas state must be visible immediately.

Timing target:

- `0–120 ms`: static poster/DOM composition is visible and interactive.
- `120–450 ms`: the local seed brightens and gains depth.
- `350–900 ms`: provenance paths draw toward source nodes.
- `700–1200 ms`: two or three evidence labels resolve.
- `950–1400 ms`: headline, supporting copy, and actions settle into final positions.

Rules:

- Never make the visitor wait for a logo movie.
- Never mark main content inert for the opening.
- Never lock scroll for the opening.
- Never postpone the headline or primary action behind video decode, WebGL startup, font loading, or hydration.
- Add replay only as a quiet labeled control after completion.
- If the user interacts, scrolls, or focuses a control, complete the opening immediately.
- Reduced-motion users receive the resolved composition without spatial travel.
- Repeat visitors may skip the cold-open flourish automatically, but no essential meaning is lost.

### 9.4 Depth and parallax

Use no more than three depth layers:

- Far contour field: roughly 2–4 px response.
- Atlas network: roughly 8–14 px response.
- Evidence lens: roughly 12–16 px response and no more than about 2 degrees of tilt.

Use pointer parallax only for fine pointers and only when the visitor has not requested reduced motion. Use native scroll. Disable or simplify effects on mobile, coarse pointers, data saver, low hardware concurrency, hidden tabs, and sustained frame drops.

## 10. Homepage journey

Use one persistent atlas whose state changes across the story. Do not restart with a new decorative graphic in every section.

### Act 0 — Arrival: the local seed

Purpose: establish identity and trust immediately.

- Run the non-blocking hero sequence.
- Let the visitor trigger Provenance Pulse without scrolling.
- Add a small, plain-language privacy cue linked to the deeper custody section.
- Do not display a tilted app screenshot.

Target length: 1.0–1.2 viewport heights on desktop; no more than 1.15 svh on mobile.

### Act 1 — Fragmented work

Purpose: show the problem with restraint.

- Real synthetic artifacts from the demo workspace appear at the atlas perimeter: a document, meeting note, code change, task, and decision.
- Their relationships are initially unresolved.
- Short copy names the cost of context loss without fearmongering.
- Use reveal and controlled displacement, not a new grid of problem cards.

Target feeling: recognition and slight tension.

### Act 2 — Source becomes trusted memory

Purpose: explain ingestion, provenance, and retrieval.

- A selected source resolves into a memory node.
- Show the source path, metadata, citation, relationship, and scope.
- Use one scroll-linked drawing act. This may be the single scrubbed sequence if testing proves it improves comprehension.
- Provide explicit non-scroll controls to inspect each state.

Target feeling: comprehension.

### Act 3 — The working brain

Purpose: make the graph feel like the product, not decoration.

- Transition into a live product-faithful graph surface using only synthetic Northstar/demo data.
- Allow search, focus, neighborhood expansion, clustering, semantic zoom, and a side inspector at a bounded demonstration level.
- Do not attempt to render thousands of DOM nodes.
- Use level of detail, viewport culling, worker-based layout, deterministic clustering, and progressive expansion where applicable.
- Clearly label any demo-only behavior.

This is the one allowed visual peak. If pinned, it is the only pinned act on the page. Keep it concise and give the user an obvious exit.

Target feeling: agency.

### Act 4 — From personal memory to company intelligence

Purpose: introduce the business-grade vision honestly.

- The same atlas expands from personal context into projects, teams, departments, policies, and executive decisions.
- Show permission boundaries, ownership, review states, and shared versus private memory through topology, not a row of role cards.
- Provide role lenses for employee, manager, executive, and administrator.
- If these capabilities are not shipped, label the section `In development` and link to the roadmap or waitlist. Never fake live availability.

Target feeling: ambition with control.

### Act 5 — Product proof

Purpose: show the actual application clearly.

- Recapture current product surfaces from the synthetic workspace.
- Present them in an editorial sequence with meaningful captions and a keyboard-accessible viewer.
- Do not use a long forced horizontal pan.
- Do not place old screenshots inside fake browser chrome.
- Include the graph, recall, source inspector, company surface if shipped, automations, and settings/privacy only when current.
- Make zoomed details legible at common laptop widths.

Target feeling: confidence.

### Act 6 — Custody and trust

Purpose: prove the local-first and permission model.

- Transform the atlas into a custody map: device, local store, optional provider boundary, exported context, and audit trail.
- Use the one evidence lens material here.
- Explain what leaves the device, when, why, and under whose action.
- Link to precise privacy, provider-data-flow, threat-model, recovery, and release-trust documentation.

Target feeling: relief.

### Act 7 — Begin locally

Purpose: resolve the story into action.

- The atlas condenses into a local seed beside a platform selector.
- Show the latest honest version from one source-of-truth release manifest.
- Display platform requirements, artifact size, checksum/signature status, and installation path without clutter.
- Primary action downloads or starts the correct path. Secondary action opens the beginner's guide.
- Do not use a giant rounded CTA card.

Target feeling: readiness.

## 11. Navigation and page transitions

### Desktop navigation

Design a quiet atlas-edge route rather than another floating pill:

- Brand and essential destinations occupy a slim top or edge frame.
- A minimal progress trace indicates the current story act.
- Labels appear on focus/hover and remain visible enough for discoverability.
- Product, Guide, Trust, and Download remain ordinary links with proper URLs.
- The main CTA does not chase the pointer or constantly pulse.

### Mobile navigation

- Use a compact top bar and accessible menu.
- Avoid sticky surfaces that cover headings, focused controls, or browser UI.
- All anchor targets must account for the sticky header using resilient scroll margins.
- Test deep links, refresh-at-anchor, browser back/forward, and in-page focus.

### Page transitions

- Use the native View Transition API only as progressive enhancement.
- Share the atlas seed or logo geometry between home and guide when supported.
- Keep transitions under roughly 500 ms and interruptible.
- Respect reduced motion and fall back to an immediate navigation.
- Never delay actual navigation for decorative sequencing.

## 12. Beginner's guide overhaul

The guide should feel like BRACE helping the user complete a task, not a second marketing landing page.

### Guide outcome

A new user can install BRACE, choose a workspace safely, import a synthetic/sample source, create or inspect the first memory, retrieve it, understand its provenance, and know where their data lives.

### Guide hero

- Target 60–75 svh on desktop and natural height on mobile.
- Use a short headline of at most two lines.
- Put `Start with your platform` in the first viewport.
- Show the local seed and a simple route, not a huge marketing headline plus launchpad card.
- State estimated time and prerequisites plainly.

### Guide information architecture

1. Choose platform.
2. Download and verify.
3. Install safely.
4. Choose the workspace and understand storage.
5. Add a source.
6. Inspect the first memory and citation.
7. Recall it.
8. Connect an AI provider only if desired.
9. Back up, export, diagnose, and get help.

### Guide interaction model

- A persistent step spine shows current, completed, optional, and blocked steps.
- A contextual screenshot or short motion clip changes with the active step.
- Every clip has a still fallback and textual instructions.
- Platform selection changes only relevant commands and notes, not the whole document.
- Commands have accessible copy buttons and a visible copied state.
- Completion state stays local and has a clear reset.
- A searchable `I'm stuck` troubleshooter routes symptoms to tested remedies.
- The glossary defines workspace, source, memory, index, semantic retrieval, lexical retrieval, provider, and provenance.
- Advanced material is disclosed progressively and remains reachable by URL.

### Guide visual rules

- Use open editorial layouts, hairline routes, and proximity.
- No enormous four-line headline.
- No route grid of equal cards.
- No nested-card setup wizard.
- Screenshots must be current, legible, and annotated sparingly.
- Sticky navigation must never obscure focused content or the active heading.
- Mobile may use a restrained bottom `Previous / Next` control only if it passes focus-obscuring and safe-area tests.

## 13. Screenshot and product-proof pipeline

The current website contains screenshots that predate recent application UI changes. Replace the manual, stale-asset workflow with a reproducible pipeline.

### Required manifest

Every generated screenshot must record:

- Application commit SHA.
- Application version.
- Website commit SHA when bundled.
- Generation timestamp in UTC.
- Synthetic workspace fixture identifier.
- Route and UI state.
- Viewport and device scale factor.
- Image dimensions, format, and content hash.
- Theme and reduced-motion setting.

### Required behavior

- Add or update `npm run website:screenshots` to boot an isolated synthetic workspace and capture deterministic states.
- Mask volatile values or seed them deterministically.
- Capture from a packaged or production-equivalent build where possible.
- Generate responsive AVIF/WebP derivatives and retain PNG only where lossless zoom inspection is useful.
- Store website assets under the appropriate versioned asset directory, never in runtime data directories.
- CI fails if a referenced screenshot is missing, lacks metadata, differs unexpectedly from its approved baseline, or is older than a product UI change affecting that route.
- Add a single release manifest that supplies website version, application version, downloads, checksums, release date, and schema metadata. Remove contradictory hard-coded versions.

## 14. Front-end architecture

Prefer a static-first architecture with narrowly hydrated islands. If the current static implementation can meet all goals cleanly, it may be evolved in place. If migration is justified, use this target shape:

```text
website/
  site/
    src/
      layouts/
      pages/
      components/
      islands/
        MemoryAtlas.tsx
        ProvenancePulse.tsx
        ProductProofViewer.tsx
        PlatformPicker.tsx
        GuideProgress.tsx
        Troubleshooter.tsx
      styles/
      content/
      data/
    public/
  scripts/
  builds/brace/        # generated deployment output, not the primary hand-edited source
  BRIEF.md
  FINGERPRINTS.md
  INTERACTION_CONTRACT.md
  RESEARCH_MANIFEST.md
  PERFORMANCE_BUDGETS.json
```

Architecture rules:

- The critical headline, lede, actions, navigation, and static atlas fallback ship as HTML/CSS.
- Hydrate the atlas and controls on idle/visible based on actual priority. Do not hydrate the primary CTA late.
- One motion runtime owns component animation.
- Centralize motion tokens, easing, durations, reduced-motion behavior, and capability decisions.
- Use CSS custom properties for design tokens.
- Avoid global state for local visual effects.
- Do layout and clustering work off the main thread when dataset size requires it.
- Do not create one React component per decorative node if Canvas/SVG grouping is more appropriate.
- Pause animation and observers when offscreen or hidden.
- Clean up observers, timers, media, WebGL resources, and event handlers on unmount.
- Do not hand-edit generated build output without also updating its source and generation path.

## 15. Motion system

### 15.1 Motion grammar

Name the grammar **Trace, Resolve, Settle**.

- **Trace:** a source or route becomes visible through line, clip, or focus.
- **Resolve:** metadata and meaning become readable.
- **Settle:** elements reach a stable, calm resting state.

Every animation must serve one of these verbs. If it does not, remove it.

### 15.2 Device budget

Use at least four motion device families across the entire homepage, without repeating the same device in consecutive acts:

1. SVG/path drawing for provenance.
2. Reveal through clip/focus for source artifacts.
3. Flow-and-settle for evidence labels and product proof.
4. Restrained parallax for spatial hierarchy.
5. Optional metric count-up only for real, stable values.

Limits:

- One story peak.
- One pinned act maximum.
- Two scrubbed acts maximum; target one.
- No dead scrolling.
- No section may exist only to show an effect.
- No continuous ambient animation that competes with reading.

### 15.3 Performance-safe properties

Prefer:

- `transform`
- `opacity`
- `clip-path` after profiling
- SVG stroke properties after profiling
- shader uniforms in the optional WebGL path

Avoid animating:

- width or height
- top, left, right, or bottom
- large blur/filter regions
- box shadows across large surfaces
- layout-affecting properties
- `transition: all`

### 15.4 Reduced motion

Reduced motion is a designed mode, not a disabled-site mode.

- Configure the motion provider to respect the user's preference.
- Remove large transforms, autoplay, parallax, travel, and scrubbing.
- Preserve state, sequence, hierarchy, and all content through instant changes or short crossfades.
- Make every manual interaction usable in the reduced state.
- Test the system preference before hydration to avoid a flash of the animated state.

## 16. Graph engineering and large-data UX

The website demo and application graph must share a coherent interaction model, but the website must not import private application data.

### Rendering and scale

- Benchmark SVG, Canvas, and WebGL against representative synthetic graphs at 100, 1,000, 10,000, and the agreed stress target.
- Use viewport culling and level of detail.
- Collapse distant nodes into stable semantic clusters.
- Expand neighborhoods on demand.
- Move force/layout calculations to a worker where appropriate.
- Cache stable positions and avoid full layout recomputation for small updates.
- Keep labels sparse and collision-aware.
- Make selection, focus, and route state deterministic.
- Preserve camera state across inspector changes unless the user requests recentering.

### User experience

- The graph is always recoverable with `Fit`, `Back`, `Home`, and `Reset view` actions.
- Full screen uses the Fullscreen API where supported and a robust in-page fallback everywhere else.
- Escape exits full screen, menus, and transient inspectors in the expected order.
- Keyboard users can move among visible nodes, inspect a node, follow a relationship, and return.
- Search can focus a node without losing the prior camera state.
- Filters show active state and result count; clearing filters is obvious.
- A minimap appears only when it materially aids orientation.
- Empty, loading, error, no-results, disconnected, and very-large-graph states are designed.
- Provide a semantic non-visual representation with equivalent facts and navigation.

### Truthfulness

- Distinguish lexical matches, semantic matches, explicit links, inferred relationships, and automation-generated links visually and in accessible text.
- Never imply certainty for inferred relationships.
- Show source evidence and timestamps for business-critical graph claims.

## 17. Accessibility release standard

Target WCAG 2.2 AA across home, guide, downloads, dialogs, menus, product proof, and graph alternatives.

Required checks:

- Logical headings and landmarks.
- Descriptive page titles, metadata, and link names.
- Complete keyboard operation with visible focus.
- Focus is never hidden under sticky navigation, modals, cookie surfaces, or mobile controls.
- Dialog focus trapping and restoration.
- Skip link to main content.
- 200% zoom and 320 CSS px reflow without two-dimensional scrolling except genuine graph/media canvases with an equivalent alternative.
- Target size, spacing, and drag alternatives.
- Contrast in default, hover, focus, selected, disabled, and high-contrast modes.
- Screen-reader labeling and live-region restraint.
- Captions/transcripts for any meaningful video.
- Reduced motion and pause controls.
- No information conveyed only through color, motion, sound, position, or hover.
- Touch and coarse-pointer testing on real or emulated mobile environments.

## 18. Performance budgets

Measure cold-cache production builds, not only warm local runs. Use at least three runs per target profile and report the median plus the worst result.

### User-centric targets

At the 75th percentile where field data exists:

- LCP: `≤ 2.5 s`
- INP: `≤ 200 ms`
- CLS: `≤ 0.10`

### Lab guardrails

- Initial compressed HTML: target `≤ 35 KB` per page.
- Critical compressed CSS: target `≤ 20 KB`.
- Initial compressed JavaScript needed for the first viewport: target `≤ 75 KB`.
- No hero video required for LCP.
- LCP asset is discoverable in initial HTML, not lazy-loaded, and receives appropriate priority.
- No third-party script in the critical path without written justification.
- No individual main-thread task above `100 ms` during normal interaction; investigate any task over `50 ms`.
- Keep sustained animation near the device refresh rate on the reference hardware, with no recurring jank during scroll.
- Stop decorative work when hidden or offscreen.
- Use responsive image sizing and modern formats.
- Lazy-load below-fold media and noncritical islands.
- Avoid loading both desktop and mobile hero media.
- Preload only genuinely critical fonts and images.
- Track GPU memory/context loss if WebGL ships.

If a richer implementation misses a budget, simplify the effect before relaxing the budget. Any exception needs measured evidence, user impact, fallback behavior, and an owner.

## 19. SEO, trust, and production delivery

- Server-render or statically emit complete metadata and essential content.
- Provide canonical URLs, sitemap, robots policy, Open Graph/Twitter images, structured data, and correct locale metadata.
- Generate OG images from the current design system and release manifest.
- Use one source of truth for version and download metadata.
- Publish checksums and signature state accurately.
- Apply a restrictive CSP compatible with the selected implementation.
- Do not add third-party trackers by default. If analytics are required, use a privacy-respecting, consent-aware implementation with a documented data inventory.
- Fingerprint immutable assets and cache them long-term; revalidate HTML and release metadata appropriately.
- Add a useful offline/error fallback only if the service worker lifecycle is tested and cannot strand users on stale releases.
- Validate all external links and downloads in CI.
- Test social cards and structured data before release.

## 20. Visual and interaction verification

Automated layout checks are necessary but insufficient. A page can have no overflow and still be badly composed.

### Required viewport matrix

Capture and review at minimum:

- 1920 × 1080
- 1440 × 900
- 1280 × 800
- 1024 × 768
- 768 × 1024
- 430 × 932
- 390 × 844
- 360 × 800

### Required mode matrix

- Default motion.
- Reduced motion.
- Forced colors/high contrast.
- 200% zoom.
- Save-Data or equivalent constrained media mode.
- WebGL disabled.
- Keyboard only.
- Slow network and four-times CPU slowdown.

### Story contact sheets

For every scroll-led act, capture at least six evenly distributed states and build a contact sheet. Review for:

- Frozen clipping.
- Elements arriving before their meaning.
- Empty/dead scroll.
- Competing focal points.
- Illegible text or product detail.
- Abrupt state jumps.
- Sticky collisions.
- Unclear progress or exit.
- Mobile compositions that are merely collapsed desktop layouts.

### Human design tests

Run and document:

- **Five-second test:** what is BRACE, why is it different, and what should I do?
- **Squint test:** is there one clear focal hierarchy?
- **Cold-read test:** can someone understand the page without narration?
- **Tell-someone test:** can they repeat the product in one sentence?
- **Reduced-motion equivalence test:** is the complete story still understandable?
- **Low-end test:** does the site remain calm and usable when rich motion is removed?

## 21. Anti-slop acceptance rules

Reject the build if any of the following are true:

- The hero could plausibly belong to another AI startup after changing the logo.
- The page structure is a hero followed by logo strip, three cards, alternating screenshot rows, testimonial cards, pricing cards, and a gradient CTA.
- The main visual is a neural blob, orb, grid tunnel, aurora, or decorative particle field.
- The graph is hidden after the hero or treated as a background texture.
- More than one section uses the same device and composition.
- Glass is used everywhere instead of for the evidence lens.
- Copy uses unsupported superlatives, vague transformation claims, or repetitive `AI-powered` language.
- The opening blocks input or delays meaning.
- The site requires a fine pointer, high-end GPU, or motion tolerance.
- Screenshots are stale or too small to verify.
- Mobile is materially longer or more repetitive because desktop elements were stacked.
- Motion exists without a semantic role.
- The implementation depends on a copied component's default appearance.
- The guide feels like marketing instead of help.

## 22. Website implementation phases

Complete phases in order. After each phase, run focused tests and show evidence before proceeding.

### W0 — Audit and brief

Deliver:

- Baseline audit with measured failures.
- Eight-question brief.
- Updated interaction inventory.
- Research and license manifest.
- Updated originality fingerprint.
- Content truth table mapping every claim to a shipped capability or roadmap label.

Exit gate: the design problem and product truth are unambiguous.

### W1 — Foundations

Deliver:

- Source/build architecture decision.
- Consolidated design tokens.
- Typography bakeoff and final font pipeline.
- Responsive grid and spacing system.
- Motion tokens and capability tiers.
- Semantic page skeletons with no rich motion.

Exit gate: both pages are useful, readable, responsive, and accessible without JavaScript.

### W2 — Hero prototypes and selection

Deliver:

- SVG, Canvas, and optional WebGL prototypes.
- Desktop/mobile/reduced-motion comparison captures.
- Bundle, CPU, frame, memory, and startup measurements.
- Written selection and rejected-alternative rationale.

Exit gate: one approach passes design and performance thresholds.

### W3 — Hero and Provenance Pulse

Deliver:

- Final immediate-render hero.
- Non-blocking cold open.
- Accessible atlas alternative.
- Provenance Pulse across all inputs.
- Responsive and reduced-motion modes.

Exit gate: the five-second test passes and the first viewport meets its budgets.

### W4 — Homepage story

Deliver:

- All eight acts with one persistent atlas.
- One peak and bounded scroll choreography.
- Product-faithful synthetic content.
- Honest business vision.
- Final custody and download resolution.

Exit gate: journey is 8–12 viewport heights where practical, no dead scroll, no repeated layout family, and all controls remain reachable.

### W5 — Beginner's guide

Deliver:

- Task-first guide architecture.
- Platform-aware installation.
- Local progress, contextual screenshots, copy controls, glossary, and troubleshooter.
- Deep-link, focus, sticky-header, mobile, and print-friendly behavior.

Exit gate: a new user can complete the first-memory journey from a clean environment.

### W6 — Product proof and asset pipeline

Deliver:

- Fresh screenshots from the current application.
- Screenshot manifest and deterministic capture command.
- Responsive derivatives and accessible viewer.
- CI freshness and visual-diff gates.

Exit gate: no marketing asset can silently fall behind a product UI change.

### W7 — Production hardening

Deliver:

- WCAG audit and fixes.
- Cold-cache performance runs and fixes.
- CSP, metadata, structured data, caching, link, and download validation.
- Cross-browser and low-capability fallbacks.
- Privacy/secret scan.

Exit gate: every requirement in Sections 17–20 passes or has an explicitly approved exception.

### W8 — Release candidate

Deliver:

- Production build.
- Deployment preview.
- Visual contact sheets.
- Before/after metrics.
- Known limitations.
- Rollback plan.
- Owner sign-off.

Exit gate: approval to publish. Do not deploy to production without the authority requested by the product owner.

---

# BUSINESS-GRADE APPLICATION PROGRAM

Begin this program only after the website release candidate passes. Preserve and regression-test all existing personal memory, graph, library, recall, connector, automation, skill, settings, onboarding, recovery, and import behavior that is actually present in the repository.

## 23. Business product model

Extend BRACE through three explicit scopes:

1. **Personal:** private memory owned by one person.
2. **Team:** deliberately shared memory for a bounded team or project.
3. **Organization:** governed knowledge, policies, directories, decisions, and integrations.

A memory never changes scope silently. Promotion from personal to team or organization requires a preview of content, provenance, attachments, recipients, retention policy, and resulting permissions.

Use a local-first hybrid architecture:

- Personal data remains local by default.
- Organization services are optional, explicit, and separable from personal memory.
- The control plane may manage identity, policy, membership, licensing, and encrypted synchronization without becoming an unrestricted copy of all personal knowledge.
- Self-hosted and managed deployment boundaries must be documented if both are offered.
- Offline behavior, merge behavior, conflict handling, revocation, and deletion semantics must be designed before sync is called production-ready.

## 24. Role-specific experiences

### Employee workspace

- Personal and assigned work memory.
- Project context, tasks, decisions, meetings, documents, and people.
- Safe capture from approved sources.
- Ask/recall with citations and permission-aware retrieval.
- Clear private/team/organization scope at capture and share time.
- Drafting and workflow assistance with review before external action.
- Personal learning and onboarding path without surveillance scoring.

### Manager workspace

- Team projects, blockers, decisions, responsibilities, and operating rhythm.
- Meeting and decision follow-through.
- Permission-safe team recall.
- Delegation and automation approvals.
- Workload and risk signals based on declared work data, never covert activity monitoring.
- Missing-context and stale-decision indicators with provenance.

### Executive workspace

- Strategic themes, goals, initiatives, risks, decisions, and dependencies.
- Traceable roll-ups from source evidence.
- What changed since the last review.
- Decision history, assumptions, confidence, owners, and follow-up state.
- Board/leadership brief generation with citations and human approval.
- No opaque employee rankings or fabricated certainty.

### Administrator workspace

- Organization, workspaces, teams, roles, groups, policies, connectors, retention, and audit controls.
- Data-flow views showing where information resides and what providers receive.
- Connector health and scoped reauthorization.
- Export, recovery, legal/retention workflows, and incident diagnostics.
- License and deployment management.

## 25. Essential business capabilities

### Identity and organizations

- Organizations, workspaces, teams, groups, invitations, lifecycle states, and verified domains.
- RBAC initially; design a path to attribute/policy-based controls where necessary.
- Owner, administrator, security administrator, member, guest, and service identities with least-privilege defaults.
- SSO/SAML/OIDC and SCIM only after local account recovery and break-glass flows are defined.
- Session, device, token, and deprovisioning controls.

### Shared knowledge and graph

- Team and organization memory spaces with explicit ownership.
- Permission-aware graph traversal and search at every layer, including caches, suggestions, summaries, and exports.
- Source lineage, relationship type, confidence, created-by, modified-by, review status, retention, and access scope.
- Decision records, project hubs, people and team directories, goals/OKRs, policies, meeting memory, and reusable knowledge packs.
- Duplicate detection, merge preview, conflict resolution, stale-content review, and canonical-source designation.
- Large-graph performance work described in Section 16.

### Enterprise retrieval and AI

- Hybrid lexical/vector retrieval only when embeddings are genuinely present.
- Reranking, citations, permission filters, freshness, source type, project, owner, and date filters.
- Model/provider routing by policy and task.
- Prompt/context preview before sending to a provider.
- Redaction and sensitive-data policy hooks.
- Citation completeness and unsupported-claim warnings.
- Evaluation suites for retrieval quality, answer groundedness, leakage, refusal, and regression.
- Human review for high-impact output and external actions.

### Connectors

- A connector framework with scoped credentials, incremental sync, webhooks/polling, backoff, rate limits, health, provenance, and revocation.
- Initial business connectors should be selected from evidence, likely documents, cloud drives, calendars, email, chat, issue tracking, source control, and meeting systems.
- Imported content is indexed, not rewritten.
- Every connector states exactly what it reads, writes, stores, and sends.
- Connector failures never corrupt unrelated memory.

### Automations and approvals

- Trigger, condition, action, scope, owner, status, schedule, and run history.
- Dry run, preview, approval, retry, idempotency, cancellation, and rollback where possible.
- Separate read automations from write/external-action automations.
- Organization policies can prohibit actions or require approvers.
- Tamper-evident run records for business-critical automation.
- No automation may silently widen the data boundary.

### Governance, audit, and compliance readiness

- Immutable or tamper-evident audit events for identity, policy, sharing, connector, export, deletion, recovery, and privileged actions.
- Retention policies and legal hold only after deletion semantics are explicit and tested.
- Classification labels, sensitivity policy, and external-sharing controls.
- Data inventory, subprocessor/provider inventory, threat model, incident response, backup/restore, disaster recovery, and vulnerability management.
- Encryption in transit and at rest with a documented key model.
- Admin audit export and least-privilege access to diagnostics.
- Compliance claims only after independent evidence exists. Never market `SOC 2 ready` as certification.

### Reporting without surveillance

- Adoption, connector health, memory freshness, coverage, unresolved decisions, and workflow outcomes.
- Aggregate organization signals with minimum cohort/privacy safeguards.
- No keystroke monitoring, hidden time tracking, emotion inference, individual productivity scores, or covert content inspection.
- Every metric defines its source, purpose, audience, retention, and opt-out/policy basis.

### Platform operations

- Versioned migrations and rollback/recovery tests.
- Structured logging with redaction.
- Metrics, traces, crash reporting, health checks, and support bundles that exclude private content by default.
- Feature flags with safe defaults and kill switches.
- Backups with restore drills and integrity verification.
- Load, soak, concurrency, large-workspace, and failure-injection testing.
- Signed updates, artifact verification, staged rollout, and rollback.
- Billing/licensing boundaries that never lock access to a user's own export.

## 26. Production architecture gates

Before implementing organization sync or remote services, write architecture decision records for:

- Personal, team, and organization data boundaries.
- Identity and authorization model.
- Key management and encryption.
- Sync topology and conflict resolution.
- Permission-aware indexing and retrieval.
- Audit log integrity and retention.
- Connector credential storage.
- Managed versus self-hosted deployment.
- Tenant isolation and regional/data-residency strategy if a managed service exists.
- Backup, restore, export, deletion, and account/organization closure.

No multi-tenant production service ships before tenant-isolation tests, authorization fuzzing, backup/restore drills, data deletion tests, and an external security review appropriate to the risk.

## 27. Business program phases

### B0 — Preserve and measure

- Inventory every current feature and public seam.
- Establish product, privacy, retrieval-quality, graph-scale, and reliability baselines.
- Convert existing critical flows into regression tests.

### B1 — Organization foundation

- Organizations, workspaces, membership, roles, groups, scope model, and audit events.
- Personal mode remains fully functional without organization enrollment.

### B2 — Permission-aware shared graph

- Shared memory spaces, team graph, source lineage, permission filtering, invitations, sharing previews, and revocation.
- Large-graph rendering and retrieval targets pass.

### B3 — Role workspaces

- Employee, manager, executive, and administrator lenses over the same permissioned data model.
- Avoid four disconnected dashboard products.

### B4 — Connectors and workflows

- Production connector framework, initial approved connectors, automation approval system, and run/audit history.

### B5 — Enterprise retrieval and evaluation

- Hybrid retrieval, provider policy, grounded answers, evaluation harness, leakage tests, and administrative controls.

### B6 — Governance and operations

- Retention, classification, export, recovery, incident operations, observability, signed update, backup, and staged-release systems.

### B7 — Production qualification

- Security review, privacy review, accessibility audit, performance/load testing, failure recovery, migration drills, documentation, support readiness, and release candidate.

Do not bundle all phases into a single unreviewable rewrite. Each phase must preserve a runnable, testable application and include migration and rollback considerations.

## 28. Tests required for the business program

At minimum, automate:

- Cross-tenant and cross-workspace authorization denial.
- Private memory never appearing in team/org search, suggestions, graph neighbors, summaries, exports, analytics, logs, or model context.
- Role changes and immediate revocation.
- Connector scope, credential rotation, throttling, outage, partial sync, duplicate event, and deletion behavior.
- Automation preview, approval, idempotency, retry, cancellation, and policy denial.
- Large graph and large file-count benchmarks.
- Migration forward/backward compatibility and failed-migration recovery.
- Backup integrity and end-to-end restore.
- Export completeness and account/org deletion.
- Offline edits and sync conflicts.
- Provider-context preview and redaction.
- Retrieval relevance, citation correctness, unsupported claims, and no-vector lexical labeling.
- Accessibility of every role-critical path.
- Electron IPC validation, CSP, navigation blocking, and renderer isolation.
- Secret, personal-data, home-path, generated-database, and dependency vulnerability scanning.

## 29. Global definition of done

The work is not complete until all applicable statements are true:

- The final hero is unmistakably BRACE and demonstrates provenance immediately.
- The opening is immediate, non-blocking, interruptible, and reduced-motion-safe.
- The graph remains the central narrative object through the homepage.
- The homepage has one motion grammar, one signature interaction, one peak, and no dead scroll.
- The guide gets a user to a successful first memory with current screenshots and tested instructions.
- No stale product screenshot or conflicting version remains.
- Home and guide meet the accessibility, responsive, performance, metadata, security, and privacy gates.
- The site remains fully meaningful without WebGL and comprehensible without rich motion.
- Component sources and assets have recorded licenses and provenance.
- All existing verified BRACE product capabilities remain working.
- Business data scopes and permissions are enforced at storage, graph, search, AI context, export, analytics, and audit boundaries.
- Organization features do not weaken personal local-first use.
- Recovery, migration, deletion, and rollback have been tested.
- `npm run verify`, privacy scans, secret scans, focused website tests, and production audits pass.
- The final report contains measurements, screenshots, test output, known limitations, and exact paths to deliverables.

## 30. Required final handoff format

Lead with the outcome. Include:

1. What changed, grouped by visitor experience, guide, architecture, and production readiness.
2. Before/after screenshots at representative desktop and mobile viewports.
3. Before/after performance and accessibility measurements.
4. Graph scale test results.
5. Source/license manifest summary.
6. Fresh screenshot manifest and application commit SHA.
7. Exact verification commands and their results.
8. Known limitations and consciously deferred work.
9. Release/rollback instructions.
10. A statement distinguishing shipped business capabilities from roadmap capabilities.

Never report `production-ready`, `enterprise-ready`, `accessible`, `fast`, or `secure` without the corresponding evidence.

---

## Research foundation for the implementing team

Use primary sources and current official documentation during implementation. Re-check versions at that time.

- 21st.dev component ecosystem: <https://21st.dev/>
- 21st.dev animated hero research: <https://21st.dev/community/components/s/animated-hero>
- 21st.dev shader research: <https://21st.dev/community/components/s/shader>
- Recent design gallery: <https://recent.design/>
- Motion for React: <https://motion.dev/docs/react>
- Motion scroll values: <https://motion.dev/docs/react-use-scroll>
- Motion layout animations: <https://motion.dev/docs/react-layout-animations>
- Motion bundle reduction: <https://motion.dev/docs/react-reduce-bundle-size>
- Motion accessibility: <https://motion.dev/docs/react-accessibility>
- Native View Transition API: <https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API>
- CSS scroll-driven animations: <https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations>
- Astro islands: <https://v6.docs.astro.build/en/concepts/islands/>
- Astro React integration: <https://docs.astro.build/en/guides/integrations-guide/react/>
- Core Web Vitals thresholds: <https://web.dev/articles/defining-core-web-vitals-thresholds>
- LCP optimization: <https://web.dev/articles/optimize-lcp>
- Lazy-loading video: <https://web.dev/articles/lazy-loading-video>
- Font best practices: <https://web.dev/articles/font-best-practices>
- WCAG 2.2: <https://www.w3.org/TR/WCAG22/>
- Animation from interactions: <https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html>
- Focus not obscured: <https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum>
- Reflow: <https://www.w3.org/WAI/WCAG22/Understanding/reflow>
- React Three Fiber: <https://github.com/pmndrs/react-three-fiber>
- Three.js cleanup: <https://threejs.org/manual/en/cleanup.html>
- Motion source: <https://github.com/motiondivision/motion>
- Motion Primitives source: <https://github.com/ibelick/motion-primitives>
- shadcn/ui source: <https://github.com/shadcn-ui/ui>
- 21st.dev source organization: <https://github.com/21st-dev>
