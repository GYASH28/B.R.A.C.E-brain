#!/usr/bin/env node

import { chromium } from "playwright-core";

const base = process.env.BRACE_SITE_URL || "http://127.0.0.1:4517";
const browser = await chromium.launch({
  executablePath: process.env.SCROLLCRAFT_CHROME || "/usr/bin/google-chrome",
  headless: true,
});

const viewports = [
  [1600, 1000],
  [1440, 900],
  [1366, 768],
  [1080, 720],
  [920, 720],
  [901, 720],
  [900, 900],
  [760, 900],
  [430, 932],
  [390, 844],
  [390, 700],
];

const results = [];

function overlapRatio(a, b) {
  if (!a || !b) return 0;
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right <= left || bottom <= top) return 0;
  const area = (right - left) * (bottom - top);
  const smaller = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
  return area / smaller;
}

async function measure(page, selector) {
  return page.locator(selector).evaluate((node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      display: style.display,
      position: style.position,
      visibility: style.visibility,
    };
  });
}

async function assertState(page, width, height, state) {
  const issues = [];
  const viewport = { width, height };
  const hero = await measure(page, ".split-stage");
  const forget = await measure(page, ".split-side--forget");
  const remember = await measure(page, ".split-side--remember");
  const forgetCopy = await measure(page, ".split-copy--forget");
  const rememberCopy = await measure(page, ".split-copy--remember");
  const product = await measure(page, ".hero-product-cue");
  const rail = await measure(page, ".glass-rail");
  const recovery = await measure(page, ".recovery-console");

  const inside = (child, parent, tolerance = 2) =>
    child.left >= parent.left - tolerance && child.right <= parent.right + tolerance
    && child.top >= parent.top - tolerance && child.bottom <= parent.bottom + tolerance;

  if (!inside(forgetCopy, forget)) issues.push("forget copy escaped its hero side");
  if (!inside(rememberCopy, remember)) issues.push("remember copy escaped its hero side");
  if (product.display !== "none" && !inside(product, remember, 3)) issues.push("hero product escaped remembered side");

  if (width > 760 && product.display !== "none") {
    const overlap = overlapRatio(rememberCopy, product);
    if (overlap > .045) issues.push(`remember copy/product overlap ${overlap.toFixed(3)}`);
  }

  if (width <= 760) {
    if (Math.abs(forget.width - viewport.width) > 3 || Math.abs(remember.width - viewport.width) > 3) {
      issues.push("phone hero sides are not full-width stacked rows");
    }
    if (product.display !== "none" && overlapRatio(product, rail) > 0) issues.push("hero product sits under mobile navigation");
    if (overlapRatio(recovery, rail) > 0) issues.push("recovery control sits under mobile navigation");
  }

  const pageOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
  if (pageOverflow > 1) issues.push(`page overflow ${pageOverflow}px`);

  return { state, issues, hero, forget, remember, forgetCopy, rememberCopy, product, rail };
}

async function assertDownload(page, width) {
  await page.evaluate(() => document.querySelector("#download")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(120);

  const issues = [];
  const stage = await measure(page, ".download-stage");
  const memory = await measure(page, ".download-memory");
  const copy = await measure(page, ".download-copy");
  const cards = await page.locator(".platform-download").evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
  }));
  const actions = await page.locator(".platform-actions").evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    const parent = node.closest(".platform-download")?.getBoundingClientRect();
    return { rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, parent: parent ? { left: parent.left, right: parent.right, top: parent.top, bottom: parent.bottom } : null };
  }));

  if (width > 900) {
    if (Math.abs(memory.left - stage.left) > 2 || Math.abs(memory.right - stage.right) > 2) {
      issues.push(`download memory does not span stage (${memory.left.toFixed(1)}..${memory.right.toFixed(1)} vs ${stage.left.toFixed(1)}..${stage.right.toFixed(1)})`);
    }
    if (Math.abs((copy.left + copy.right) / 2 - (stage.left + stage.right) / 2) > 3) {
      issues.push("download composition is not centered on stage");
    }
    if (cards.length === 2 && Math.abs(cards[0].width - cards[1].width) > 3) issues.push("download cards have different widths");
  } else if (memory.position === "absolute") {
    issues.push("compact download memory remained absolute");
  }

  cards.forEach((card, index) => {
    if (card.left < -2 || card.right > innerWidth + 2) issues.push(`download card ${index} out of viewport`);
  });
  actions.forEach((entry, index) => {
    if (!entry.parent) return;
    if (entry.rect.left < entry.parent.left - 2 || entry.rect.right > entry.parent.right + 2
      || entry.rect.bottom > entry.parent.bottom + 2) issues.push(`download actions ${index} escaped card`);
  });

  if (width <= 430) {
    const targets = await page.locator(".package-advisor button,.platform-primary,.platform-secondary,.platform-guide").evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height, text: node.textContent.trim() };
    }));
    targets.forEach((target) => {
      if (target.width < 44 || target.height < 44) issues.push(`small download target ${target.text} ${target.width.toFixed(1)}x${target.height.toFixed(1)}`);
    });
  }

  return { state: "download", issues, stage, memory, copy, cards };
}

try {
  for (const [width, height] of viewports) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
    const consoleErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.braceRuntime === "v5");
    await page.waitForTimeout(100);

    const states = [];
    states.push(await assertState(page, width, height, "hero-default"));

    if (width > 760) {
      const slider = page.locator("[data-memory-divider]");
      await slider.focus();
      await slider.press("Home");
      await page.waitForTimeout(60);
      states.push(await assertState(page, width, height, "hero-min"));
      await slider.press("End");
      await page.waitForTimeout(60);
      states.push(await assertState(page, width, height, "hero-max"));
    }

    states.push(await assertDownload(page, width));
    if (consoleErrors.length) states.push({ state: "console", issues: consoleErrors });

    const issues = states.flatMap((entry) => entry.issues || []);
    results.push({ viewport: `${width}x${height}`, issues, states: states.map(({ state, issues: stateIssues }) => ({ state, issues: stateIssues })) });
    process.stdout.write(`${issues.length ? "FAIL" : "PASS"} ${width}x${height}${issues.length ? `: ${issues.join("; ")}` : ""}\n`);
    await page.close();
  }
} finally {
  await browser.close();
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
if (results.some((entry) => entry.issues.length)) process.exitCode = 1;
