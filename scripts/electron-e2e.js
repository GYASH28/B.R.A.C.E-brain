#!/usr/bin/env node

"use strict";

const { app, BrowserWindow, protocol } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { createSecureAssetResponse } = require("../electron/secure-asset-response");

const root = path.resolve(__dirname, "..");
if (!process.env.BRACE_E2E_USER_DATA) {
  throw new Error("Launch Electron E2E through scripts/electron-e2e-runner.js.");
}
const userData = path.resolve(process.env.BRACE_E2E_USER_DATA);
const screenshotDirectory = process.env.CI
  ? path.join(userData, "screenshots")
  : path.join(root, "artifacts", "screenshots");
let activeService = null;
let activeWindow = null;
const { BraceMemoryService, registerBraceMemoryIpc } = require(
  path.join(root, "dist", "electron", "memory-service.js"),
);

app.setPath("userData", userData);
app.commandLine.appendSwitch("force-device-scale-factor", "1");
if (process.platform === "linux" && process.env.CI) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
}
protocol.registerSchemesAsPrivileged([
  {
    scheme: "brain",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  },
]);

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(window, expression, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) {
      return;
    }
    await wait(100);
  }
  const visible = await window.webContents.executeJavaScript(
    "document.body?.innerText?.slice(0, 3000) || ''",
  );
  throw new Error(`Timed out waiting for ${expression}\nVisible UI:\n${visible}`);
}

async function clickText(window, text) {
  const clicked = await window.webContents.executeJavaScript(`
    (() => {
      const target = Array.from(document.querySelectorAll('button')).find(
        (button) => (button.textContent?.trim() === ${JSON.stringify(text)} ||
          Array.from(button.children).some((child) => child.textContent?.trim() === ${JSON.stringify(text)})) &&
          button.getBoundingClientRect().width > 0
      );
      target?.click();
      return Boolean(target);
    })()
  `);
  if (!clicked) throw new Error(`Could not find visible button: ${text}`);
}

async function setInput(window, selector, value) {
  const changed = await window.webContents.executeJavaScript(`
    (() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input) return false;
      const prototype = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(
        input,
        ${JSON.stringify(value)},
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()
  `);
  if (!changed) throw new Error(`Could not find input: ${selector}`);
}

async function screenshot(window, name) {
  await window.webContents.executeJavaScript(`
    (() => {
      document.querySelector('.brace-main')?.scrollTo({ top: 0, behavior: 'instant' });
      document.querySelector('.brace-sidebar nav')?.scrollTo({ top: 0, behavior: 'instant' });
    })()
  `);
  await window.webContents.executeJavaScript("document.fonts?.ready || Promise.resolve()", true);
  await wait(1_200);
  let image;
  let captureError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      window.webContents.invalidate();
      image = await window.webContents.capturePage();
      if (!image.isEmpty()) break;
    } catch (error) {
      captureError = error;
    }
    await wait(250 * (attempt + 1));
  }
  if (!image || image.isEmpty()) {
    throw captureError || new Error(`Electron returned an empty screenshot for ${name}.`);
  }
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  const target = path.join(screenshotDirectory, `${name}.png`);
  fs.writeFileSync(target, image.toPNG());
  return target;
}

function pressKey(window, keyCode, modifiers = []) {
  window.webContents.sendInputEvent({ type: "keyDown", keyCode, modifiers });
  window.webContents.sendInputEvent({ type: "keyUp", keyCode, modifiers });
}

