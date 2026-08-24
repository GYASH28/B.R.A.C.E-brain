import { app, BrowserWindow, dialog, net, protocol } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import log from "electron-log";
import { BraceMemoryService, registerBraceMemoryIpc } from "./memory-service";

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
const hasSingleInstanceLock = app.requestSingleInstanceLock();

let mainWindow: BrowserWindow | null = null;
let memoryService: BraceMemoryService | null = null;
let smokeShellReady = false;
let smokeRendererLoaded = false;

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
  if (!smokeToken || !smokeShellReady || !smokeRendererLoaded) return;
  setTimeout(() => app.quit(), 250);
}

function contentType(filePath: string) {
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    }[path.extname(filePath).toLowerCase()] || "application/octet-stream"
  );
}

async function serveAsset(filePath: string) {
  const response = await net.fetch(pathToFileURL(filePath).toString());
  const headers = new Headers(response.headers);
  headers.set("Content-Type", contentType(filePath));
  headers.set(
    "Content-Security-Policy",
    "default-src 'self' brain:; script-src 'self' brain:; style-src 'self' brain: 'unsafe-inline'; img-src 'self' brain: data: blob:; font-src 'self' brain: data:; connect-src 'self' brain:; object-src 'none'; frame-src 'none'; worker-src 'self' brain: blob:; base-uri 'none'; form-action 'self'",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function registerAppProtocol() {
  const outputRoot = path.resolve(app.getAppPath(), "out");
  protocol.handle("brain", (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname || "/index.html");
    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const candidate = path.resolve(outputRoot, pathname.replace(/^\/+/, ""));
    let filePath =
      candidate.startsWith(`${outputRoot}${path.sep}`) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
        ? candidate
        : path.join(outputRoot, "index.html");
    return serveAsset(filePath);
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
    finishSmokeWhenReady();
  });
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      log.error(
        `Renderer load failed (${errorCode}) ${errorDescription}: ${validatedURL}`,
      );
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
