# BRACE opening film

This Remotion project renders the cinematic opening used by the BRACE public website. It uses the canonical BRACE logo from `assets/brand/brace-app-icon.svg` (copied into `public/brace-logo.svg` for deterministic rendering) and produces dedicated landscape and portrait H.264 assets.

```bash
npm ci
npm run studio
npm run poster
npm run render
```

Rendered files are written to `website/builds/brace/assets`. Motion is frame-driven through Remotion; the website supplies skip, session, failure, and reduced-motion behavior.