async function run() {
  const consoleErrors = [];
  const outputRoot = path.join(root, "out");
  protocol.handle("brain", (request) => {
    const url = new URL(request.url);
    if (url.hostname !== "app") {
      return new Response("Not found", { status: 404 });
    }
    let pathname = decodeURIComponent(url.pathname || "/index.html");
    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const candidate = path.resolve(outputRoot, pathname.replace(/^\/+/, ""));
    const filePath =
      candidate.startsWith(`${outputRoot}${path.sep}`) &&
      fs.existsSync(candidate)
        ? candidate
        : path.join(outputRoot, "index.html");
    return createSecureAssetResponse(filePath);
  });

  let window = null;
  const service = new BraceMemoryService({
    userDataPath: userData,
    dataRoot: path.join(userData, "brace-data"),
    executablePath: process.platform === "win32"
      ? "C:\\Program Files\\BRACE\\BRACE.exe"
      : "/opt/BRACE/brace",
    appPath: root,
    getWindow: () => window,
  });
  registerBraceMemoryIpc(service);
  activeService = service;

  window = new BrowserWindow({
    width: 1440,
    height: 960,
    useContentSize: true,
    show: false,
    backgroundColor: "#080a0d",
    webPreferences: {
      preload: path.join(root, "dist", "electron", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });
  activeWindow = window;
  window.webContents.on("console-message", (event) => {
    const level = event?.level;
    if (level === "error" || level === 3) consoleErrors.push(event.message);
  });

  await window.loadURL("brain://app/index.html");
  window.showInactive();
  await waitFor(window, "document.body.innerText.includes('Stop re-explaining your work')");
  const onboarding = await screenshot(window, "app-onboarding");
  await clickText(window, "Explore synthetic demo");
  await waitFor(window, "document.body.innerText.includes('Continue from what mattered.')");
  const overview = await screenshot(window, "app-overview");

  pressKey(window, "K", ["control"]);
  await waitFor(window, "document.querySelector('[aria-label=\"Command palette\"]')");
  const commands = await screenshot(window, "app-commands");
  pressKey(window, "Escape");
  await waitFor(window, "!document.querySelector('[aria-label=\"Command palette\"]')");

  pressKey(window, "N", ["control"]);
  await waitFor(window, "document.querySelector('[aria-labelledby=\"quick-capture-title\"]')");
  await setInput(window, "#quick-title", "Preserve the verified release checksum");
  await setInput(window, "#quick-content", "Every native release artifact keeps an immutable SHA-256 checksum beside its download link.");
  await setInput(window, "#quick-tags", "release, verification");
  await wait(300);
  await clickText(window, "Close");
  await waitFor(window, "!document.querySelector('[aria-labelledby=\"quick-capture-title\"]')");
  pressKey(window, "N", ["control"]);
  await waitFor(window, "document.querySelector('#quick-title')?.value === 'Preserve the verified release checksum' && document.body.innerText.includes('Session draft restored')");
  const draftRecovered = await window.webContents.executeJavaScript("document.querySelector('#quick-tags')?.value === 'release, verification'");
  const capture = await screenshot(window, "app-quick-capture");
  await clickText(window, "Save memory");
  await waitFor(window, "document.body.innerText.includes('Memory saved locally.') && !document.querySelector('[aria-labelledby=\"quick-capture-title\"]') && !sessionStorage.getItem('brace.capture-draft')");

  service.store.createMemory({
    kind: "procedure",
    scope: "global",
    title: "Verify each release checksum before install",
    summary: "Compare each downloaded artifact with its published SHA-256 checksum.",
    content: "Compare each downloaded release artifact with the published SHA-256 checksum before installation.",
  });
  service.store.createMemory({
    kind: "procedure",
    scope: "global",
    title: "Verify every release checksum before install",
    summary: "Compare every downloaded artifact with its published SHA-256 checksum.",
    content: "Compare every downloaded release artifact with the published SHA-256 checksum before installation.",
  });
  await window.reload();
  await waitFor(window, "document.body.innerText.includes('Continue from what mattered.')");
  await clickText(window, "Memory");
  await window.webContents.executeJavaScript(
    "document.querySelector('button[aria-label=\"Open memory review queue\"]')?.click()",
  );
  await waitFor(window, "document.body.innerText.includes('Possible overlap') && document.body.innerText.includes('Keep both as distinct')");
  const memoryReview = await screenshot(window, "app-memory-review");
  const reviewBefore = service.snapshot().memoryQuality.pendingReview;
  await clickText(window, "Keep both as distinct");
  await waitFor(window, "document.body.innerText.includes('Review queue is clear.') && document.body.innerText.includes('intentionally distinct')");
  const reviewResolved = service.snapshot().memoryQuality.pendingReview === 0 &&
    service.store.listTimeline().some((event) => event.eventType === "memory.reviewed");

  await clickText(window, "Memory");
  await waitFor(window, "document.querySelector('.memory-toolbelt')");
  await setInput(window, ".memory-toolbelt input", "checksum");
  await waitFor(window, "document.querySelector('.memory-result-line')?.textContent?.includes('3 of')");
  const memoryFilteringReady = await window.webContents.executeJavaScript("document.querySelectorAll('.brace-memory-card').length === 3");
  const memoryLibrary = await screenshot(window, "app-memory-library");
  await window.webContents.executeJavaScript("document.querySelector('.brace-memory-card')?.click()");
  await waitFor(window, "document.body.innerText.includes('Copy memory') && document.body.innerText.includes('Find related context')");
  await clickText(window, "Pin for daily use");
  await waitFor(window, "document.body.innerText.includes('Unpin memory')");
  const pinningReady = service.snapshot().stats.pinnedMemories === 1;
  await clickText(window, "Copy memory");
  await waitFor(window, "document.body.innerText.includes('Copied')");
  await clickText(window, "Find related context");
  await waitFor(window, "document.body.innerText.includes('Source evidence')");

  await clickText(window, "Recall");
  await setInput(window, "input[placeholder^='What did we decide']", "canonical source files");
  await window.webContents.executeJavaScript(
    "document.querySelector(\"input[placeholder^='What did we decide']\").closest('form').requestSubmit()",
  );
  await waitFor(window, "document.body.innerText.includes('Source evidence') && document.body.innerText.includes('Architecture Decisions')");
  const recall = await screenshot(window, "app-recall");

  await clickText(window, "Timeline");
  await waitFor(window, "document.body.innerText.includes('Keep imported files canonical')");
  await setInput(window, ".timeline-toolbelt input", "canonical");
  await clickText(window, "Decisions");
  await waitFor(window, "document.querySelector('.timeline-toolbelt>span')?.textContent?.trim() === '1 events'");
  const timelineFilteringReady = await window.webContents.executeJavaScript("document.querySelectorAll('.brace-timeline-card article').length === 1");
  const timeline = await screenshot(window, "app-timeline");

  await clickText(window, "Knowledge map");
  await waitFor(window, "document.querySelector('svg[aria-label*=\"knowledge nodes\"]')");
  const graphInteraction = await window.webContents.executeJavaScript(`
    (async () => {
      const source = document.querySelector('.graph-node[aria-label^="source:"]');
      const zoom = document.querySelector('button[aria-label="Zoom in"]');
      if (!source || !zoom) return { selectedSource: false, zoomed: false };
      source.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      zoom.click();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const selectedSource = document.querySelector('.graph-inspector-type')?.textContent?.trim().toLowerCase() === 'source';
      const beforeKeyboard = document.querySelector('.graph-node.is-selected')?.getAttribute('aria-label');
      document.querySelector('.graph-node.is-selected')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 120));
      const afterKeyboard = document.querySelector('.graph-node.is-selected')?.getAttribute('aria-label');
      const presetResults = {};
      for (const preset of ['Rings', 'Living', 'Orbit', 'Flow', 'Chronicle']) {
        Array.from(document.querySelectorAll('.graph-layout button')).find((button) => button.textContent?.trim() === preset)?.click();
        await new Promise((resolve) => setTimeout(resolve, 120));
        presetResults[preset.toLowerCase()] =
          document.querySelector('.graph-layout button[aria-pressed="true"]')?.textContent?.trim() === preset &&
          document.querySelector('.graph-svg')?.getAttribute('data-preset') === preset.toLowerCase();
      }
      return {
        selectedSource,
        zoomed: document.querySelector('.graph-zoom span')?.textContent?.trim() === '112%',
        keyboardTravel: Boolean(beforeKeyboard && afterKeyboard && beforeKeyboard !== afterKeyboard),
        presets: presetResults,
      };
    })()
  `);
  await window.webContents.executeJavaScript(`
    (() => {
      Array.from(document.querySelectorAll('.graph-layout button')).find((button) => button.textContent?.trim() === 'Orbit')?.click();
      document.querySelector('button[aria-label="Reset zoom"]')?.click();
    })()
  `);
  const graph = await screenshot(window, "app-graph");

  await clickText(window, "Inbox");
  await waitFor(window, "document.body.innerText.includes('Catch a thought') && document.body.innerText.includes('Review queue')");
  const inbox = await screenshot(window, "app-inbox");

  await clickText(window, "AI Workspace");
  await waitFor(window, "document.body.innerText.includes('Every turn has a visible boundary') && document.body.innerText.includes('History is not memory')");
  const aiWorkspace = await screenshot(window, "app-ai-workspace");

  await clickText(window, "Skills");
  await waitFor(window, "document.body.innerText.includes('Decision Journal') && document.querySelectorAll('[role=switch]').length === 2");
  const skills = await screenshot(window, "app-skills");

  await clickText(window, "Automations");
  await waitFor(window, "document.body.innerText.includes('Automation studio') && document.body.innerText.includes('No recipes yet')");
  await clickText(window, "Create automation");
  await waitFor(window, "document.querySelector('.automation-builder') && document.body.innerText.includes('Make BRACE work while you work.')");
  await setInput(window, ".automation-builder-identity input", "Release memory health check");
  await setInput(window, ".automation-builder-identity textarea", "Inspect local memory quality before a release without changing memory.");
  await clickText(window, "Create paused");
  await waitFor(window, "!document.querySelector('.automation-builder') && document.body.innerText.includes('Release memory health check')");
  await clickText(window, "Preview");
  await waitFor(window, "document.body.innerText.includes('Preview completed without changing memory.') && document.body.innerText.includes('preview')");
  await window.webContents.executeJavaScript("document.querySelector('.automation-master-switch')?.click()");
  await waitFor(window, "document.querySelector('.automation-master-switch')?.getAttribute('aria-checked') === 'true'");
  await clickText(window, "Run now");
  await waitFor(window, "document.body.innerText.includes('Automation finished with status: success.')");
  await window.webContents.executeJavaScript("document.querySelector('.automation-run-summary')?.click()");
  await waitFor(window, "document.querySelector('.automation-run.is-expanded') && document.body.innerText.includes('RECIPE SNAPSHOT')");
  const automations = await screenshot(window, "app-automations");

  await clickText(window, "Connections");
  await waitFor(window, "document.body.innerText.includes('Portable MCP configuration') && document.body.innerText.includes('Read-only by default') && document.body.innerText.includes('Codex CLI')");
  const connectionMarker = process.platform === "win32" ? "BRACE_MCP_DIRECT" : "--mcp";
  const connectionReady = await window.webContents.executeJavaScript(
    `document.body.innerText.includes(${JSON.stringify(connectionMarker)})`,
  );
  const connectionHasWorkspacePath = await window.webContents.executeJavaScript(
    `document.body.innerText.includes(${JSON.stringify(root)})`,
  );
  const connections = await screenshot(window, "app-connections");

  await clickText(window, "Settings");
  await waitFor(window, "document.body.innerText.includes('Make the workspace fit you')");
  await clickText(window, "Compact");
  const preferenceReady = await window.webContents.executeJavaScript("document.documentElement.dataset.density === 'compact' && JSON.parse(localStorage.getItem('brace.ui')).density === 'compact'");
  const settings = await screenshot(window, "app-settings");
  pressKey(window, "Left", ["alt"]);
  await waitFor(window, "document.body.innerText.includes('Portable MCP configuration')");
  pressKey(window, "Right", ["alt"]);
  await waitFor(window, "document.body.innerText.includes('Make the workspace fit you')");
  const navigationReady = await window.webContents.executeJavaScript("document.querySelector('button[aria-label=\"Go to previous workspace\"]:not(:disabled)') !== null && localStorage.getItem('brace.last-view') === 'settings'");
  await clickText(window, "Memory");
  window.setContentSize(760, 900);
  await waitFor(window, "document.querySelector('.memory-toolbelt') && window.innerWidth === 760 && Math.abs(parseFloat(getComputedStyle(document.querySelector('.brace-sidebar')).width) - 76) < 1");
  const responsiveMetrics = await window.webContents.executeJavaScript("({ viewport: window.innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, sidebarWidth: parseFloat(getComputedStyle(document.querySelector('.brace-sidebar')).width) })");
  const responsiveReady = responsiveMetrics.documentWidth <= responsiveMetrics.viewport + 1 && responsiveMetrics.bodyWidth <= responsiveMetrics.viewport + 1 && Math.abs(responsiveMetrics.sidebarWidth - 76) < 1;
  const responsive = await screenshot(window, "app-responsive");
  window.setContentSize(1440, 960);

  const snapshot = service.snapshot();
  const databaseExists = fs.existsSync(service.databasePath);
  const report = {
    profileIsTemporary: service.databasePath.startsWith(userData),
    databaseExists,
    stats: snapshot.stats,
    screenshots: [onboarding, overview, commands, capture, memoryReview, memoryLibrary, recall, timeline, graph, inbox, aiWorkspace, skills, automations, connections, settings, responsive].map((target) =>
      process.env.CI ? path.basename(target) : path.relative(root, target),
    ),
    graphInteraction,
    connectionReady,
    connectionHasWorkspacePath,
    preferenceReady,
    draftRecovered,
    memoryFilteringReady,
    timelineFilteringReady,
    pinningReady,
    navigationReady,
    responsiveMetrics,
    responsiveReady,
    reviewBefore,
    reviewResolved,
    automationReady: snapshot.stats.automations === 1 &&
      snapshot.stats.enabledAutomations === 1 &&
      snapshot.stats.automationRuns === 2 &&
      snapshot.automations?.runs.some((run) => run.status === "preview") &&
      snapshot.automations?.runs.some((run) => run.status === "success"),
    consoleErrors,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (
    !report.profileIsTemporary ||
    !databaseExists ||
    snapshot.stats.projects !== 1 ||
    snapshot.stats.memories !== 6 ||
    snapshot.stats.decisions !== 1 ||
    !graphInteraction.selectedSource ||
    !graphInteraction.zoomed ||
    !graphInteraction.keyboardTravel ||
    !Object.values(graphInteraction.presets || {}).every(Boolean) ||
    Object.keys(graphInteraction.presets || {}).length !== 5 ||
    !connectionReady ||
    connectionHasWorkspacePath ||
    !preferenceReady ||
    !draftRecovered ||
    !memoryFilteringReady ||
    !timelineFilteringReady ||
    !pinningReady ||
    !navigationReady ||
    !responsiveReady ||
    reviewBefore !== 1 ||
    !reviewResolved ||
    !report.automationReady ||
    consoleErrors.length
  ) {
    process.exitCode = 1;
  }
}

app.whenReady().then(async () => {
  try {
    await run();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  } finally {
    try { activeService?.close(); } catch {}
    try { activeWindow?.destroy(); } catch {}
    activeService = null;
    activeWindow = null;
    app.exit(process.exitCode || 0);
  }
});
