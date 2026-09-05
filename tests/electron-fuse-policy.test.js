"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { FuseV1Options } = require("@electron/fuses");
const { fusePolicy } = require("../core/electron-fuse-policy");

test("production fuse policy disables debug/environment entry points without breaking MCP", () => {
  const linux = fusePolicy("linux");
  const windows = fusePolicy("win32");
  assert.equal(linux[FuseV1Options.RunAsNode], true);
  assert.equal(linux[FuseV1Options.EnableNodeOptionsEnvironmentVariable], false);
  assert.equal(linux[FuseV1Options.EnableNodeCliInspectArguments], false);
  assert.equal(linux[FuseV1Options.OnlyLoadAppFromAsar], true);
  assert.equal(linux[FuseV1Options.GrantFileProtocolExtraPrivileges], false);
  assert.equal(linux[FuseV1Options.EnableEmbeddedAsarIntegrityValidation], false);
  assert.equal(windows[FuseV1Options.EnableEmbeddedAsarIntegrityValidation], true);
});
