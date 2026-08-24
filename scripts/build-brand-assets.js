#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const sourceSvgPath = path.join(
  root,
  "assets",
  "brand",
  "brace-app-icon.svg",
);
const publicSvgPath = path.join(root, "public", "logo.svg");
const publicPngPath = path.join(root, "public", "logo.png");
const faviconPath = path.join(root, "public", "favicon.ico");
const brandIcoPath = path.join(
  root,
  "assets",
  "brand",
  "brace-app-icon.ico",
);

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(images.length * 16);
  let offset = 6 + directory.length;
  images.forEach(({ size, data }, index) => {
    const entryOffset = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    directory.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    directory.writeUInt8(0, entryOffset + 2);
    directory.writeUInt8(0, entryOffset + 3);
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(data.length, entryOffset + 8);
    directory.writeUInt32LE(offset, entryOffset + 12);
    offset += data.length;
  });
  return Buffer.concat([header, directory, ...images.map((image) => image.data)]);
}

async function renderPng(svg, size) {
  return sharp(svg, { density: 384 })
    .resize(size, size, {
      fit: "contain",
      kernel: sharp.kernel.lanczos3,
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: false,
    })
    .toBuffer();
}

async function main() {
  const svg = fs.readFileSync(sourceSvgPath);
  fs.copyFileSync(sourceSvgPath, publicSvgPath);

  const png1024 = await renderPng(svg, 1024);
  fs.writeFileSync(publicPngPath, png1024);
  fs.writeFileSync(
    path.join(root, "public", "apple-touch-icon.png"),
    await renderPng(svg, 180),
  );
  fs.writeFileSync(
    path.join(root, "public", "icon-192.png"),
    await renderPng(svg, 192),
  );
  fs.writeFileSync(
    path.join(root, "public", "icon-512.png"),
    await renderPng(svg, 512),
  );

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoImages = await Promise.all(
    icoSizes.map(async (size) => ({
      size,
      data: await renderPng(svg, size),
    })),
  );
  const ico = buildIco(icoImages);
  fs.writeFileSync(faviconPath, ico);
  fs.writeFileSync(brandIcoPath, ico);

  process.stdout.write(
    `${JSON.stringify(
      {
        source: sourceSvgPath,
        png: publicPngPath,
        ico: brandIcoPath,
        sizes: icoSizes,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Brand asset build failed: ${error.message}\n`);
  process.exitCode = 1;
});
