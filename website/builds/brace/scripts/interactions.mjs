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
  await check("scroll film mounts with poster fallback", async () => {
    if (await page.locator("[data-sc-scrub]").count() !== 1) throw new Error("Expected one scroll film");
    if (!await page.locator(".film-poster").isVisible()) throw new Error("Film poster is not visible");
    const source = await page.locator("[data-sc-scrub]").getAttribute("data-sc-src");
    if (!source?.endsWith(".mp4")) throw new Error("Film source is not configured");
  });
  await check("frost state responds to scroll", async () => {
    const before = await page.locator(".film-stage").getAttribute("data-sc-verify-state");
    await page.evaluate(() => scrollTo(0, innerHeight * 1.7));
    await page.waitForTimeout(120);
    const after = await page.locator(".film-stage").getAttribute("data-sc-verify-state");
    if (!before || !after || before === after) throw new Error(`Frost state did not change: ${before} -> ${after}`);
  });
  await check("context relay explains every custody boundary", async () => {
    const relay = page.locator("[data-memory-relay]");
    await relay.scrollIntoViewIfNeeded();
    const input = relay.locator("[data-relay-input]");
    await input.fill("2");
    await input.dispatchEvent("input");
    if (await relay.getAttribute("data-sc-verify-state") !== "relay:2") throw new Error("Relay did not reach the AI handoff");
    if (!String(await relay.locator("[data-relay-output]").textContent()).includes("Only the context you choose")) throw new Error("Relay did not explain the handoff boundary");
    await relay.locator('[data-relay-step="1"]').click();
    if (await relay.getAttribute("data-sc-verify-state") !== "relay:1") throw new Error("Relay node controls are not interactive");
  });
  await check("sideways gallery has real overflow", async () => {
    const overflow = await page.locator(".product-rail").evaluate((rail) => rail.scrollWidth - window.innerWidth);
    if (overflow < 720) throw new Error(`Gallery overflow too small: ${overflow}px`);
  });
  await check("gallery controls change the selected view", async () => {
    await page.locator("#product").evaluate((node) => scrollTo(0, node.offsetTop + 200));
    await page.waitForTimeout(80);
    const before = await page.locator("#proof-position").textContent();
    await page.locator("[data-proof-next]").click();
    await page.waitForTimeout(120);
    const after = await page.locator("#proof-position").textContent();
    if (before === after) throw new Error("Next control did not change the gallery label");
  });
  await check("product lightbox and keyboard close", async () => {
    const trigger = page.locator('[data-proof="graph"] [data-proof-expand]');
    await trigger.evaluate((node) => node.click());
    if (!await page.locator("#proof-dialog").evaluate((node) => node.open)) throw new Error("Dialog did not open");
    if (!String(await page.locator("#proof-dialog-title").textContent()).includes("Knowledge")) throw new Error("Dialog title did not update");
    await page.keyboard.press("Escape");
    if (await page.locator("#proof-dialog").evaluate((node) => node.open)) throw new Error("Dialog did not close");
  });
  await check("equal platform downloads are versioned", async () => {
    const links = await page.locator('[data-download="windows"],[data-download="linux"],[data-download="deb"]').evaluateAll((nodes) => nodes.map((node) => node.href));
    if (links.length !== 3 || links.some((url) => !url.includes("/releases/download/v0.6.0/"))) throw new Error("A download is not versioned");
    const widths = await page.locator(".platforms article").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
    if (Math.abs(widths[0] - widths[1]) > 2) throw new Error("Windows and Linux are not equal width");
  });
  await check("beginner guide is part of the main site", async () => {
    const response = await page.request.get(`${base}/guide/`);
    if (!response.ok()) throw new Error(`Guide returned ${response.status()}`);
    if (!await page.locator('a[href="guide/"]').count()) throw new Error("Main page does not link to the guide");
  });
} finally { await browser.close(); }
process.stdout.write(`${JSON.stringify({interactions: results, consoleErrors: errors}, null, 2)}\n`);
if (results.some((result) => !result.passed) || errors.length) process.exitCode = 1;
