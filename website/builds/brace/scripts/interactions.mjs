#!/usr/bin/env node
import { chromium } from "playwright-core";

const base = process.env.BRACE_SITE_URL || "http://127.0.0.1:4517";
const browser = await chromium.launch({executablePath: process.env.SCROLLCRAFT_CHROME || "/usr/bin/google-chrome", headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: "no-preference"});
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(20000);
const results = [];
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
async function check(name, run) {
  try { await run(); results.push({interaction: name, passed: true}); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { results.push({interaction: name, passed: false, error: error.message}); process.stdout.write(`FAIL ${name}: ${error.message}\n`); }
}
try {
  await page.goto(`${base}/`, {waitUntil: "networkidle"});
  await page.waitForFunction(() => document.documentElement.dataset.braceRuntime === "v9");
  await page.waitForFunction(() => document.documentElement.dataset.braceExperience === "living-v9");
  await page.waitForFunction(() => document.documentElement.dataset.bracePremium === "v8");

  await check("premium continuity layer mounts with ScrollCraft", async () => {
    if (!await page.locator('link[href="premium-v8.css"]').count()) throw new Error("Premium continuity stylesheet is missing");
    if (await page.locator("[data-sc-scrub]").count() !== 1) throw new Error("Expected one scroll film");
  });

  await check("context relay remains interactive", async () => {
    const relay = page.locator("[data-memory-relay]");
    await relay.scrollIntoViewIfNeeded();
    const input = relay.locator("[data-relay-input]");
    await input.fill("2");
    await input.dispatchEvent("input");
    if (await relay.getAttribute("data-sc-verify-state") !== "relay:2") throw new Error("Relay did not reach AI handoff");
    await relay.locator('[data-relay-step="1"]').click();
    if (await relay.getAttribute("data-sc-verify-state") !== "relay:1") throw new Error("Relay controls failed");
  });

  await check("live demo exposes five real product stages", async () => {
    const live = page.locator("[data-brace-live]");
    await live.scrollIntoViewIfNeeded();
    const labels = await live.locator("[data-live-target]").allTextContents();
    if (labels.length !== 5) throw new Error(`Expected 5 stages, got ${labels.length}`);
    for (const expected of ["Capture","Understand","Connect","Recall","Act"]) {
      if (!labels.join(" ").includes(expected)) throw new Error(`Missing ${expected} stage`);
    }
  });

  await check("capture accepts visitor input and advances to Understand", async () => {
    const live = page.locator("[data-brace-live]");
    await live.locator('[data-live-target="0"]').click();
    const input = live.locator("[data-live-input]");
    await input.fill("Remember that release notes must keep source receipts visible.");
    await live.locator("[data-live-capture] button[type=submit]").click();
    await page.waitForFunction(() => document.querySelector("[data-brace-live]")?.dataset.liveState === "1");
    const memory = await live.locator("[data-live-memory-title]").textContent();
    if (!String(memory).includes("source receipts")) throw new Error("Captured memory did not flow into indexing state");
  });

  await check("Connect graph is inspectable", async () => {
    const live = page.locator("[data-brace-live]");
    await live.locator('[data-live-target="2"]').click();
    await page.waitForFunction(() => document.querySelector("[data-brace-live]")?.dataset.liveState === "2");
    await live.locator('[data-memory-id="privacy"]').click();
    const inspector = await live.locator("[data-live-inspector]").textContent();
    if (!String(inspector).includes("PRIVACY ARCHITECTURE")) throw new Error("Graph inspector did not update");
  });

  await check("Recall scenarios change answer and preserve receipts", async () => {
    const live = page.locator("[data-brace-live]");
    await live.locator('[data-live-target="3"]').click();
    await page.waitForFunction(() => document.querySelector("[data-brace-live]")?.dataset.liveState === "3");
    await live.locator('[data-query="privacy"]').click();
    const query = await live.locator("[data-live-query]").textContent();
    const answer = await live.locator("[data-live-answer]").textContent();
    if (!String(query).includes("privacy choices")) throw new Error("Recall query did not change");
    if (!String(answer).includes("privacy boundary")) throw new Error("Recall answer did not change");
    if (await live.locator("[data-receipt]").count() < 2) throw new Error("Evidence receipts are missing");
  });

  await check("Act stage performs bounded deterministic next steps", async () => {
    const live = page.locator("[data-brace-live]");
    await live.locator('[data-live-target="4"]').click();
    await page.waitForFunction(() => document.querySelector("[data-brace-live]")?.dataset.liveState === "4");
    const action = live.locator('[data-act="checklist"]');
    await action.click();
    if (!await action.evaluate((node) => node.classList.contains("is-done"))) throw new Error("Action state did not update");
  });

  await check("live demo keyboard navigation follows five modes", async () => {
    const live = page.locator("[data-brace-live]");
    const first = live.locator('[data-live-target="0"]');
    await first.focus();
    await page.keyboard.press("ArrowRight");
    if (await page.evaluate(() => document.activeElement?.getAttribute("data-live-target")) !== "1") throw new Error("ArrowRight did not move mode focus");
  });

  await check("pause and replay restore Capture", async () => {
    const live = page.locator("[data-brace-live]");
    const pause = live.locator("[data-live-pause]");
    await pause.click();
    if (await pause.getAttribute("aria-pressed") !== "true") throw new Error("Pause did not engage");
    await live.locator("[data-live-reset]").click();
    await page.waitForFunction(() => document.querySelector("[data-brace-live]")?.dataset.liveState === "0");
    if (await pause.getAttribute("aria-pressed") !== "false") throw new Error("Replay did not clear pause");
  });

  await check("product reel and lightbox remain functional", async () => {
    const overflow = await page.locator(".product-rail").evaluate((rail) => rail.scrollWidth - window.innerWidth);
    if (overflow < 720) throw new Error(`Gallery overflow too small: ${overflow}px`);
    const trigger = page.locator('[data-proof="graph"] [data-proof-expand]');
    await trigger.evaluate((node) => node.click());
    if (!await page.locator("#proof-dialog").evaluate((node) => node.open)) throw new Error("Dialog did not open");
    await page.keyboard.press("Escape");
  });

  await check("downloads remain versioned", async () => {
    const links = await page.locator('[data-download="windows"],[data-download="linux"],[data-download="deb"]').evaluateAll((nodes) => nodes.map((node) => node.href));
    if (links.length !== 3 || links.some((url) => !url.includes("/releases/download/v0.7.0/"))) throw new Error("A download is not versioned");
  });

  await check("guide remains a ScrollCraft-driven beginner journey", async () => {
    await page.goto(`${base}/guide/`, {waitUntil: "networkidle"});
    await page.waitForFunction(() => document.documentElement.dataset.braceGuideExperience === "living-v7");
    await page.waitForFunction(() => document.documentElement.dataset.braceGuidePremium === "v8");
    await page.waitForFunction(() => document.documentElement.dataset.braceGuideScrollcraft === "mounted");
    const coach = page.locator("[data-guide-live-coach]");
    if (!await coach.isVisible()) throw new Error("Guide companion is not visible");
    if (await page.locator('.guide-toc [data-guide-live-coach]').count()) throw new Error("Guide companion still clutters sticky TOC");
    const steps = await page.locator(".guide-step").count();
    if (await page.locator(".guide-step-next").count() !== steps - 1) throw new Error("Guide next-step continuity is incomplete");
  });
} finally { await browser.close(); }
process.stdout.write(`${JSON.stringify({interactions: results, consoleErrors: errors}, null, 2)}\n`);
if (results.some((result) => !result.passed) || errors.length) process.exitCode = 1;
