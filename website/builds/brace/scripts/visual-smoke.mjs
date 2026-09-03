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
  await page.screenshot({path:path.join(out, `${name}.png`), fullPage:false});
  process.stdout.write(`SHOT ${name} ${viewport.width}x${viewport.height}\n`);
  await page.close();
}
const waitHome = async (page) => {
  await page.waitForFunction(() => document.documentElement.dataset.braceExperience === "living-v9");
  await page.waitForFunction(() => document.documentElement.dataset.bracePremium === "v8");
};
const waitGuide = async (page) => {
  await page.waitForFunction(() => document.documentElement.dataset.braceGuideExperience === "living-v7");
  await page.waitForFunction(() => document.documentElement.dataset.braceGuidePremium === "v8");
  await page.waitForFunction(() => document.documentElement.dataset.braceGuideScrollcraft === "mounted");
};
try {
  await capture("home-hero-ultrawide", {width:1920,height:1080}, "/", async (page) => {
    await waitHome(page); await page.evaluate(() => scrollTo(0, innerHeight * .55)); await page.waitForTimeout(320);
  });
  await capture("home-hero-desktop", {width:1440,height:900}, "/", async (page) => {
    await waitHome(page); await page.evaluate(() => scrollTo(0, innerHeight * .55)); await page.waitForTimeout(320);
  });
  await capture("home-story-desktop", {width:1440,height:900}, "/", async (page) => {
    await waitHome(page); await page.locator("#story").evaluate((node) => node.scrollIntoView({block:"center",behavior:"instant"})); await page.waitForTimeout(260);
  });
  await capture("home-live-understand-desktop", {width:1440,height:900}, "/", async (page) => {
    await waitHome(page); const live=page.locator("[data-brace-live]"); await live.locator('[data-live-target="1"]').click(); await page.waitForFunction(() => document.querySelector("[data-brace-live]")?.dataset.liveState === "1"); await page.waitForTimeout(360);
  });
  await capture("home-live-recall-desktop", {width:1440,height:900}, "/", async (page) => {
    await waitHome(page); const live=page.locator("[data-brace-live]"); await live.locator('[data-live-target="3"]').click(); await page.waitForFunction(() => document.querySelector("[data-brace-live]")?.dataset.liveState === "3"); await live.locator('[data-query="privacy"]').click(); await page.waitForTimeout(300);
  });
  await capture("home-product-desktop", {width:1440,height:900}, "/", async (page) => {
    await waitHome(page); await page.locator("#product").evaluate((node) => scrollTo(0,node.offsetTop+(node.offsetHeight-innerHeight)*.42)); await page.waitForTimeout(320);
  });
  await capture("home-live-connect-mobile", {width:390,height:844}, "/", async (page) => {
    await waitHome(page); const live=page.locator("[data-brace-live]"); await live.scrollIntoViewIfNeeded(); await live.locator('[data-live-target="2"]').click(); await page.waitForFunction(() => document.querySelector("[data-brace-live]")?.dataset.liveState === "2"); await page.locator(".brace-live-window").evaluate((node)=>node.scrollIntoView({block:"center",behavior:"instant"})); await page.waitForTimeout(240);
  });
  await capture("home-live-act-mobile", {width:390,height:844}, "/", async (page) => {
    await waitHome(page); const live=page.locator("[data-brace-live]"); await live.scrollIntoViewIfNeeded(); await live.locator('[data-live-target="4"]').click(); await page.waitForFunction(() => document.querySelector("[data-brace-live]")?.dataset.liveState === "4"); await page.locator(".brace-live-window").evaluate((node)=>node.scrollIntoView({block:"center",behavior:"instant"})); await page.waitForTimeout(240);
  });
  await capture("home-live-recall-compact", {width:375,height:812}, "/", async (page) => {
    await waitHome(page); const live=page.locator("[data-brace-live]"); await live.scrollIntoViewIfNeeded(); await live.locator('[data-live-target="3"]').click(); await page.waitForFunction(() => document.querySelector("[data-brace-live]")?.dataset.liveState === "3"); await page.locator(".brace-live-window").evaluate((node)=>node.scrollIntoView({block:"center",behavior:"instant"})); await page.waitForTimeout(240);
  });
  await capture("guide-hero-desktop", {width:1440,height:900}, "/guide/", async (page) => {
    await waitGuide(page); const coach=page.locator("[data-guide-live-coach]"); await page.locator(".guide-hero").evaluate((node)=>node.scrollIntoView({block:"start",behavior:"instant"})); await coach.locator("[data-coach-next]").click(); await page.waitForFunction(() => document.querySelector("[data-guide-live-coach]")?.dataset.scVerifyState === "guide:first-run"); await page.waitForTimeout(220);
  });
  await capture("guide-reading-desktop", {width:1440,height:900}, "/guide/", async (page) => {
    await waitGuide(page); await page.locator("#recall").evaluate((node)=>node.scrollIntoView({block:"start",behavior:"instant"})); await page.waitForFunction(() => document.querySelector('.guide-toc a[href="#recall"]')?.getAttribute('aria-current')==='true'); await page.waitForTimeout(200);
  });
  await capture("guide-hero-mobile", {width:390,height:844}, "/guide/", async (page) => {
    await waitGuide(page); const coach=page.locator("[data-guide-live-coach]"); await coach.locator("[data-coach-next]").click(); await page.waitForFunction(() => document.querySelector("[data-guide-live-coach]")?.dataset.scVerifyState === "guide:first-run"); await coach.evaluate((node)=>node.scrollIntoView({block:"center",behavior:"instant"})); await page.waitForTimeout(200);
  });
} finally { await browser.close(); }
