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
  [1366, 768],
  [1280, 800],
  [1080, 800],
  [1024, 768],
  [920, 900],
  [901, 900],
  [900, 900],
  [820, 900],
  [768, 900],
  [760, 900],
  [430, 932],
  [390, 844],
];
const guideViewports = [
  [1440, 900],
  [1080, 800],
  [1024, 768],
  [900, 900],
  [860, 900],
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

async function waitForSite(page, kind) {
  if (kind === "main") {
    await page.waitForFunction(() => document.documentElement.dataset.braceRuntime === "v5", null, { timeout: 5000 });
  } else {
    await page.waitForFunction(() => document.querySelector(".guide-article"), null, { timeout: 5000 });
  }
  await page.waitForTimeout(100);
}

async function scan(page, target, state = "initial") {
  return page.evaluate(({ kind, width, height, state }) => {
    const rectOf = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width < 1 || rect.height < 1) return null;
      return {
        selector,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        position: style.position,
      };
    };
    const inside = (child, parent, tolerance = 2) => child && parent
      ? child.left >= parent.left - tolerance && child.right <= parent.right + tolerance
      : true;
    const overlapRatio = (a, b) => {
      if (!a || !b) return 0;
      const left = Math.max(a.left, b.left);
      const right = Math.min(a.right, b.right);
      const top = Math.max(a.top, b.top);
      const bottom = Math.min(a.bottom, b.bottom);
      if (right <= left || bottom <= top) return 0;
      const area = (right - left) * (bottom - top);
      const smaller = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
      return area / smaller;
    };

    const selectors = kind === "main"
      ? [
          ".glass-rail",
          ".split-side--forget",
          ".split-side--remember",
          ".split-copy--forget",
          ".split-copy--remember",
          ".hero-product-cue",
          ".recall-heading",
          ".recall-workbench",
          ".constellation-heading",
          ".constellation-lab",
          ".boundary-stage",
          ".boundary-copy",
          ".vault-assembly",
          ".product-stage",
          ".product-rail",
          ".download-stage",
          ".download-copy",
          "footer",
        ]
      : [
          ".guide-bar",
          ".guide-hero .guide-wrap",
          ".guide-route",
          ".guide-layout",
          ".guide-toc",
          ".guide-article",
          ".guide-step",
          ".guide-shot",
        ];

    const rects = Object.fromEntries(selectors.map((selector) => [selector, rectOf(selector)]));
    const issues = [];
    const viewportWidth = innerWidth;
    const viewportHeight = innerHeight;
    const pageOverflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
    if (pageOverflow > 1) issues.push({ type: "page-overflow", state, pixels: pageOverflow });

    const viewportCritical = kind === "main"
      ? [".glass-rail", ".recall-heading", ".recall-workbench", ".constellation-heading", ".constellation-lab", ".boundary-stage", ".product-stage", ".download-stage", ".download-copy", "footer"]
      : [".guide-bar", ".guide-hero .guide-wrap", ".guide-route", ".guide-layout", ".guide-article", ".guide-step", ".guide-shot"];
    for (const selector of viewportCritical) {
      const rect = rects[selector];
      if (!rect) continue;
      if (rect.left < -2 || rect.right > viewportWidth + 2) {
        issues.push({ type: "out-of-bounds", state, selector, left: rect.left, right: rect.right, viewportWidth });
      }
    }

    if (kind === "main") {
      const forgetSide = rects[".split-side--forget"];
      const rememberSide = rects[".split-side--remember"];
      const forgetCopy = rects[".split-copy--forget"];
      const rememberCopy = rects[".split-copy--remember"];
      if (!inside(forgetCopy, forgetSide)) issues.push({ type: "hero-copy-outside-side", state, selector: ".split-copy--forget" });
      if (!inside(rememberCopy, rememberSide)) issues.push({ type: "hero-copy-outside-side", state, selector: ".split-copy--remember" });

      const alignedPairs = [
        [".recall-heading", ".recall-workbench"],
        [".constellation-heading", ".constellation-lab"],
      ];
      for (const [aSelector, bSelector] of alignedPairs) {
        const a = rects[aSelector];
        const b = rects[bSelector];
        if (a && b && Math.abs(a.left - b.left) > 2.5) {
          issues.push({ type: "left-axis-drift", state, selectors: [aSelector, bSelector], delta: Math.abs(a.left - b.left) });
        }
      }

      const privacyOverlap = overlapRatio(rects[".boundary-copy"], rects[".vault-assembly"]);
      if (privacyOverlap > .025) issues.push({ type: "privacy-overlap", state, ratio: privacyOverlap });

      if (width > 900) {
        for (const selector of [".boundary-stage", ".product-stage", ".download-stage"]) {
          const rect = rects[selector];
          if (rect && Math.abs(rect.height - viewportHeight) > 3) {
            issues.push({ type: "pinned-stage-height", state, selector, height: rect.height, viewportHeight });
          }
          if (rect && rect.position !== "sticky") {
            issues.push({ type: "pinned-stage-position", state, selector, position: rect.position });
          }
        }
      } else {
        for (const selector of ["#boundary", "#product", "#download"]) {
          const act = document.querySelector(selector);
          if (act?.dataset.scAct !== "flow") issues.push({ type: "compact-act-not-flow", state, selector, value: act?.dataset.scAct });
        }
        const productRail = document.querySelector(".product-rail");
        if (productRail?.hasAttribute("data-sc-pan")) issues.push({ type: "compact-product-pan-mounted", state });
        for (const selector of [".boundary-stage", ".product-stage", ".download-stage"]) {
          const rect = rects[selector];
          if (rect?.position === "sticky") issues.push({ type: "compact-stage-sticky", state, selector });
        }
        const proofFrames = Array.from(document.querySelectorAll(".proof-frame"));
        proofFrames.forEach((frame, index) => {
          const rect = frame.getBoundingClientRect();
          if (rect.left < -2 || rect.right > viewportWidth + 2) {
            issues.push({ type: "compact-proof-out-of-bounds", state, index, left: rect.left, right: rect.right });
          }
        });
      }

      if (width <= 760) {
        const actions = Array.from(document.querySelectorAll(".glass-rail nav a, .rail-download"));
        actions.forEach((action, index) => {
          const rect = action.getBoundingClientRect();
          if (rect.width < 44 || rect.height < 44) issues.push({ type: "touch-target", state, index, width: rect.width, height: rect.height });
          if (rect.left < -1 || rect.right > viewportWidth + 1) issues.push({ type: "mobile-nav-out-of-bounds", state, index, left: rect.left, right: rect.right });
        });
      }
    } else {
      const hero = rects[".guide-hero .guide-wrap"];
      const layout = rects[".guide-layout"];
      if (hero && layout && Math.abs(hero.left - layout.left) > 2.5) {
        issues.push({ type: "guide-left-axis-drift", state, delta: Math.abs(hero.left - layout.left) });
      }
      const article = rects[".guide-article"];
      const shot = rects[".guide-shot"];
      if (article && shot && (shot.left < article.left - 2 || shot.right > article.right + 2)) {
        issues.push({ type: "guide-media-axis-drift", state, article: [article.left, article.right], media: [shot.left, shot.right] });
      }
      if (width <= 620) {
        const route = document.querySelector(".guide-route");
        if (route && getComputedStyle(route).overflowX !== "auto") issues.push({ type: "guide-mobile-route-not-scrollable", state });
        const toc = document.querySelector(".guide-toc nav");
        if (toc && getComputedStyle(toc).overflowX !== "auto") issues.push({ type: "guide-mobile-toc-not-scrollable", state });
      }
    }

    return { state, pageOverflow, rects, issues };
  }, { kind: target.kind, width: target.width, height: target.height, state });
}

