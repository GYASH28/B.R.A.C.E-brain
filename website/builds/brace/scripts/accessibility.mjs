#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const axePath = path.join(root, "node_modules", "axe-core", "axe.min.js");
const base = process.env.BRACE_SITE_URL || "http://127.0.0.1:4517";
const browser = await chromium.launch({
  executablePath: process.env.SCROLLCRAFT_CHROME || "/usr/bin/google-chrome",
  headless: true,
});

const targets = [
  { name: "launch-desktop", path: "/", viewport: { width: 1440, height: 900 } },
  { name: "launch-mobile", path: "/", viewport: { width: 390, height: 844 } },
  { name: "launch-boundary", path: "/", viewport: { width: 1440, height: 900 }, selector: "#boundary", keyboard: false },
  { name: "launch-handoff", path: "/", viewport: { width: 1440, height: 900 }, selector: "#handoff", keyboard: false },
  { name: "launch-proof", path: "/", viewport: { width: 1440, height: 900 }, selector: "#proof", keyboard: false },
  { name: "launch-close", path: "/", viewport: { width: 1440, height: 900 }, selector: "#get-brace", keyboard: false },
  { name: "guide-desktop", path: "/how-to/", viewport: { width: 1440, height: 900 } },
  { name: "guide-mobile", path: "/how-to/", viewport: { width: 390, height: 844 } },
];

const report = { standard: "WCAG 2.2 AA", generatedAt: new Date().toISOString(), pages: [] };

async function keyboardAudit(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.activeElement?.blur();
  });
  const expected = await page.locator('a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])').count();
  const visited = [];
  const missingIndicator = [];
  for (let index = 0; index < Math.min(expected, 140); index += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        text: String(element.getAttribute("aria-label") || element.textContent || element.value || "").trim().slice(0, 80),
        outlineWidth: Number.parseFloat(style.outlineWidth) || 0,
        outlineStyle: style.outlineStyle,
        boxShadow: style.boxShadow,
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && Number.parseFloat(style.opacity) > 0.1,
      };
    });
    visited.push(`${focused.tag}:${focused.text}`);
    const hasIndicator = focused.outlineWidth >= 2 && focused.outlineStyle !== "none"
      || focused.boxShadow !== "none";
    if (focused.tag !== "body" && !hasIndicator) missingIndicator.push(focused);
  }
  return {
    expected,
    visited: new Set(visited).size,
    missingIndicator,
  };
}

try {
  for (const target of targets) {
    const page = await browser.newPage({ viewport: target.viewport, reducedMotion: "reduce" });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.goto(`${base}${target.path}`, { waitUntil: "networkidle" });
    if (target.selector) {
      await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        window.scrollTo(0, window.scrollY + rect.top + Math.max(0, (rect.height - window.innerHeight) / 2));
      }, target.selector);
      await page.waitForTimeout(500);
    }
    await page.addScriptTag({ path: axePath });
    const axe = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      resultTypes: ["violations"],
    }));
    const structure = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelectorAll("h1").length,
      unlabeledImages: document.querySelectorAll("img:not([alt])").length,
      unlabeledFields: Array.from(document.querySelectorAll("input, select, textarea")).filter((field) => {
        const id = field.id;
        return !field.getAttribute("aria-label") && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) && !field.closest("label");
      }).length,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    }));
    const keyboard = target.viewport.width >= 1000 && target.keyboard !== false ? await keyboardAudit(page) : null;
    report.pages.push({
      ...target,
      violations: axe.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
      })),
      structure,
      keyboard,
      consoleErrors,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

fs.mkdirSync(path.join(root, "lab"), { recursive: true });
fs.writeFileSync(path.join(root, "lab", "accessibility.json"), `${JSON.stringify(report, null, 2)}\n`);
const summary = report.pages.map((page) => ({
  page: page.name,
  violations: page.violations.length,
  overflow: page.structure.horizontalOverflow,
  unlabeledFields: page.structure.unlabeledFields,
  focusFailures: page.keyboard?.missingIndicator.length || 0,
  consoleErrors: page.consoleErrors.length,
}));
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

const failed = report.pages.some((page) =>
  page.violations.length
  || page.structure.h1 !== 1
  || page.structure.unlabeledImages
  || page.structure.unlabeledFields
  || page.structure.horizontalOverflow > 1
  || page.keyboard?.missingIndicator.length
  || page.consoleErrors.length,
);
if (failed) process.exitCode = 1;
