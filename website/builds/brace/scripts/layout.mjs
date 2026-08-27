#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const base = process.env.BRACE_SITE_URL || "http://127.0.0.1:4517";
const browser = await chromium.launch({
  executablePath: process.env.SCROLLCRAFT_CHROME || "/usr/bin/google-chrome",
  headless: true,
});

const mainViewports = [
  [1600, 1000],
  [1440, 900],
  [1280, 800],
  [1080, 800],
  [1024, 768],
  [820, 900],
  [768, 900],
  [430, 932],
  [390, 844],
];
const guideViewports = [
  [1440, 900],
  [1080, 800],
  [1024, 768],
  [820, 900],
  [620, 900],
  [430, 932],
  [390, 844],
];

const targets = [
  ...mainViewports.map(([width, height]) => ({ name: `main-${width}`, path: "/", width, height, kind: "main" })),
  ...guideViewports.map(([width, height]) => ({ name: `guide-${width}`, path: "/guide/", width, height, kind: "guide" })),
];

const report = { generatedAt: new Date().toISOString(), pages: [] };

function intersectionRatio(a, b) {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right <= left || bottom <= top) return 0;
  const area = (right - left) * (bottom - top);
  const smaller = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
  return area / smaller;
}

try {
  for (const target of targets) {
    const page = await browser.newPage({ viewport: { width: target.width, height: target.height }, reducedMotion: "reduce" });
    await page.goto(`${base}${target.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(150);

    const result = await page.evaluate(({ kind, width }) => {
      const rectOf = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || rect.width < 1 || rect.height < 1) return null;
        return { selector, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };

      const selectors = kind === "main"
        ? [
            ".glass-rail",
            ".split-copy--forget",
            ".split-copy--remember",
            ".hero-product-cue",
            ".recall-heading",
            ".recall-workbench",
            ".constellation-heading",
            ".constellation-lab",
            ".download-copy",
            "footer",
          ]
        : [
            ".guide-bar",
            ".guide-hero .guide-wrap",
            ".guide-route",
            ".guide-layout",
            ".guide-step",
            ".guide-shot",
          ];

      if (kind === "main" && width >= 761) selectors.push(".boundary-copy", ".vault-assembly");

      const rects = Object.fromEntries(selectors.map((selector) => [selector, rectOf(selector)]));
      const issues = [];
      const viewportWidth = window.innerWidth;
      const pageOverflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
      if (pageOverflow > 1) issues.push({ type: "page-overflow", pixels: pageOverflow });

      for (const rect of Object.values(rects)) {
        if (!rect) continue;
        if (rect.left < -1.5 || rect.right > viewportWidth + 1.5) {
          issues.push({ type: "out-of-bounds", selector: rect.selector, left: rect.left, right: rect.right, viewportWidth });
        }
      }

      const alignedPairs = kind === "main"
        ? [
            [".recall-heading", ".recall-workbench"],
            [".constellation-heading", ".constellation-lab"],
          ]
        : [
            [".guide-hero .guide-wrap", ".guide-layout"],
          ];
      for (const [leftSelector, rightSelector] of alignedPairs) {
        const a = rects[leftSelector];
        const b = rects[rightSelector];
        if (a && b && Math.abs(a.left - b.left) > 2.5) {
          issues.push({ type: "left-axis-drift", selectors: [leftSelector, rightSelector], delta: Math.abs(a.left - b.left) });
        }
      }

      if (kind === "main" && width >= 761) {
        const copy = rects[".boundary-copy"];
        const vault = rects[".vault-assembly"];
        if (copy && vault) {
          const left = Math.max(copy.left, vault.left);
          const right = Math.min(copy.right, vault.right);
          const top = Math.max(copy.top, vault.top);
          const bottom = Math.min(copy.bottom, vault.bottom);
          if (right > left && bottom > top) {
            const overlap = (right - left) * (bottom - top);
            const smaller = Math.max(1, Math.min(copy.width * copy.height, vault.width * vault.height));
            const ratio = overlap / smaller;
            if (ratio > 0.025) issues.push({ type: "privacy-overlap", ratio });
          }
        }

        const remember = rects[".split-copy--remember"];
        const product = rects[".hero-product-cue"];
        if (remember && product) {
          const left = Math.max(remember.left, product.left);
          const right = Math.min(remember.right, product.right);
          const top = Math.max(remember.top, product.top);
          const bottom = Math.min(remember.bottom, product.bottom);
          if (right > left && bottom > top) {
            const overlap = (right - left) * (bottom - top);
            const smaller = Math.max(1, Math.min(remember.width * remember.height, product.width * product.height));
            const ratio = overlap / smaller;
            if (ratio > 0.035) issues.push({ type: "hero-copy-product-overlap", ratio });
          }
        }
      }

      return { pageOverflow, rects, issues };
    }, { kind: target.kind, width: target.width });

    report.pages.push({ ...target, ...result });
    await page.close();
  }
} finally {
  await browser.close();
}

fs.mkdirSync(path.join(root, "lab"), { recursive: true });
fs.writeFileSync(path.join(root, "lab", "layout.json"), `${JSON.stringify(report, null, 2)}\n`);
const summary = report.pages.map((page) => ({ page: page.name, issues: page.issues.length, overflow: page.pageOverflow, details: page.issues }));
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (report.pages.some((page) => page.issues.length)) process.exitCode = 1;
