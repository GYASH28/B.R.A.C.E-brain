# Third-party notices

BRACE is licensed under Apache-2.0. Runtime and development dependencies retain their own licenses.

## Bundled runtime dependencies

The packaged desktop includes compiled or bundled portions of these direct dependencies:

| Package | Purpose | Declared license |
| --- | --- | --- |
| Electron | Desktop runtime | MIT |
| electron-log | Desktop diagnostics | MIT |
| Next.js | Static application build | MIT |
| React and React DOM | User interface | MIT |
| Lucide React | Interface icons | ISC |
| Zod | Input schemas | MIT |
| Zustand | Renderer state | MIT |
| Model Context Protocol TypeScript SDK | MCP server and client test support | MIT |
| Sharp | Brand asset rendering during development | Apache-2.0 |

The exact resolved dependency graph and integrity hashes are recorded in `package-lock.json`. Run `npm query ':root > *'` and `npm audit` against a release checkout for current machine-readable details.

## Website motion runtime

The public launch surface uses the BRACE-authored `site.js`, `site.css`, `guide/guide.js`, and `guide/guide.css` files. It vendors Anime.js 3.2.2, licensed under MIT, for the deterministic opening timeline and product-simulation transitions. External reference repositories informed interaction, accessibility, and performance decisions, but no reference application assets, prompts, or runtime code are redistributed.

## Synthetic examples

The Northstar demo workspace and the two example `brace-skill.json` manifests were authored for BRACE and contain no third-party or personal data. They are distributed under the repository's Apache-2.0 license.

## Brand assets and screenshots

The BRACE mark, icons, and screenshots in this repository were created for this project. Screenshots show only the synthetic Northstar profile.

This notice is informational and does not replace the license text shipped by a dependency.
