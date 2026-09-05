#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "lab", "visual");
const base = process.env.BRACE_SITE_URL || "http://127.0.0.1:4517";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.SCROLLCRAFT_CHROME || "/usr/bin/google-chrome", headless: true });

async function capture(name, viewport, route, setup) {
  const page = await browser.newPage({ viewport, reducedMotion: "no-preference" });
  page.setDefaultTimeout(20_000);
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await setup(page);
  if (errors.length) throw new Error(`${name} console errors: ${errors.join(" | ")}`);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
  process.stdout.write(`SHOT ${name} ${viewport.width}x${viewport.height}\n`);
  await page.close();
}

async function readyHome(page) {
  const skip = page.locator("[data-opening-skip]");
  if (await skip.isVisible()) await skip.click();
  await page.waitForFunction(() => document.documentElement.dataset.braceRuntime === "ready");
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(180);
}

async function readyGuide(page) {
  await page.waitForFunction(() => document.documentElement.dataset.braceGuideRuntime === "ready");
  await page.waitForTimeout(180);
}

try {
  await capture("home-hero-desktop", { width: 1440, height: 900 }, "/", readyHome);
  await capture("home-demo-graph", { width: 1440, height: 900 }, "/", async (page) => {
    await readyHome(page);
    await page.locator('[data-demo-tab="graph"]').click();
    await page.locator("[data-demo-shell]").scrollIntoViewIfNeeded();
  });
  await capture("home-product-desktop", { width: 1440, height: 900 }, "/", async (page) => {
    await readyHome(page);
    await page.locator("#product").evaluate((node) => node.scrollIntoView({ block: "start", behavior: "instant" }));
    await page.waitForTimeout(220);
  });
  await capture("home-mobile", { width: 390, height: 844 }, "/", readyHome);
  await capture("guide-hero-desktop", { width: 1440, height: 900 }, "/guide/", readyGuide);
  await capture("guide-install-mobile", { width: 390, height: 844 }, "/guide/", async (page) => {
    await readyGuide(page);
    await page.locator("#install").scrollIntoViewIfNeeded();
  });
} finally {
  await browser.close();
}