async function scrollToSection(page, selector) {
  await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    if (!target) return;
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const top = Math.min(max, Math.max(0, target.offsetTop + Math.max(0, target.offsetHeight - innerHeight) * .5));
    scrollTo(0, top);
  }, selector);
  await page.waitForTimeout(90);
}

try {
  for (const target of targets) {
    const page = await browser.newPage({ viewport: { width: target.width, height: target.height }, reducedMotion: "reduce" });
    await page.goto(`${base}${target.path}`, { waitUntil: "networkidle" });
    await waitForSite(page, target.kind);

    const scans = [];
    scans.push(await scan(page, target, "initial"));

    if (target.kind === "main") {
      if (target.width > 760) {
        const slider = page.locator("[data-memory-divider]");
        await slider.focus();
        await slider.press("Home");
        await page.waitForTimeout(40);
        scans.push(await scan(page, target, "hero-split-min"));
        await slider.press("End");
        await page.waitForTimeout(40);
        scans.push(await scan(page, target, "hero-split-max"));
      }

      for (const [selector, state] of [
        ["#recall", "recall"],
        ["#constellation", "constellation"],
        ["#boundary", "privacy"],
        ["#product", "product"],
        ["#download", "download"],
      ]) {
        await scrollToSection(page, selector);
        scans.push(await scan(page, target, state));
      }
    } else {
      for (const [selector, state] of [
        ["#first-run", "first-run"],
        ["#recall", "recall"],
        ["#structure", "structure"],
        ["#connect", "connect"],
        ["#privacy", "privacy"],
      ]) {
        await scrollToSection(page, selector);
        scans.push(await scan(page, target, state));
      }
    }

    const issues = scans.flatMap((entry) => entry.issues);
    report.pages.push({ ...target, scans, issues });
    await page.close();
  }
} finally {
  await browser.close();
}

fs.mkdirSync(path.join(root, "lab"), { recursive: true });
fs.writeFileSync(path.join(root, "lab", "layout.json"), `${JSON.stringify(report, null, 2)}\n`);
const summary = report.pages.map((page) => ({
  page: page.name,
  issues: page.issues.length,
  states: page.scans.length,
  details: page.issues,
}));
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (report.pages.some((page) => page.issues.length)) process.exitCode = 1;
