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
        (button) => button.textContent?.trim() === ${JSON.stringify(text)} &&
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
  await waitFor(window, "document.body.innerText.includes('Your context, ready when AI needs it.')");
  const overview = await screenshot(window, "app-overview");

  pressKey(window, "K", ["control"]);
  await waitFor(window, "document.querySelector('[aria-label=\"Command palette\"]')");
  const commands = await screenshot(window, "app-commands");
  pressKey(window, "Escape");
  await waitFor(window, "!document.querySelector('[aria-label=\"Command palette\"]')");

  pressKey(window, "N", ["control"]);
  await waitFor(window, "document.querySelector('[aria-labelledby=\"quick-capture-title\"]')");
  const capture = await screenshot(window, "app-quick-capture");
  await setInput(window, "#quick-title", "Preserve the verified release checksum");
  await setInput(window, "#quick-content", "Every native release artifact keeps an immutable SHA-256 checksum beside its download link.");
  await clickText(window, "Save memory");
  await waitFor(window, "document.body.innerText.includes('Memory saved locally.') && !document.querySelector('[aria-labelledby=\"quick-capture-title\"]')");

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
  await waitFor(window, "document.body.innerText.includes('Your context, ready when AI needs it.')");
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

  await clickText(window, "Recall");
  await setInput(window, "input[placeholder^='What did we decide']", "canonical source files");
  await window.webContents.executeJavaScript(
    "document.querySelector(\"input[placeholder^='What did we decide']\").closest('form').requestSubmit()",
  );
  await waitFor(window, "document.body.innerText.includes('Source evidence') && document.body.innerText.includes('Architecture Decisions')");
  const recall = await screenshot(window, "app-recall");

  await clickText(window, "Timeline");
  await waitFor(window, "document.body.innerText.includes('Keep imported files canonical')");
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

  const snapshot = service.snapshot();
  const databaseExists = fs.existsSync(service.databasePath);
  const report = {
    profileIsTemporary: service.databasePath.startsWith(userData),
    databaseExists,
    stats: snapshot.stats,
    screenshots: [onboarding, overview, commands, capture, memoryReview, recall, timeline, graph, inbox, aiWorkspace, skills, connections, settings].map((target) =>
      process.env.CI ? path.basename(target) : path.relative(root, target),
    ),
    graphInteraction,
    connectionReady,
    connectionHasWorkspacePath,
    preferenceReady,
    reviewBefore,
    reviewResolved,
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
    reviewBefore !== 1 ||
    !reviewResolved ||
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
