"use strict";

const fs = require("node:fs");

function inspectJsonConfig(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { exists: false, readable: true, valid: true, value: {}, error: null };
  }
  try {
    const source = fs.readFileSync(filePath, "utf8");
    return {
      exists: true,
      readable: true,
      valid: true,
      value: JSON.parse(source),
      error: null,
    };
  } catch (error) {
    const syntax = error instanceof SyntaxError;
    return {
      exists: true,
      readable: !syntax ? false : true,
      valid: false,
      value: null,
      error: syntax
        ? "The client configuration is not valid JSON."
        : "The client configuration could not be read safely.",
    };
  }
}

function connectorHealth({ id, detected, configured, configState = null }) {
  if (id === "generic") {
    return {
      status: "manual",
      detail: "Use the portable MCP configuration with any compatible client.",
    };
  }
  if (!detected) {
    return {
      status: "client-missing",
      detail: "The client executable is not currently visible to BRACE.",
    };
  }
  if (configState && configState.valid === false) {
    return {
      status: "config-error",
      detail: configState.error || "The client configuration needs attention before BRACE can change it.",
    };
  }
  if (configured) {
    return {
      status: "ready",
      detail: "BRACE is present in this client’s MCP configuration.",
    };
  }
  return {
    status: "needs-setup",
    detail: "The client is installed but BRACE has not been configured yet.",
  };
}

module.exports = {
  connectorHealth,
  inspectJsonConfig,
};
