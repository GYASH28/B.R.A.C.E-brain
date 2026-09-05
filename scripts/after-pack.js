"use strict";

const path = require("node:path");
const { flipFuses } = require("@electron/fuses");
const { fusePolicy } = require("../core/electron-fuse-policy");

module.exports = async function afterPack(context) {
  const platform = context.electronPlatformName;
  const productName = context.packager.appInfo.productFilename;
  const executableName = context.packager.executableName;
  const executablePath = platform === "darwin"
    ? path.join(context.appOutDir, `${productName}.app`)
    : platform === "win32"
      ? path.join(context.appOutDir, `${productName}.exe`)
      : path.join(context.appOutDir, executableName);
  await flipFuses(executablePath, fusePolicy(platform));
};
