"use strict";

const fs = require("node:fs");

const IGNORED_PARTS = new Set([
  ".git", ".hg", ".svn", ".next", ".nuxt", ".cache", ".turbo",
  "node_modules", "vendor", "dist", "build", "coverage", "target", "tmp", "temp",
]);
const IGNORED_SUFFIXES = ["~", ".tmp", ".swp", ".swo", ".part", ".crdownload"];

function relevantFile(filename) {
  if (!filename) return true;
  const normalized = String(filename).replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => IGNORED_PARTS.has(part) || part.startsWith(".~"))) return false;
  return !IGNORED_SUFFIXES.some((suffix) => normalized.toLowerCase().endsWith(suffix));
}

class ProjectWatchService {
  constructor(options = {}) {
    if (typeof options.onChange !== "function") throw new Error("ProjectWatchService requires onChange.");
    this.onChange = options.onChange;
    this.onError = typeof options.onError === "function" ? options.onError : () => {};
    this.debounceMs = Math.min(60_000, Math.max(1_000, Number(options.debounceMs) || 4_000));
    this.entries = new Map();
    this.resourcePaused = false;
  }

  enable(project) {
    const id = String(project?.id || "");
    const rootPath = fs.realpathSync(String(project?.rootPath || ""));
    if (!id || !fs.statSync(rootPath).isDirectory()) throw new Error("Choose a valid indexed project to watch.");
    this.disable(id);
    const entry = { id, rootPath, timer: null, running: false, pending: false, watcher: null };
    entry.watcher = fs.watch(rootPath, { recursive: true, persistent: false }, (_eventType, filename) => {
      if (!relevantFile(filename)) return;
      entry.pending = true;
      if (this.resourcePaused || entry.running) return;
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => void this.flush(entry), this.debounceMs);
      entry.timer.unref?.();
    });
    entry.watcher.on("error", (error) => this.onError(id, error));
    this.entries.set(id, entry);
    return { enabled: true, projectId: id };
  }

  async flush(entry) {
    if (!entry.pending || entry.running || this.resourcePaused || !this.entries.has(entry.id)) return;
    entry.pending = false;
    entry.running = true;
    entry.timer = null;
    try {
      await this.onChange(entry.id);
    } catch (error) {
      this.onError(entry.id, error);
    } finally {
      entry.running = false;
      if (entry.pending && !this.resourcePaused) {
        entry.timer = setTimeout(() => void this.flush(entry), this.debounceMs);
        entry.timer.unref?.();
      }
    }
  }

  disable(id) {
    const entry = this.entries.get(String(id || ""));
    if (!entry) return false;
    if (entry.timer) clearTimeout(entry.timer);
    entry.watcher?.close();
    this.entries.delete(entry.id);
    return true;
  }

  setResourcePaused(paused) {
    this.resourcePaused = Boolean(paused);
    if (!this.resourcePaused) {
      for (const entry of this.entries.values()) if (entry.pending) void this.flush(entry);
    }
  }

  status(id) {
    const entry = this.entries.get(String(id || ""));
    return { enabled: Boolean(entry), resourcePaused: this.resourcePaused, pending: Boolean(entry?.pending), running: Boolean(entry?.running) };
  }

  close() {
    for (const id of [...this.entries.keys()]) this.disable(id);
  }
}

module.exports = { ProjectWatchService, relevantFile };
