import { app, BrowserWindow, dialog, protocol } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import log from "electron-log";
import { BraceMemoryService, registerBraceMemoryIpc } from "./memory-service";
import { createSecureAssetResponse } from "./secure-asset-response";

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

const startupStartedAt = Date.now();
const smokeToken = process.argv
  .find((argument) => argument.startsWith("--smoke-token="))
  ?.slice("--smoke-token=".length);
const smokeResultPath = smokeToken && process.env.BRACE_SMOKE_RESULT_PATH
  ? path.resolve(process.env.BRACE_SMOKE_RESULT_PATH)
  : null;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

let mainWindow: BrowserWindow | null = null;
let memoryService: BraceMemoryService | null = null;
let smokeShellReady = false;
let smokeRendererLoaded = false;
let smokeRendererInteractive = false;
let smokeRendererState = "not-loaded";
let smokeFailure: string | null = null;
const smokeConsoleErrors: string[] = [];

log.transports.file.level = "info";
log.info("Starting BRACE local-first memory runtime.");

if (!hasSingleInstanceLock) app.quit();

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

function finishSmokeWhenReady() {
  if (
    !smokeToken ||
    !smokeShellReady ||
    !smokeRendererLoaded ||
    !smokeRendererInteractive ||
    smokeFailure
  ) return;
  if (smokeResultPath) {
    fs.writeFileSync(smokeResultPath, JSON.stringify({
      token: smokeToken,
      shellReady: true,
      rendererLoaded: true,
      rendererInteractive: true,
      rendererState: smokeRendererState,
      loadFailed: false,
      consoleErrors: smokeConsoleErrors,
    }));
  }
  setTimeout(() => app.quit(), 250);
}

function failSmoke(reason: string) {
  if (!smokeToken || smokeFailure) return;
  smokeFailure = reason;
  log.error(`Smoke failed: ${reason}`);
  if (smokeResultPath) {
    fs.writeFileSync(smokeResultPath, JSON.stringify({
      token: smokeToken,
      shellReady: smokeShellReady,
      rendererLoaded: smokeRendererLoaded,
      rendererInteractive: false,
      rendererState: smokeRendererState,
      loadFailed: true,
      renderError: reason,
      consoleErrors: smokeConsoleErrors,
    }));
  }
  setTimeout(() => app.quit(), 250);
}

async function monitorSmokeRenderer() {
  if (!smokeToken || !mainWindow) return;
  const deadline = Date.now() + 30_000;
  while (mainWindow && !mainWindow.isDestroyed() && Date.now() < deadline) {
    try {
      const state = await mainWindow.webContents.executeJavaScript(
        "document.querySelector('[data-brace-state]')?.getAttribute('data-brace-state') || 'missing'",
        true,
      );
      smokeRendererState = typeof state === "string" ? state : "invalid";
      if (smokeRendererState === "ready") {
        smokeRendererInteractive = true;
        log.info(`BRACE interface interactive in ${Date.now() - startupStartedAt}ms.`);
        finishSmokeWhenReady();
        return;
      }
      if (smokeRendererState === "error") {
        failSmoke("The renderer entered its startup error state.");
        return;
      }
    } catch (error) {
      failSmoke(error instanceof Error ? error.message : "Renderer readiness check failed.");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  failSmoke(`The renderer did not become interactive (last state: ${smokeRendererState}).`);
}

function registerAppProtocol() {
  const outputRoot = path.resolve(app.getAppPath(), "out");
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
}

function createWindow() {
  const icon = path.join(
    app.getAppPath(),
    app.isPackaged ? "out" : "public",
    "logo.png",
  );
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    show: false,
    title: "BRACE",
    icon,
    backgroundColor: "#080a0d",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    const allowed =
      process.env.NODE_ENV === "development"
        ? targetUrl.startsWith("http://127.0.0.1:3000/")
        : targetUrl.startsWith("brain://app/");
    if (!allowed) event.preventDefault();
  });
  mainWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );

  mainWindow.once("ready-to-show", () => {
    smokeShellReady = true;
    log.info(`BRACE shell ready in ${Date.now() - startupStartedAt}ms.`);
    if (smokeToken) log.info(`Smoke ready ${smokeToken}`);
    finishSmokeWhenReady();
    mainWindow?.show();
  });
  mainWindow.webContents.once("did-finish-load", () => {
    smokeRendererLoaded = true;
    log.info(`BRACE renderer loaded in ${Date.now() - startupStartedAt}ms.`);
    if (smokeToken) log.info(`Smoke loaded ${smokeToken}`);
    void monitorSmokeRenderer();
  });
  mainWindow.webContents.on("console-message", (event) => {
    if (!smokeToken || event.level !== "error") return;
    smokeConsoleErrors.push(event.message || "Unknown renderer console error");
  });
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    failSmoke(`Preload failed (${preloadPath}): ${error.message}`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    failSmoke(`Renderer process exited: ${details.reason}.`);
  });
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      log.error(
        `Renderer load failed (${errorCode}) ${errorDescription}: ${validatedURL}`,
      );
      if (smokeResultPath && smokeToken) {
        failSmoke(`Renderer load failed (${errorCode}) ${errorDescription}.`);
      }
    },
  );

  if (process.env.NODE_ENV === "development" && !app.isPackaged) {
    void mainWindow.loadURL("http://127.0.0.1:3000");
  } else {
    const indexPath = path.join(app.getAppPath(), "out", "index.html");
    if (fs.existsSync(indexPath)) {
      void mainWindow.loadURL("brain://app/index.html");
    } else {
      dialog.showErrorBox(
        "Application build error",
        `The production interface is missing at ${indexPath}. Reinstall BRACE.`,
      );
    }
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return;
  memoryService = new BraceMemoryService({
    userDataPath: app.getPath("userData"),
    appPath: app.getAppPath(),
    executablePath: process.execPath,
    getWindow: () => mainWindow,
  });
  registerBraceMemoryIpc(memoryService);
  registerAppProtocol();
  createWindow();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  memoryService?.close();
  memoryService = null;
});
