#!/usr/bin/env node
import { chromium } from "playwright-core";

const base = process.env.BRACE_SITE_URL || "http://127.0.0.1:4517";
const executablePath = process.env.SCROLLCRAFT_CHROME || "/usr/bin/google-chrome";
const browser = await chromium.launch({executablePath, headless:true});

const scenarios = [
  {name:"home-desktop", path:"/", viewport:{width:1440,height:900}, maxFcp:5500, maxLcp:6500, maxDom:1600},
  {name:"home-mobile", path:"/", viewport:{width:390,height:844}, maxFcp:4500, maxLcp:5200, maxDom:1600},
  {name:"guide-mobile", path:"/guide/", viewport:{width:390,height:844}, maxFcp:4500, maxLcp:5200, maxDom:2400},
];

const budgets = {
  maxCls: 0.1,
  // CI uses software-rendered headless Chromium; retain a bounded ceiling while
  // separately enforcing transfer, request, DOM, error, and layout-shift gates.
  maxLongTask: 1500,
  maxJsBytes: 450_000,
  maxCssBytes: 450_000,
  maxRequests: 55,
};

const results = [];
try {
  for (const scenario of scenarios) {
    const page = await browser.newPage({viewport:scenario.viewport, reducedMotion:"no-preference"});
    page.setDefaultTimeout(20000);
    const consoleErrors = [];
    const responses = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("response", async (response) => {
      if (!response.url().startsWith(base)) return;
      const headers = await response.allHeaders();
      const size = Number(headers["content-length"] || 0);
      responses.push({url:response.url(), type:response.request().resourceType(), size, status:response.status()});
    });

    await page.addInitScript(() => {
      window.__bracePerf = {cls:0,lcp:0,longTasks:[]};
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__bracePerf.cls += entry.value;
        }).observe({type:"layout-shift", buffered:true});
      } catch {}
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) window.__bracePerf.lcp = last.startTime;
        }).observe({type:"largest-contentful-paint", buffered:true});
      } catch {}
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__bracePerf.longTasks.push(entry.duration);
        }).observe({type:"longtask", buffered:true});
      } catch {}
    });

    await page.goto(`${base}${scenario.path}`, {waitUntil:"networkidle"});
    if (scenario.path === "/") {
      await page.waitForFunction(() => document.documentElement.dataset.braceRuntime === "ready");
    } else {
      await page.waitForFunction(() => document.documentElement.dataset.braceGuideRuntime === "ready");
    }
    await page.waitForTimeout(650);

    const metrics = await page.evaluate(() => {
      const paint = performance.getEntriesByType("paint");
      const fcp = paint.find((entry) => entry.name === "first-contentful-paint")?.startTime || 0;
      const nav = performance.getEntriesByType("navigation")[0];
      const perf = window.__bracePerf || {cls:0,lcp:0,longTasks:[]};
      return {
        fcp,
        lcp:perf.lcp || 0,
        cls:perf.cls || 0,
        maxLongTask:Math.max(0,...(perf.longTasks || [])),
        longTaskCount:(perf.longTasks || []).length,
        domNodes:document.getElementsByTagName("*").length,
        domContentLoaded:nav?.domContentLoadedEventEnd || 0,
        load:nav?.loadEventEnd || 0,
      };
    });

    const jsBytes = responses.filter((item) => item.type === "script").reduce((sum,item) => sum + item.size, 0);
    const cssBytes = responses.filter((item) => item.type === "stylesheet").reduce((sum,item) => sum + item.size, 0);
    const httpErrors = responses.filter((item) => item.status >= 400).map((item) => `${item.status} ${item.url}`);
    const issues = [];
    if (metrics.fcp > scenario.maxFcp) issues.push(`FCP ${Math.round(metrics.fcp)}ms > ${scenario.maxFcp}ms`);
    if (metrics.lcp > scenario.maxLcp) issues.push(`LCP ${Math.round(metrics.lcp)}ms > ${scenario.maxLcp}ms`);
    if (metrics.cls > budgets.maxCls) issues.push(`CLS ${metrics.cls.toFixed(3)} > ${budgets.maxCls}`);
    if (metrics.maxLongTask > budgets.maxLongTask) issues.push(`long task ${Math.round(metrics.maxLongTask)}ms > ${budgets.maxLongTask}ms`);
    if (metrics.domNodes > scenario.maxDom) issues.push(`DOM nodes ${metrics.domNodes} > ${scenario.maxDom}`);
    if (jsBytes > budgets.maxJsBytes) issues.push(`JS transfer ${jsBytes} > ${budgets.maxJsBytes} bytes`);
    if (cssBytes > budgets.maxCssBytes) issues.push(`CSS transfer ${cssBytes} > ${budgets.maxCssBytes} bytes`);
    if (responses.length > budgets.maxRequests) issues.push(`requests ${responses.length} > ${budgets.maxRequests}`);
    if (consoleErrors.length) issues.push(`${consoleErrors.length} console error(s)`);
    if (httpErrors.length) issues.push(`${httpErrors.length} HTTP error(s)`);

    const result = {
      scenario:scenario.name,
      viewport:`${scenario.viewport.width}x${scenario.viewport.height}`,
      ...Object.fromEntries(Object.entries(metrics).map(([key,value]) => [key, typeof value === "number" ? Number(value.toFixed(2)) : value])),
      requests:responses.length,
      jsBytes,
      cssBytes,
      consoleErrors,
      httpErrors,
      issues,
    };
    results.push(result);
    process.stdout.write(`${issues.length ? "FAIL" : "PASS"} performance ${scenario.name} FCP=${Math.round(metrics.fcp)} LCP=${Math.round(metrics.lcp)} CLS=${metrics.cls.toFixed(3)} long=${Math.round(metrics.maxLongTask)}ms requests=${responses.length}\n`);
    await page.close();
  }
} finally {
  await browser.close();
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
if (results.some((result) => result.issues.length)) process.exitCode = 1;
