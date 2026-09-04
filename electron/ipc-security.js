"use strict";

function senderUrl(event) {
  const frameUrl = event?.senderFrame?.url;
  if (typeof frameUrl === "string" && frameUrl) return frameUrl;
  try {
    return String(event?.sender?.getURL?.() || "");
  } catch {
    return "";
  }
}

function isTrustedIpcSender(event, options = {}) {
  const sender = event?.sender;
  const frame = event?.senderFrame;
  if (!sender || !frame) return false;
  if (sender.mainFrame && frame !== sender.mainFrame) return false;
  if (
    options.expectedWebContentsId !== undefined &&
    sender.id !== options.expectedWebContentsId
  ) return false;

  let parsed;
  try {
    parsed = new URL(senderUrl(event));
  } catch {
    return false;
  }

  const development = options.development ?? process.env.NODE_ENV === "development";
  if (development) {
    return parsed.protocol === "http:" &&
      parsed.hostname === "127.0.0.1" &&
      parsed.port === "3000";
  }
  return parsed.protocol === "brain:" && parsed.hostname === "app";
}

function assertTrustedIpcSender(event, options = {}) {
  if (isTrustedIpcSender(event, options)) return;
  const error = new Error("Rejected untrusted BRACE IPC sender.");
  error.code = "BRACE_UNTRUSTED_IPC_SENDER";
  throw error;
}

module.exports = {
  assertTrustedIpcSender,
  isTrustedIpcSender,
  senderUrl,
};
