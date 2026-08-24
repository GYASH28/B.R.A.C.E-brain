"use strict";

const os = require("node:os");
const path = require("node:path");

function assertSpecificDirectory(value, label) {
  const resolved = path.resolve(String(value || ""));
  if (!value || resolved === path.parse(resolved).root) {
    throw new Error(`${label} must be a specific directory.`);
  }
  return resolved;
}

function defaultDataRoot(options = {}) {
  const platform = options.platform || process.platform;
  const environment = options.environment || process.env;
  const home = options.home || os.homedir();
  if (environment.BRACE_DATA_DIR) {
    return assertSpecificDirectory(environment.BRACE_DATA_DIR, "BRACE_DATA_DIR");
  }
  if (platform === "win32") {
    return path.join(environment.APPDATA || path.join(home, "AppData", "Roaming"), "BRACE");
  }
  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "BRACE");
  }
  return path.join(environment.XDG_DATA_HOME || path.join(home, ".local", "share"), "brace");
}

function databasePath(options = {}) {
  const environment = options.environment || process.env;
  if (environment.BRACE_DATABASE_PATH) {
    const resolved = path.resolve(environment.BRACE_DATABASE_PATH);
    if (resolved === path.parse(resolved).root) {
      throw new Error("BRACE_DATABASE_PATH must name a database file.");
    }
    return resolved;
  }
  return path.join(defaultDataRoot(options), "brace.sqlite3");
}

module.exports = {
  assertSpecificDirectory,
  databasePath,
  defaultDataRoot,
};
