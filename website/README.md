# BRACE website

The public website is deliberately separated into a production surface, a reproducible opening film, and experiments.

| Path | Purpose | Deployment status |
| --- | --- | --- |
| `builds/brace/` | Static launch site, beginner guide, downloads, assets, and browser audits | Production; Vercel project root and GitHub Pages source |
| `remotion-opening/` | Remotion source for the opening film used by the launch site | Source only; rendered media is copied into the production build intentionally |
| `lab/` | Visual prototypes and discarded directions | Never deployed implicitly |

## Work on the launch site

```bash
cd website/builds/brace
npm ci
npm run serve
```

In another terminal:

```bash
npm run audit:interactions
npm run audit:layout
npm run audit:focus
npm run audit:a11y
```

The opening is a 7-second Remotion composition rendered in landscape and
portrait, then encoded with dense H.264 keyframes for low-latency scroll
seeking. Rebuild the visual source with:

```bash
cd website/remotion-opening
npm ci
npm run render
npm run poster
```

`npm run render` includes the dense-keyframe scrub encode. The production page
loads those outputs through `data-sc-src`, so reduced-motion visitors keep the
poster and do not download either film.

The site is static by design. Keep asset paths relative, keep download URLs pinned to a real release, and do not introduce a runtime network dependency for the core experience. The synthetic Northstar workspace is the only approved source for product examples and screenshots. The sideways product reel is intentional product evidence and must remain reachable with native horizontal scrolling under reduced motion.

Before changing motion or interaction behavior, read [the interaction contract](INTERACTION_CONTRACT.md). The deployment workflow in `.github/workflows/pages.yml` runs both browser audits before publishing.
