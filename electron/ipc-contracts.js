"use strict";

const { z } = require("zod");

const id = z.string().trim().min(1).max(240);
const shortText = z.string().max(2_048);
const boundedUnknown = (maxBytes, label) => z.unknown().superRefine((value, ctx) => {
  let encoded;
  try {
    encoded = JSON.stringify(value);
  } catch {
    encoded = null;
  }
  if (
    encoded === undefined ||
    encoded === null ||
    Buffer.byteLength(encoded, "utf8") > maxBytes
  ) {
    ctx.addIssue({ code: "custom", message: `${label} exceeds the local IPC size limit.` });
  }
});

const objectPayload = boundedUnknown(256_000, "IPC payload");
const automationPayload = boundedUnknown(192_000, "Automation payload");

const schemas = new Map([
  ["brace:get-snapshot", z.tuple([])],
  ["brace:initialize-demo", z.tuple([])],
  ["brace:search", z.tuple([z.object({
    query: z.string().trim().min(1).max(12_000),
    scope: z.string().max(500).optional(),
    kinds: z.array(z.string().max(80)).max(24).optional(),
    since: z.string().max(100).optional(),
    projectId: z.string().max(240).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }).passthrough()])],
  ["brace:list-memories", z.tuple([objectPayload.optional()])],
  ["brace:get-memory", z.tuple([id])],
  ["brace:create-memory", z.tuple([objectPayload])],
  ["brace:update-memory", z.tuple([id, objectPayload])],
  ["brace:set-memory-pinned", z.tuple([id, z.boolean()])],
  ["brace:resolve-memory-review", z.tuple([z.object({
    leftId: id,
    rightId: id,
    outcome: z.enum(["distinct", "keep-left", "keep-right"]),
  }).strict()])],
  ["brace:forget-memory", z.tuple([id])],
  ["brace:add-evidence", z.tuple([id, objectPayload])],
  ["brace:list-timeline", z.tuple([objectPayload.optional()])],
  ["brace:create-decision", z.tuple([objectPayload])],
  ["brace:get-graph", z.tuple([objectPayload.optional()])],
  ["brace:add-project", z.tuple([])],
  ["brace:reindex-project", z.tuple([id])],
  ["brace:install-skill", z.tuple([])],
  ["brace:set-skill-enabled", z.tuple([id, z.boolean()])],
  ["brace:remove-skill", z.tuple([id])],
  ["brace:run-skill", z.tuple([id, shortText, objectPayload])],
  ["brace:set-embedding-config", z.tuple([z.object({
    enabled: z.boolean(),
    endpoint: z.string().trim().max(2_048).optional(),
    model: z.string().trim().max(240).optional(),
  }).strict()])],
  ["brace:export", z.tuple([])],
  ["brace:backup", z.tuple([])],
  ["brace:delete-all", z.tuple([z.string().max(120)])],
  ["brace:list-connectors", z.tuple([])],
  ["brace:install-connector", z.tuple([
    z.enum(["codex", "claude", "antigravity", "generic"]),
    z.enum(["read-only", "remember"]),
  ])],
  ["brace:run-assistant", z.tuple([z.object({
    client: z.enum(["codex", "claude"]),
    prompt: z.string().trim().min(1).max(12_000),
  }).strict()])],
  ["brace:clear-assistant-history", z.tuple([])],
  ["brace:copy-text", z.tuple([z.string().min(1).max(200_000)])],
  ["brace:get-automations", z.tuple([])],
  ["brace:create-automation", z.tuple([automationPayload])],
  ["brace:update-automation", z.tuple([id, automationPayload])],
  ["brace:set-automation-enabled", z.tuple([id, z.boolean()])],
  ["brace:run-automation", z.tuple([id, objectPayload])],
  ["brace:retry-automation-run", z.tuple([id, z.boolean()])],
  ["brace:delete-automation", z.tuple([id])],
  ["brace:set-automations-paused", z.tuple([z.boolean()])],
]);

function validateIpcArguments(channel, args) {
  const schema = schemas.get(channel);
  if (!schema) throw new Error(`No IPC schema registered for ${channel}.`);
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    const error = new Error(`Invalid BRACE IPC request for ${channel}.`);
    error.code = "BRACE_INVALID_IPC_REQUEST";
    throw error;
  }
  return parsed.data;
}

module.exports = {
  schemas,
  validateIpcArguments,
};
