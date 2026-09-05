"use strict";

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function summarizeIndexOutcome(result, options = {}) {
  if (!result || typeof result !== "object") return "Project indexing finished. Original files were not changed.";
  const label = options.refresh ? "Project index refreshed." : "Project indexed.";
  const changed = count(result.indexed);
  const unchanged = count(result.unchanged);
  const removed = count(result.removed);
  const redacted = count(result.redactedFiles ?? result.redacted);
  const binary = count(result.skippedBinary);
  const errors = count(result.fileErrors ?? result.errors);
  const filesSeen = count(result.filesSeen);
  const facts = [`${changed} changed`, `${unchanged} unchanged`];
  if (removed) facts.push(`${removed} removed from index`);
  const notices = [];
  if (redacted) notices.push(`${redacted} file${redacted === 1 ? "" : "s"} had sensitive patterns redacted in BRACE`);
  if (binary) notices.push(`${binary} binary file${binary === 1 ? "" : "s"} skipped`);
  if (errors) notices.push(`${errors} unreadable item${errors === 1 ? "" : "s"} skipped`);
  if (result.truncated) notices.push(`scan limit reached${filesSeen ? ` after ${filesSeen} files` : ""}`);
  return `${label} ${facts.join(" · ")}.${notices.length ? ` ${notices.join(" · ")}.` : ""} Original files were not changed.`;
}

module.exports = { summarizeIndexOutcome };
