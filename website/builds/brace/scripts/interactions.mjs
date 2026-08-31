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
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForFunction(() => document.documentElement.dataset.braceRuntime === "v5");

  await check("command palette search and destination", async () => {
    await page.keyboard.press("Control+K");
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

  await check("device-local saved recall", async () => {
    await page.locator("#recall-query").fill("Which sources remain canonical?");
    await page.locator("[data-save-query]").click();
    if (!await page.locator("[data-saved-queries] span").count()) throw new Error("Saved question did not render");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("brace.website.saved-questions") || "[]"));
    if (!stored.includes("Which sources remain canonical?")) throw new Error("Saved question did not persist locally");
  });

  await check("field ledger chapter stamps", async () => {
    await page.locator("#boundary").evaluate((section) => section.scrollIntoView({ block: "center" }));
    await page.waitForFunction(() => document.querySelector('[data-ledger-chapter="04"]')?.hasAttribute("aria-current"));
    const current = await page.locator('[data-ledger-chapter="04"]').getAttribute("aria-current");
    if (current === null) throw new Error("Custody chapter did not become current");
    if (await page.locator('[data-ledger-chapter="04"] > b').textContent() !== "OPEN") throw new Error("Ledger did not stamp the open chapter");
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

  await check("five constellation projections", async () => {
    const positions = new Set();
    for (const preset of ["rings", "living", "orbit", "flow", "chronicle"]) {
      const button = page.locator(`[data-constellation-preset="${preset}"]`);
      await button.click();
      if (await button.getAttribute("aria-pressed") !== "true") throw new Error(`${preset} was not selected`);
      if (await page.locator("[data-constellation-board]").getAttribute("data-preset") !== preset) throw new Error(`${preset} did not reach the board`);
      positions.add(await page.locator('[data-node="architecture"]').getAttribute("style"));
    }
    if (positions.size !== 5) throw new Error("Each projection must produce a distinct node position");
  });

  await check("privacy vault selector", async () => {
    await page.locator('[data-vault-select="memory"]').click();
    if (!String(await page.locator("#vault-readout-label").textContent()).includes("MEMORY")) throw new Error("Vault readout did not change");
  });

  await check("product screenshot lightbox", async () => {
    const trigger = page.locator('[data-proof="graph"] [data-proof-expand]');
    await trigger.focus();
    await trigger.press("Enter");
    if (!await page.locator("#proof-dialog").evaluate((dialog) => dialog.open)) throw new Error("Product lightbox did not open");
    if (!String(await page.locator("#proof-dialog-title").textContent()).includes("Five knowledge")) throw new Error("Product title did not update");
    await page.locator("#proof-dialog [data-dialog-close]").click();
  });

  await check("package advisor", async () => {
    const portable = page.locator('[data-package-goal="portable"]');
    await portable.focus();
    await portable.press("Enter");
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
