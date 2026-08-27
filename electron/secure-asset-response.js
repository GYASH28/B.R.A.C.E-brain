"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const BASE_POLICY = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'self'",
];

function contentType(filePath) {
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

function inlineScriptHashes(html) {
  const hashes = new Set();
  const scripts = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scripts)) {
    const attributes = match[1] || "";
    const source = match[2] || "";
    if (/\bsrc\s*=/i.test(attributes) || source.length === 0) continue;
    hashes.add(createHash("sha256").update(source, "utf8").digest("base64"));
  }
  return [...hashes];
}

function contentSecurityPolicy(body, mimeType) {
  const hashes = mimeType.startsWith("text/html")
    ? inlineScriptHashes(body.toString("utf8"))
    : [];
  const scriptSources = ["'self'", ...hashes.map((hash) => `'sha256-${hash}'`)];
  return [`script-src ${scriptSources.join(" ")}`, ...BASE_POLICY].join("; ");
}

async function createSecureAssetResponse(filePath) {
  const body = await fs.promises.readFile(filePath);
  const mimeType = contentType(filePath);
  const headers = new Headers({
    "Content-Type": mimeType,
    "Content-Security-Policy": contentSecurityPolicy(body, mimeType),
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  return new Response(body, { status: 200, headers });
}

module.exports = {
  contentSecurityPolicy,
  contentType,
  createSecureAssetResponse,
  inlineScriptHashes,
};
