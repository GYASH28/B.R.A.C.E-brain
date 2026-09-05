import type { IpcMainInvokeEvent } from "electron";

export interface RendererTrustPolicy {
  development: boolean;
}

export function isTrustedRendererUrl(value: string, policy: RendererTrustPolicy) {
  try {
    const url = new URL(value);
    if (url.protocol === "brain:" && url.hostname === "app") return true;
    return policy.development &&
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.port === "3000";
  } catch {
    return false;
  }
}

/**
 * Reject privileged calls from subframes and every origin other than BRACE's
 * packaged renderer or its exact loopback development origin.
 */
export function assertTrustedIpcSender(
  event: IpcMainInvokeEvent,
  policy: RendererTrustPolicy = { development: process.env.NODE_ENV === "development" },
) {
  const frame = event.senderFrame;
  if (frame && frame.top !== frame) {
    throw new Error("BRACE rejected a privileged request from an embedded frame.");
  }
  const senderUrl = frame?.url || event.sender.getURL();
  if (!isTrustedRendererUrl(senderUrl, policy)) {
    throw new Error("BRACE rejected a privileged request from an untrusted renderer.");
  }
}
