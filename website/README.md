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
npm run audit:a11y
```

The site is static by design. Keep asset paths relative, keep download URLs pinned to a real release, and do not introduce a runtime network dependency for the core experience. The synthetic Northstar workspace is the only approved source for product examples and screenshots.

Before changing motion or interaction behavior, read [the interaction contract](INTERACTION_CONTRACT.md). The deployment workflow in `.github/workflows/pages.yml` runs both browser audits before publishing.
