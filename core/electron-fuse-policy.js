"use strict";

const { FuseVersion, FuseV1Options } = require("@electron/fuses");

function fusePolicy(platform) {
  const integritySupported = platform === "win32" || platform === "darwin";
  return {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,
    // Required by the packaged Windows MCP stdio entry point. The Linux and
    // macOS app modes do not set ELECTRON_RUN_AS_NODE.
    [FuseV1Options.RunAsNode]: true,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: integritySupported,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    // BRACE serves the renderer through brain:// and never grants file:// pages.
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    [FuseV1Options.WasmTrapHandlers]: true,
  };
}

module.exports = { fusePolicy };
