#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "lab", "visual");
const base = process.env.BRACE_SITE_URL || "http://127.0.0.1:4517";
fs.mkdirSync(out, {recursive:true});

const browser = await chromium.launch({executablePath: process.env.SCROLLCRAFT_CHROME || "/usr/bin/google-chrome", headless:true});

async function capture(name, viewport, route, setup) {
  const page = await browser.newPage({viewport, reducedMotion:"no-preference"});
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`${base}${route}`, {waitUntil:"networkidle"});
  await setup(page);
  if (errors.length) throw new Error(`${name} console errors: ${errors.join(" | ")}`);
  const file = path.join(out, `${name}.png`);
  await page.screenshot({path:file, fullPage:false});
  process.stdout.write(`SHOT ${name} ${viewport.width}x${viewport.height}\n`);
  await page.close();
}

try {
  await capture("home-live-desktop", {width:1440,height:900}, "/", async (page) => {
    await page.waitForFunction(() => document.documentElement.dataset.braceExperience === "living-v7");
    const live = page.locator("[data-brace-live]");
    await live.locator('[data-live-target="1"]').click();
    await page.waitForFunction(() => document.querySelector("[data-brace-live]")?.dataset.liveState === "1");
    await page.waitForTimeout(520);
  });

  await capture("home-live-mobile", {width:390,height:844}, "/", async (page) => {
    await page.waitForFunction(() => document.documentElement.dataset.braceExperience === "living-v7");
    const live = page.locator("[data-brace-live]");
    await live.scrollIntoViewIfNeeded();
    await live.locator('[data-live-target="2"]').click();
    await page.waitForFunction(() => document.querySelector("[data-brace-live]")?.dataset.liveState === "2");
    await page.locator(".brace-live-window").evaluate((node) => node.scrollIntoView({block:"center", behavior:"instant"}));
    await page.waitForTimeout(260);
  });

  await capture("guide-companion-desktop", {width:1440,height:900}, "/guide/", async (page) => {
    await page.waitForFunction(() => document.documentElement.dataset.braceGuideExperience === "living-v7");
    await page.locator("#recall").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("[data-guide-live-coach]")?.dataset.scVerifyState === "guide:recall");
    await page.waitForTimeout(220);
  });

  await capture("guide-companion-mobile", {width:390,height:844}, "/guide/", async (page) => {
    await page.waitForFunction(() => document.documentElement.dataset.braceGuideExperience === "living-v7");
    const coach = page.locator("[data-guide-live-coach]");
    await coach.scrollIntoViewIfNeeded();
    await coach.locator("[data-coach-next]").click();
    await page.waitForFunction(() => document.querySelector("[data-guide-live-coach]")?.dataset.scVerifyState === "guide:first-run");
    await coach.evaluate((node) => node.scrollIntoView({block:"center", behavior:"instant"}));
    await page.waitForTimeout(220);
  });
} finally {
  await browser.close();
}
