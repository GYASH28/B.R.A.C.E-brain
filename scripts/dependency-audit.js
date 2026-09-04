"use strict";

const { spawnSync } = require("node:child_process");

const ATTEMPTS = Math.max(1, Number(process.env.BRACE_AUDIT_ATTEMPTS) || 3);
const FETCH_TIMEOUT_MS = Math.max(5_000, Number(process.env.BRACE_AUDIT_FETCH_TIMEOUT_MS) || 30_000);
const PROCESS_TIMEOUT_MS = Math.max(FETCH_TIMEOUT_MS + 5_000, Number(process.env.BRACE_AUDIT_PROCESS_TIMEOUT_MS) || 45_000);
const RETRY_DELAY_MS = Math.max(0, Number(process.env.BRACE_AUDIT_RETRY_DELAY_MS) || 10_000);
const LEVELS = ["moderate", "high", "critical"];

function parseAuditPayload(text) {
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function vulnerabilityCounts(payload) {
  const source = payload?.metadata?.vulnerabilities || {};
  return Object.fromEntries(LEVELS.map((level) => [level, Number(source[level]) || 0]));
}

function hasBlockingVulnerabilities(payload) {
  const counts = vulnerabilityCounts(payload);
  return LEVELS.some((level) => counts[level] > 0);
}

function sleep(milliseconds) {
  if (!milliseconds) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function runAudit() {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = [
    "audit",
    "--audit-level=moderate",
    "--json",
    `--fetch-timeout=${FETCH_TIMEOUT_MS}`,
    "--fetch-retries=0",
  ];

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      timeout: PROCESS_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    });
    const payload = parseAuditPayload(result.stdout);

    if (hasBlockingVulnerabilities(payload)) {
      const counts = vulnerabilityCounts(payload);
      process.stderr.write(`Dependency audit found moderate-or-higher vulnerabilities: ${JSON.stringify(counts)}\n`);
      if (result.stdout) process.stderr.write(result.stdout);
      process.exitCode = 1;
      return;
    }

    if (result.status === 0) {
      const counts = vulnerabilityCounts(payload);
      process.stdout.write(`Dependency audit passed: ${JSON.stringify(counts)}\n`);
      return;
    }

    const reason = result.error?.code === "ETIMEDOUT"
      ? `timed out after ${PROCESS_TIMEOUT_MS}ms`
      : (payload?.error?.summary || payload?.error || result.stderr || `npm exited ${result.status}`).toString().trim();
    process.stderr.write(`Dependency audit infrastructure attempt ${attempt}/${ATTEMPTS} failed: ${reason}\n`);

    if (attempt < ATTEMPTS) sleep(RETRY_DELAY_MS);
  }

  process.stderr.write("Dependency audit could not reach a trustworthy result after bounded retries.\n");
  process.exitCode = 1;
}

if (require.main === module) runAudit();

module.exports = {
  hasBlockingVulnerabilities,
  parseAuditPayload,
  vulnerabilityCounts,
};
