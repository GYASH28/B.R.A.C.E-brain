#!/usr/bin/env node
import { chromium } from "playwright-core";

const base = process.env.BRACE_SITE_URL || "http://127.0.0.1:4517";
const browser = await chromium.launch({ executablePath: process.env.SCROLLCRAFT_CHROME || "/usr/bin/google-chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
page.setDefaultTimeout(15_000);
page.setDefaultNavigationTimeout(20_000);
const results = [];
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

async function check(name, run) {
  try {
    await run();
    results.push({ interaction: name, passed: true });
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    results.push({ interaction: name, passed: false, error: error.message });
    process.stdout.write(`FAIL ${name}: ${error.message}\n`);
  }
}

try {
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.dataset.braceRuntime === "ready");

  await check("hero is immediately usable and ignition is non-blocking", async () => {
    if (!await page.locator("#hero-title").isVisible()) throw new Error("Hero title is not visible at first paint");
    if (!await page.locator('.hero-actions a[href="#atlas"]').isVisible()) throw new Error("Primary hero action is unavailable");
    await page.locator("[data-replay-opening]").click();
    await page.waitForFunction(() => document.documentElement.dataset.intro === "running");
    if (!await page.locator("#hero-title").isVisible()) throw new Error("Replay blocks the hero");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.documentElement.dataset.intro === "complete");
  });

  await check("provenance pulse updates the receipt and accessible summary", async () => {
    await page.locator('[data-source="meeting"]').click();
    await page.waitForFunction(() => document.querySelector("[data-hero-atlas]")?.dataset.active === "meeting");
    const receipt = await page.locator("[data-receipt-source]").textContent();
    const summary = await page.locator("[data-route-summary]").textContent();
    if (!String(receipt).includes("Launch review")) throw new Error(`Unexpected meeting receipt: ${receipt}`);
    if (!String(summary).includes("local BRACE memory")) throw new Error("Accessible route summary was not updated");
    if (await page.locator('[data-source="meeting"]').getAttribute("aria-pressed") !== "true") throw new Error("Meeting node does not expose selected state");
  });

  await check("graph search and filters keep results truthful", async () => {
    await page.locator("#atlas").scrollIntoViewIfNeeded();
    await page.locator('[data-brain-filter="source"]').click();
    const visibleSources = await page.locator('[data-node]:not(.is-muted)').count();
    if (visibleSources !== 3) throw new Error(`Expected 3 visible sources, received ${visibleSources}`);
    await page.locator("[data-brain-search]").fill("architecture");
    if (await page.locator('[data-node]:not(.is-muted)').count() !== 1) throw new Error("Graph search did not isolate the source");
    await page.locator('[data-node="architecture"]').click();
    if (!String(await page.locator("[data-brain-title]").textContent()).includes("Architecture")) throw new Error("Graph inspector did not update");
    await page.locator("[data-brain-fit]").click();
    if (await page.locator('[data-node]:not(.is-muted)').count() !== 7) throw new Error("Fit did not restore the graph");
  });

  await check("graph reset and evidence path controls work", async () => {
    await page.locator('[data-node="maya"]').click();
    await page.locator("[data-brain-follow]").click();
    if (await page.locator("[data-link].is-active").count() < 2) throw new Error("Evidence path was not highlighted");
    await page.locator("[data-brain-reset]").click();
    const selected = await page.locator('[data-node="decision"]').evaluate((node) => node.classList.contains("is-selected"));
    if (!selected) throw new Error("Reset did not restore the default node");
  });

  await check("graph fullscreen opens", async () => {
    await page.locator("[data-brain-fullscreen]").click();
    await page.waitForTimeout(160);
    const open = await page.locator("[data-brain-stage]").evaluate((stage) => document.fullscreenElement === stage || stage.classList.contains("is-fullscreen-fallback"));
    if (!open) throw new Error("Graph did not enter full screen or fallback mode");
    await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
    await page.waitForFunction(() => !document.fullscreenElement);
  });

  await check("business role lenses support pointer and keyboard selection", async () => {
    await page.locator("#company").evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(220);
    const executive = page.locator('button[data-role="executive"]');
    await executive.click();
    if (await executive.getAttribute("aria-selected") !== "true") throw new Error("Executive role is not selected");
    if (!String(await page.locator("[data-role-title]").textContent()).includes("Strategy")) throw new Error("Executive lens content did not render");
    await executive.press("ArrowRight");
    if (await page.locator('button[data-role="admin"]').getAttribute("aria-selected") !== "true") throw new Error("Arrow navigation did not select the administrator lens");
  });

  await check("product proof opens and closes accessibly", async () => {
    const trigger = page.locator('[data-proof="graph"] [data-proof-expand]');
    await trigger.evaluate((node) => node.click());
    if (!await page.locator("#proof-dialog").evaluate((node) => node.open)) throw new Error("Proof dialog did not open");
    if (!String(await page.locator("#proof-dialog-title").textContent()).includes("Brain")) throw new Error("Proof title did not update");
    await page.keyboard.press("Escape");
    if (await page.locator("#proof-dialog").evaluate((node) => node.open)) throw new Error("Proof dialog did not close");
  });

  await check("equal platform downloads are versioned", async () => {
    const links = await page.locator('[data-download="windows"],[data-download="linux"],[data-download="deb"]').evaluateAll((nodes) => nodes.map((node) => node.href));
    if (links.length !== 3 || links.some((url) => !url.includes("/releases/download/v0.7.0/"))) throw new Error("A download is not versioned");
    const widths = await page.locator(".download-platforms > article").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
    if (Math.abs(widths[0] - widths[1]) > 2) throw new Error("Platform cards are not equal width");
  });

  await check("beginner guide adapts, tracks progress, and diagnoses locally", async () => {
    await page.goto(`${base}/guide/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.braceGuideRuntime === "ready");
    await page.locator('[data-platform-choice="windows"]').click();
    if (!String(await page.locator("[data-platform-command]").textContent()).includes(".exe")) throw new Error("Windows path did not render");
    await page.locator('[data-setup-check="install"]').check();
    if (await page.locator("[data-progress-count]").textContent() !== "1") throw new Error("Progress tracker did not update");
    await page.locator("[data-trouble-search]").fill("AI cannot connect");
    if (!String(await page.locator("[data-trouble-output]").textContent()).includes("brace_status")) throw new Error("Troubleshooter did not provide the safe MCP check");
    await page.locator("[data-reset-progress]").click();
  });
} finally {
  await browser.close();
}

process.stdout.write(`${JSON.stringify({ interactions: results, consoleErrors: errors }, null, 2)}\n`);
if (results.some((result) => !result.passed) || errors.length) process.exitCode = 1;
