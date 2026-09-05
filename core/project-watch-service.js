"use strict";

const fs = require("node:fs");
const path = require("node:path");

const IGNORED_PARTS = new Set([
  ".git", ".hg", ".svn", ".next", ".nuxt", ".cache", ".turbo",
  "node_modules", "vendor", "dist", "build", "coverage", "target", "tmp", "temp",
]);
const IGNORED_SUFFIXES = ["~", ".tmp", ".swp", ".swo", ".part", ".crdownload"];
const MAX_WINDOWS_WATCH_DIRECTORIES = 2_048;

function relevantFile(filename) {
  if (!filename) return true;
  const normalized = String(filename).replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => IGNORED_PARTS.has(part) || part.startsWith(".~"))) return false;
  return !IGNORED_SUFFIXES.some((suffix) => normalized.toLowerCase().endsWith(suffix));
}

function watchModeForPlatform(platform) {
  return platform === "win32" ? "directory-tree" : "native-recursive";
}

function windowsWatchDirectories(rootPath) {
  const directories = [];
  const queue = [rootPath];
  for (let cursor = 0; cursor < queue.length && directories.length < MAX_WINDOWS_WATCH_DIRECTORIES; cursor += 1) {
    const directory = queue[cursor];
    directories.push(directory);
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const child = path.join(directory, entry.name);
      const relative = path.relative(rootPath, child);
      if (relevantFile(relative)) queue.push(child);
    }
  }
  return directories;
}

function createWatcher(rootPath, onEvent, onError, platform = process.platform) {
  if (watchModeForPlatform(platform) === "native-recursive") {
    const watcher = fs.watch(rootPath, { recursive: true, persistent: false }, (_eventType, filename) => {
      onEvent(filename == null ? "" : String(filename));
    });
    watcher.on("error", onError);
    return watcher;
  }

  // libuv's recursive Windows watcher can abort Node 24 for valid path/casing
  // combinations. A bounded set of ordinary directory watches fails through
  // JavaScript errors instead of terminating the process.
  const watchers = [];
  for (const directory of windowsWatchDirectories(rootPath)) {
    try {
      const watcher = fs.watch(directory, { recursive: false, persistent: false }, (_eventType, filename) => {
        const changed = filename == null ? directory : path.join(directory, String(filename));
        onEvent(path.relative(rootPath, changed));
      });
      watcher.on("error", onError);
      watchers.push(watcher);
    } catch (error) {
      onError(error);
    }
  }
  return {
    close() {
      for (const watcher of watchers) watcher.close();
    },
  };
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
    const onEvent = (filename) => {
      if (!relevantFile(filename)) return;
      entry.pending = true;
      if (this.resourcePaused || entry.running) return;
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => void this.flush(entry), this.debounceMs);
      entry.timer.unref?.();
    };
    entry.watcher = createWatcher(rootPath, onEvent, (error) => this.onError(id, error));
    entry.onEvent = onEvent;
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
      if (process.platform === "win32" && this.entries.has(entry.id)) {
        entry.watcher?.close();
        entry.watcher = createWatcher(entry.rootPath, entry.onEvent, (error) => this.onError(entry.id, error));
      }
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

module.exports = { ProjectWatchService, relevantFile, watchModeForPlatform, windowsWatchDirectories };
