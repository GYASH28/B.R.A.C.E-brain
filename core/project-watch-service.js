"use strict";

const fs = require("node:fs");
const path = require("node:path");

const IGNORED_PARTS = new Set([
  ".git", ".hg", ".svn", ".next", ".nuxt", ".cache", ".turbo",
  "node_modules", "vendor", "dist", "build", "coverage", "target", "tmp", "temp",
]);
const IGNORED_SUFFIXES = ["~", ".tmp", ".swp", ".swo", ".part", ".crdownload"];
const MAX_WINDOWS_WATCH_ENTRIES = 20_000;

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

function projectTreeStamp(rootPath) {
  const queue = [rootPath];
  let hash = 2_166_136_261;
  let count = 0;
  const mix = (value) => {
    for (const character of value) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16_777_619) >>> 0;
    }
  };
  for (let cursor = 0; cursor < queue.length && count < MAX_WINDOWS_WATCH_ENTRIES; cursor += 1) {
    const directory = queue[cursor];
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
    } catch {
      continue;
    }
    for (const entry of entries) {
      const child = path.join(directory, entry.name);
      const relative = path.relative(rootPath, child);
      if (!relevantFile(relative) || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) queue.push(child);
      let stats;
      try {
        stats = fs.statSync(child);
      } catch {
        continue;
      }
      count += 1;
      mix(`${relative.replaceAll("\\", "/")}|${entry.isDirectory() ? "d" : "f"}|${stats.size}|${stats.mtimeMs};`);
      if (count >= MAX_WINDOWS_WATCH_ENTRIES) break;
    }
  }
  return `${count}:${hash}`;
}

function createWatcher(rootPath, onEvent, onError, platform = process.platform, pollMs = 800) {
  if (watchModeForPlatform(platform) === "native-recursive") {
    const watcher = fs.watch(rootPath, { recursive: true, persistent: false }, (_eventType, filename) => {
      onEvent(filename == null ? "" : String(filename));
    });
    watcher.on("error", onError);
    return watcher;
  }

  // libuv file events can abort Node 24 on Windows for valid path/casing
  // combinations before JavaScript can catch the error. Bounded metadata
  // polling avoids that native crash and never reads project file contents.
  let previous;
  try {
    previous = projectTreeStamp(rootPath);
  } catch (error) {
    onError(error);
    previous = "";
  }
  const timer = setInterval(() => {
    try {
      const next = projectTreeStamp(rootPath);
      if (next !== previous) {
        previous = next;
        onEvent("");
      }
    } catch (error) {
      onError(error);
    }
  }, pollMs);
  timer.unref?.();
  return {
    close() {
      clearInterval(timer);
    },
  };
}

class ProjectWatchService {
  constructor(options = {}) {
    if (typeof options.onChange !== "function") throw new Error("ProjectWatchService requires onChange.");
    this.onChange = options.onChange;
    this.onError = typeof options.onError === "function" ? options.onError : () => {};
    this.debounceMs = Math.min(60_000, Math.max(1_000, Number(options.debounceMs) || 4_000));
    this.platform = options.platform || process.platform;
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
    const pollMs = Math.max(100, Math.min(1_000, Math.floor(this.debounceMs / 5)));
    entry.watcher = createWatcher(rootPath, onEvent, (error) => this.onError(id, error), this.platform, pollMs);
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
      if (this.platform === "win32" && this.entries.has(entry.id)) {
        entry.watcher?.close();
        const pollMs = Math.max(100, Math.min(1_000, Math.floor(this.debounceMs / 5)));
        entry.watcher = createWatcher(entry.rootPath, entry.onEvent, (error) => this.onError(entry.id, error), this.platform, pollMs);
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

module.exports = { ProjectWatchService, projectTreeStamp, relevantFile, watchModeForPlatform };
