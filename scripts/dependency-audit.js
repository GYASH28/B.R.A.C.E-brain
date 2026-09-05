"use strict";

const { spawnSync } = require("node:child_process");

const ATTEMPTS = Math.max(1, Number(process.env.BRACE_AUDIT_ATTEMPTS) || 3);
const FETCH_TIMEOUT_MS = Math.max(5_000, Number(process.env.BRACE_AUDIT_FETCH_TIMEOUT_MS) || 60_000);
const PROCESS_TIMEOUT_MS = Math.max(FETCH_TIMEOUT_MS + 5_000, Number(process.env.BRACE_AUDIT_PROCESS_TIMEOUT_MS) || 70_000);
const RETRY_DELAY_MS = Math.max(0, Number(process.env.BRACE_AUDIT_RETRY_DELAY_MS) || 5_000);
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

function auditFailureReason(payload, result) {
  if (result.error?.code === "ETIMEDOUT") return `timed out after ${PROCESS_TIMEOUT_MS}ms`;
  if (result.error?.message) return result.error.message;
  const auditError = payload?.error;
  if (typeof auditError === "string" && auditError.trim()) return auditError.trim();
  if (auditError && typeof auditError === "object") {
    if (typeof auditError.summary === "string" && auditError.summary.trim()) return auditError.summary.trim();
    if (typeof auditError.message === "string" && auditError.message.trim()) return auditError.message.trim();
    const compact = Object.fromEntries(
      ["code", "statusCode", "method", "uri"].filter((key) => auditError[key] != null).map((key) => [key, auditError[key]])
    );
    if (Object.keys(compact).length) return JSON.stringify(compact);
  }
  if (typeof result.stderr === "string" && result.stderr.trim()) return result.stderr.trim();
  return `npm exited ${result.status}`;
}

function npmAuditInvocation(platform, args) {
  if (platform === "win32") {
    // Node 24 no longer launches .cmd shims directly without a shell. Every
    // argument here is a fixed constant owned by this script, not user input.
    return { command: `npm ${args.join(" ")}`, args: [], shell: true };
  }
  return { command: "npm", args, shell: false };
}

function runAudit() {
  const args = [
    "audit",
    "--audit-level=moderate",
    "--json",
    `--fetch-timeout=${FETCH_TIMEOUT_MS}`,
    "--fetch-retries=0",
  ];
  const invocation = npmAuditInvocation(process.platform, args);

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const result = spawnSync(invocation.command, invocation.args, {
      encoding: "utf8",
      timeout: PROCESS_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
      shell: invocation.shell,
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

    const reason = auditFailureReason(payload, result);
    process.stderr.write(`Dependency audit infrastructure attempt ${attempt}/${ATTEMPTS} failed: ${reason}\n`);

    if (attempt < ATTEMPTS) sleep(RETRY_DELAY_MS);
  }

  process.stderr.write("Dependency audit could not reach a trustworthy result after bounded retries.\n");
  process.exitCode = 1;
}

if (require.main === module) runAudit();

module.exports = {
  auditFailureReason,
  hasBlockingVulnerabilities,
  npmAuditInvocation,
  parseAuditPayload,
  vulnerabilityCounts,
};
