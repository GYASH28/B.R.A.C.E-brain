"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  hasBlockingVulnerabilities,
  parseAuditPayload,
  vulnerabilityCounts,
} = require("../scripts/dependency-audit");

test("dependency audit classifies moderate, high, and critical findings as blocking", () => {
  const payload = { metadata: { vulnerabilities: { info: 1, low: 2, moderate: 1, high: 0, critical: 0 } } };
  assert.equal(hasBlockingVulnerabilities(payload), true);
  assert.deepEqual(vulnerabilityCounts(payload), { moderate: 1, high: 0, critical: 0 });
});

test("dependency audit permits only info/low findings at the release threshold", () => {
  const payload = { metadata: { vulnerabilities: { info: 2, low: 3, moderate: 0, high: 0, critical: 0 } } };
  assert.equal(hasBlockingVulnerabilities(payload), false);
  assert.deepEqual(vulnerabilityCounts(payload), { moderate: 0, high: 0, critical: 0 });
});

test("dependency audit treats non-JSON transport output as infrastructure, not a clean audit", () => {
  assert.equal(parseAuditPayload("503 Service Unavailable"), null);
  assert.equal(hasBlockingVulnerabilities(null), false);
});
