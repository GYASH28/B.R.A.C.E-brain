#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const origin = "https://b-r-a-c-e-brain.vercel.app";

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Website production patch could not locate ${label}.`);
  return source.replace(search, replacement);
}

function enhanceHead(relativePath, options) {
  const filePath = path.join(root, relativePath);
  let source = fs.readFileSync(filePath, "utf8");
  if (!source.includes('rel="canonical"')) {
    source = replaceRequired(
      source,
      `  <meta property="og:type" content="website">\n`,
      `  <meta property="og:type" content="website">\n` +
        `  <meta property="og:url" content="${options.url}">\n` +
        `  <meta property="og:site_name" content="BRACE">\n` +
        `  <meta property="og:image" content="${origin}/assets/app-overview.png">\n` +
        `  <meta property="og:image:alt" content="BRACE local-first AI memory workspace">\n` +
        `  <meta name="twitter:card" content="summary_large_image">\n` +
        `  <meta name="twitter:title" content="${options.twitterTitle}">\n` +
        `  <meta name="twitter:description" content="${options.twitterDescription}">\n` +
        `  <meta name="twitter:image" content="${origin}/assets/app-overview.png">\n` +
        `  <link rel="canonical" href="${options.url}">\n` +
        `  <link rel="manifest" href="${options.manifest}">\n`,
      `${relativePath} social metadata`,
    );
    // Remove the older relative OG image if present so crawlers get one canonical asset.
    source = source.replace('  <meta property="og:image" content="assets/app-overview.png">\n', "");
  }
  fs.writeFileSync(filePath, source.replace(/\r\n/g, "\n"));
}

enhanceHead("index.html", {
  url: `${origin}/`,
  manifest: "manifest.webmanifest",
  twitterTitle: "BRACE | One memory. Every AI.",
  twitterDescription: "A private, local-first memory layer with source-backed context for compatible AI tools.",
});

enhanceHead("guide/index.html", {
  url: `${origin}/guide/`,
  manifest: "../manifest.webmanifest",
  twitterTitle: "BRACE Beginner Guide",
  twitterDescription: "Install BRACE, build your first local memory, and connect a compatible AI step by step.",
});

// Product proof is below the opening film, so defer its full-resolution images.
let home = fs.readFileSync(path.join(root, "index.html"), "utf8");
home = home.replace(
  /<img src="(assets\/app-(?:overview|recall|automations|graph)\.png)" width="1440" height="960"/g,
  '<img src="$1" width="1440" height="960" loading="lazy" decoding="async"',
);
home = home.replace(
  '<img class="sc-stage__poster film-poster" ',
  '<img class="sc-stage__poster film-poster" fetchpriority="high" decoding="async" ',
);
fs.writeFileSync(path.join(root, "index.html"), home.replace(/\r\n/g, "\n"));

// Guide screenshots are supporting evidence, not LCP content.
const guidePath = path.join(root, "guide/index.html");
let guide = fs.readFileSync(guidePath, "utf8");
guide = guide.replace(
  /<img src="(\.\.\/assets\/app-[^"]+\.png)"/g,
  '<img src="$1" loading="lazy" decoding="async"',
);
fs.writeFileSync(guidePath, guide.replace(/\r\n/g, "\n"));

const manifest = {
  name: "BRACE — One memory. Every AI.",
  short_name: "BRACE",
  description: "Local-first personal AI memory with source-backed context.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#071018",
  theme_color: "#74aaf4",
  icons: [
    { src: "/assets/brace-logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
  ],
};
fs.writeFileSync(path.join(root, "manifest.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
fs.writeFileSync(path.join(root, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc></url>\n  <url><loc>${origin}/guide/</loc></url>\n</urlset>\n`);
