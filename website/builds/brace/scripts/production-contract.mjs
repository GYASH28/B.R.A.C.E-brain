#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const home = read("index.html");
const guide = read("guide/index.html");
const css = read("site.css");
const js = read("site.js");
const brief = read("BRIEF.md");
const manifest = JSON.parse(read("manifest.webmanifest"));
const origin = "https://b-r-a-c-e-brain.vercel.app";

for (const [name, source, url] of [
  ["home", home, `${origin}/`],
  ["guide", guide, `${origin}/guide/`],
]) {
  assert.match(source, new RegExp(`<link rel="canonical" href="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">`), `${name} needs its canonical URL`);
  assert.match(source, /<meta name="twitter:card" content="summary_large_image">/, `${name} needs Twitter card metadata`);
  assert.match(source, /<meta property="og:image" content="https:\/\/b-r-a-c-e-brain\.vercel\.app\/assets\/app-overview\.png">/, `${name} needs an absolute Open Graph image`);
  assert.match(source, /rel="manifest"/, `${name} needs the web manifest`);
  assert.equal((source.match(/<h1[ >]/g) || []).length, 1, `${name} must have one h1`);
}

assert.equal((home.match(/<meta property="og:image"/g) || []).length, 1, "home must expose one canonical OG image");
assert.match(home, /id="hero-title">Your work<br>remembers\.<\/h1>/, "hero promise must remain static and semantic");
assert.match(home, /data-hero-atlas/, "hero must include the living memory atlas");
assert.match(home, /data-brain-fullscreen/, "graph workspace must expose fullscreen control");
assert.match(home, /data-role="employee"/, "company surface must expose role lenses");
assert.match(home, /app-graph\.png" width="1440" height="960" loading="lazy"/, "current graph proof needs intrinsic dimensions and lazy loading");
assert.doesNotMatch(home, /<video|data-sc-scrub|data-opening/, "critical path must not depend on an opening overlay or scrub film");
assert.doesNotMatch(home, /vendor\/anime/, "homepage must not ship the retired animation runtime");
assert.doesNotMatch(home, /experience-v(?:3|4|5|6)[^"']*\.css/, "legacy experience layers must not return to the live page");
assert.doesNotMatch(guide, /experience-v(?:3|4|5|6)[^"']*\.css/, "legacy experience layers must not return to the guide");
assert.match(css, /prefers-reduced-motion:\s*reduce/, "site needs an explicit reduced-motion mode");
assert.match(css, /forced-colors:\s*active/, "site needs a forced-colors mode");
assert.match(js, /requestFullscreen/, "graph fullscreen behavior must be implemented");
assert.match(brief, /Living Memory Atlas/, "brief must record the approved visual world");
assert.match(brief, /Provenance Pulse/, "brief must record the signature interaction");
assert.equal(manifest.short_name, "BRACE");
assert.equal(manifest.start_url, "/");
assert.match(read("robots.txt"), /Sitemap: https:\/\/b-r-a-c-e-brain\.vercel\.app\/sitemap\.xml/);
assert.match(read("sitemap.xml"), /https:\/\/b-r-a-c-e-brain\.vercel\.app\/guide\//);

console.log("BRACE website production contract passed.");
