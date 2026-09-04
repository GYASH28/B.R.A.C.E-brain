#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const home = read("index.html");
const guide = read("guide/index.html");
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
}

assert.equal((home.match(/<meta property="og:image"/g) || []).length, 1, "home must expose one canonical OG image");
assert.match(home, /app-overview\.png" width="1440" height="960" loading="lazy" decoding="async"/);
assert.match(home, /film-poster" fetchpriority="high" decoding="async"/);
assert.doesNotMatch(home, /experience-v(?:3|4|5|6)[^"']*\.css/, "legacy experience layers must not return to the live page");
assert.doesNotMatch(guide, /experience-v(?:3|4|5|6)[^"']*\.css/, "legacy experience layers must not return to the guide");
assert.equal(manifest.short_name, "BRACE");
assert.equal(manifest.start_url, "/");
assert.match(read("robots.txt"), /Sitemap: https:\/\/b-r-a-c-e-brain\.vercel\.app\/sitemap\.xml/);
assert.match(read("sitemap.xml"), /https:\/\/b-r-a-c-e-brain\.vercel\.app\/guide\//);

console.log("BRACE website production contract passed.");
