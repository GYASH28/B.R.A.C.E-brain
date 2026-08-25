#!/usr/bin/env node

import { chromium } from "playwright-core";

const base = process.env.BRACE_SITE_URL || "http://127.0.0.1:4517";
const browser = await chromium.launch({
  executablePath: process.env.SCROLLCRAFT_CHROME || "/usr/bin/google-chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
page.setDefaultTimeout(5000);
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

const results = [];
async function check(name, assertion) {
  try {
    await assertion();
    results.push({ interaction: name, passed: true });
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    results.push({ interaction: name, passed: false, error: error.message });
    process.stdout.write(`FAIL ${name}: ${error.message}\n`);
  }
}

try {
  await page.goto(`${base}/`, { waitUntil: "networkidle" });

  await check("command palette search and destination", async () => {
    await page.locator("[data-command-open]").click();
    await page.locator("#command-input").fill("graph");
    if (!await page.locator('[data-command-target="#constellation"]:visible').count()) throw new Error("Constellation destination did not remain visible");
    await page.locator("#command-dialog [data-dialog-close]").click();
    if (await page.locator("#command-dialog").evaluate((dialog) => dialog.open)) throw new Error("Command palette did not close");
    await page.waitForTimeout(60);
  });

  await check("keyboard memory divider", async () => {
    const slider = page.locator("[data-memory-divider]");
    await slider.focus();
    const before = Number(await slider.getAttribute("aria-valuenow"));
    await slider.press("ArrowRight");
    await page.waitForFunction((value) => Number(document.querySelector("[data-memory-divider]")?.getAttribute("aria-valuenow")) > value, before);
    const after = Number(await slider.getAttribute("aria-valuenow"));
    if (!(after > before)) throw new Error(`Divider did not advance: ${before} -> ${after}`);
  });

  await check("fragment recovery and reset", async () => {
    await page.locator("[data-memory-fragment]").nth(2).click();
    if (await page.locator("#recovered-count").textContent() !== "1") throw new Error("Recovery count did not increment");
    await page.locator("[data-recovery-reset]").click();
    if (await page.locator("#recovered-count").textContent() !== "0") throw new Error("Recovery count did not reset");
  });

  await check("provenance inspector", async () => {
    await page.locator('[data-source-inspect="source"]').click();
    if (!await page.locator("#source-dialog").evaluate((dialog) => dialog.open)) throw new Error("Source dialog did not open");
    if (!String(await page.locator("#source-dialog-title").textContent()).includes("Architecture")) throw new Error("Source title did not render");
    await page.locator("#source-dialog [data-dialog-close]").first().click();
  });

  await check("recall evidence layers", async () => {
    const toggle = page.locator('[data-evidence-layer="memory"]');
    await toggle.click();
    if (!await page.locator(".pipeline-memory").evaluate((element) => element.hidden)) throw new Error("Memory layer stayed visible");
    await toggle.click();
  });

  await check("copy recall result", async () => {
    const copyButton = page.locator("[data-copy-recall]");
    await copyButton.click();
    await page.waitForFunction(() => document.querySelector("[data-copy-recall]")?.textContent !== "Copy result");
    if (await copyButton.textContent() !== "Copied") throw new Error("Copy confirmation was not shown");
  });

  await check("constellation filters", async () => {
    await page.locator('[data-node-filter="source"]').click();
    if (!await page.locator('[data-node="canonical"]').evaluate((node) => node.classList.contains("is-filtered"))) throw new Error("Memory node was not filtered");
    if (await page.locator('[data-node="architecture"]').evaluate((node) => node.classList.contains("is-filtered"))) throw new Error("Source node was incorrectly filtered");
    await page.locator('[data-node-filter="all"]').click();
  });

  await check("constellation node inspector", async () => {
    await page.locator('[data-node="architecture"]').click();
    if (!String(await page.locator("#node-title").textContent()).includes("Architecture")) throw new Error("Selected node did not update inspector");
  });

  await check("constellation reshuffle", async () => {
    const before = await page.locator('[data-node="architecture"]').getAttribute("style");
    await page.locator("[data-constellation-shuffle]").click();
    const after = await page.locator('[data-node="architecture"]').getAttribute("style");
    if (before === after) throw new Error("Node positions did not change");
  });

  await check("privacy vault selector", async () => {
    await page.locator('[data-vault-select="memory"]').click();
    if (!String(await page.locator("#vault-readout-label").textContent()).includes("MEMORY")) throw new Error("Vault readout did not change");
  });

  await check("product screenshot lightbox", async () => {
    await page.locator('[data-proof="graph"] [data-proof-expand]').click();
    if (!await page.locator("#proof-dialog").evaluate((dialog) => dialog.open)) throw new Error("Product lightbox did not open");
    if (!String(await page.locator("#proof-dialog-title").textContent()).includes("constellation")) throw new Error("Product title did not update");
    await page.locator("#proof-dialog [data-dialog-close]").click();
  });

  await check("package advisor", async () => {
    await page.locator('[data-package-goal="portable"]').click();
    if (!String(await page.locator("#package-advice").textContent()).includes("AppImage")) throw new Error("Portable advice did not render");
    if (!await page.locator('[data-platform-card="linux"]').evaluate((card) => card.classList.contains("is-advised"))) throw new Error("Linux package was not highlighted");
  });

  await check("motion density control", async () => {
    const reducedDisabled = await page.locator("[data-motion-toggle]").isDisabled();
    if (!reducedDisabled) throw new Error("System reduced-motion preference did not lock calm mode");
  });
} finally {
  await browser.close();
}

process.stdout.write(`${JSON.stringify({ interactions: results, consoleErrors }, null, 2)}\n`);
if (results.some((result) => !result.passed) || consoleErrors.length) process.exitCode = 1;
