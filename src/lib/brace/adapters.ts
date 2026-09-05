"use client";

import { browserPreviewSnapshot, searchBrowserPreview } from "./browser-preview";
import type { BraceConnector, BraceElectronApi, BraceSnapshot, SearchResponse } from "./types";

export interface BraceRuntimeAdapter {
  readonly environment: "desktop" | "browser-preview";
  api(): BraceElectronApi | undefined;
  snapshot(): Promise<BraceSnapshot>;
  connectors(): Promise<BraceConnector[]>;
  search(query: string, options?: { since?: string | null }): Promise<SearchResponse>;
}

export class ElectronDesktopAdapter implements BraceRuntimeAdapter {
  readonly environment = "desktop" as const;

  api() {
    return window.electron;
  }

  snapshot() {
    const api = this.api();
    if (!api?.getBraceSnapshot) throw new Error("The BRACE desktop bridge is unavailable.");
    return api.getBraceSnapshot();
  }

  connectors() {
    return this.api()?.listBraceConnectors?.() || Promise.resolve([]);
  }

  search(query: string, options?: { since?: string | null }) {
    const api = this.api();
    if (!api?.searchBrace) throw new Error("The BRACE desktop search bridge is unavailable.");
    return api.searchBrace({ query, limit: 30, ...(options?.since ? { since: options.since } : {}) });
  }
}

export class BrowserPreviewAdapter implements BraceRuntimeAdapter {
  readonly environment = "browser-preview" as const;

  api() {
    return undefined;
  }

  snapshot() {
    return Promise.resolve(structuredClone(browserPreviewSnapshot));
  }

  connectors() {
    return Promise.resolve([]);
  }

  search(query: string, options?: { since?: string | null }) {
    return Promise.resolve(searchBrowserPreview(query, options));
  }
}

let selected: BraceRuntimeAdapter | null = null;

export function runtimeAdapter() {
  if (!selected) {
    selected = typeof window !== "undefined" && window.electron
      ? new ElectronDesktopAdapter()
      : new BrowserPreviewAdapter();
  }
  return selected;
}

export function desktopApi() {
  return runtimeAdapter().api();
}
