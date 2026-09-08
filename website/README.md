# BRACE website

The public site is a static, deployable product surface for the BRACE public preview. It explains the local-first memory model, demonstrates a source-backed graph with synthetic data, exposes the Company direction honestly, and guides a new user from installation to their first private recall.

| Path | Purpose | Deployment status |
| --- | --- | --- |
| `builds/brace/` | Living Memory Atlas site, beginner guide, release links, proof assets, and browser audits | Public preview; Vercel project root and GitHub Pages source |
| `remotion-opening/` | Archived source for the retired 0.9 opening film | Source only; not loaded by the live site |
| `lab/` | Visual prototypes and discarded directions | Never deployed implicitly |

## Work on the launch site

```bash
cd website/builds/brace
npm ci
npm run serve
```

In another terminal:

```bash
npm run audit:production
npm run audit:interactions
npm run audit:layout
npm run audit:focus
npm run audit:a11y
npm run audit:performance
npm run audit:visual
```

The current visual grammar is the **Living Memory Atlas**. Its hero is static and useful at first paint; a short CSS ignition adds atmosphere without blocking the headline or controls. The signature **Provenance Pulse** lets a visitor choose a synthetic source and watch its route through local memory to explicitly selected AI context. The graph is the central interactive workspace, not a decorative screenshot.

The site is static by design. Keep asset paths relative, pin download URLs to a real release, and avoid runtime network dependencies for the core experience. `examples/demo-workspace` is the only approved source for product examples and screenshots. The Company section must distinguish working product surfaces from roadmap capabilities.

Product screenshots come from the Electron journey and are copied with:

```bash
npm run website:screenshots
```

That command validates the PNGs and writes `assets/screenshots.manifest.json` with dimensions, hashes, app version, repository revision, route/state labels, and the synthetic-workspace declaration. A personal file, real memory, absolute home path, credential, or runtime database blocks publication.

The maintained runtime surface is intentionally small: `index.html`, `site.css`, `site.js`, `guide/index.html`, `guide/guide.css`, and `guide/guide.js`. Reduced-motion and forced-colors modes are required. The opening must never become a modal gate or scroll lock.

Before changing motion or interaction behavior, read [the interaction contract](INTERACTION_CONTRACT.md). The deployment workflow in `.github/workflows/pages.yml` runs the browser audits before publishing.

Vercel deploys `builds/brace` directly using its checked-in `vercel.json`. GitHub Pages stages only public runtime files and excludes dependencies, environment state, audit output, and source notes. `robots.txt`, `sitemap.xml`, canonical links, social cards, and software schema use the production Vercel origin.
