import { z } from "zod";

const id = z.string().trim().min(1).max(240);
const shortText = z.string().max(2_048);
const bodyText = z.string().max(200_000);
const optionalDate = z.string().datetime({ offset: true }).nullable().optional();
const listLimit = z.number().int().min(1).max(2_000).optional();
const boundedRecord = z.record(z.string().max(100), z.unknown()).superRefine((value, context) => {
  if (Object.keys(value).length > 100) {
    context.addIssue({ code: "custom", message: "IPC objects may contain at most 100 fields." });
  }
  if (JSON.stringify(value).length > 250_000) {
    context.addIssue({ code: "custom", message: "IPC object exceeds the 250 KB safety limit." });
  }
});

const memoryInput = z.object({
  id: id.optional(),
  workspaceId: id.nullable().optional(),
  kind: z.enum(["project", "decision", "lesson", "warning", "preference", "summary", "hypothesis", "fact", "procedure"]).optional(),
  scope: z.string().trim().max(180).optional(),
  title: z.string().trim().min(1).max(240),
  summary: z.string().max(600).optional(),
  content: bodyText,
  status: z.enum(["active", "superseded", "forgotten"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  importance: z.number().min(0).max(1).optional(),
  pinned: z.boolean().optional(),
  tags: z.array(z.string().trim().max(80)).max(50).optional(),
  sourceId: id.nullable().optional(),
  sourceUri: shortText.nullable().optional(),
  sourceExcerpt: z.string().max(1_000).nullable().optional(),
}).strict();

const decisionInput = z.object({
  id: id.optional(),
  projectId: id.nullable().optional(),
  title: z.string().trim().min(1).max(240),
  context: z.string().max(50_000).optional(),
  decision: z.string().trim().min(1).max(100_000),
  rationale: z.string().max(50_000).optional(),
  alternatives: z.array(z.string().max(5_000)).max(50).optional(),
  status: z.enum(["proposed", "accepted", "superseded", "rejected"]).optional(),
  decidedAt: z.string().datetime({ offset: true }).optional(),
  sourceId: id.nullable().optional(),
  supersedesId: id.nullable().optional(),
}).strict();

const noArguments = z.tuple([]);

export const ipcArgumentSchemas = {
  "brace:get-snapshot": noArguments,
  "brace:initialize-demo": noArguments,
  "brace:create-organization": z.tuple([z.object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().max(80).optional(),
    edition: z.enum(["personal", "team", "enterprise"]).optional(),
    ownershipBoundary: z.string().trim().max(500).optional(),
    actorLabel: z.string().trim().max(120).optional(),
  }).strict()]),
  "brace:create-workspace": z.tuple([z.object({
    organizationId: id,
    name: z.string().trim().min(1).max(120),
    kind: z.enum(["personal", "team", "executive", "project"]).optional(),
    visibility: z.enum(["personal", "team", "organization"]).optional(),
    actorLabel: z.string().trim().max(120).optional(),
  }).strict()]),
  "brace:upsert-workspace-member": z.tuple([z.object({
    id: id.optional(),
    workspaceId: id,
    displayName: z.string().trim().min(1).max(120),
    email: z.string().email().max(254).optional().or(z.literal("")),
    role: z.enum(["owner", "admin", "manager", "member", "guest", "auditor"]),
    status: z.enum(["active", "invited", "suspended"]).optional(),
    actorLabel: z.string().trim().max(120).optional(),
  }).strict()]),
  "brace:cancel-task": z.tuple([id]),
  "brace:search": z.tuple([z.object({
    query: z.string().trim().min(1).max(12_000),
    scope: z.string().max(180).optional(),
    kinds: z.array(z.string().max(40)).max(20).optional(),
    since: optionalDate,
    projectId: id.optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }).strict()]),
  "brace:list-memories": z.tuple([z.object({
    scope: z.string().max(180).optional(),
    workspaceId: id.optional(),
    kind: z.enum(["project", "decision", "lesson", "warning", "preference", "summary", "hypothesis", "fact", "procedure"]).optional(),
    status: z.enum(["active", "superseded", "forgotten"]).optional(),
    pinned: z.boolean().optional(),
    limit: listLimit,
  }).strict().optional()]),
  "brace:get-memory": z.tuple([id]),
  "brace:create-memory": z.tuple([memoryInput]),
  "brace:update-memory": z.tuple([id, memoryInput.partial()]),
  "brace:set-memory-pinned": z.tuple([id, z.boolean()]),
  "brace:resolve-memory-review": z.tuple([z.object({ leftId: id, rightId: id, outcome: z.enum(["distinct", "keep-left", "keep-right"]) }).strict()]),
  "brace:restore-memory": z.tuple([id]),
  "brace:forget-memory": z.tuple([id]),
  "brace:add-evidence": z.tuple([id, boundedRecord]),
  "brace:set-evidence-outcome": z.tuple([id, id, z.enum(["promoted", "rejected", "deferred", "observed"])]),
  "brace:list-timeline": z.tuple([z.object({ limit: listLimit, since: optionalDate }).strict().optional()]),
  "brace:create-decision": z.tuple([decisionInput]),
  "brace:get-graph": z.tuple([z.object({ limit: listLimit, scope: z.string().max(180).optional() }).strict().optional()]),
  "brace:add-project": noArguments,
  "brace:reindex-project": z.tuple([id]),
  "brace:set-project-watch": z.tuple([id, z.boolean()]),
  "brace:install-skill": noArguments,
  "brace:set-skill-enabled": z.tuple([id, z.boolean()]),
  "brace:remove-skill": z.tuple([id]),
  "brace:run-skill": z.tuple([id, id, boundedRecord]),
  "brace:set-embedding-config": z.tuple([z.object({ enabled: z.boolean(), endpoint: z.string().url().max(2_048), model: z.string().trim().min(1).max(160) }).strict()]),
  "brace:export": noArguments,
  "brace:import-content": noArguments,
  "brace:backup": noArguments,
  "brace:diagnostics": noArguments,
  "brace:save-support-bundle": noArguments,
  "brace:restore-backup": noArguments,
  "brace:delete-all": z.tuple([z.string().max(100)]),
  "brace:list-connectors": noArguments,
  "brace:install-connector": z.tuple([z.enum(["codex", "claude", "antigravity"]), z.enum(["read-only", "remember"])]),
  "brace:restore-connector": z.tuple([z.enum(["codex", "claude", "antigravity"])]),
  "brace:prepare-assistant-context": z.tuple([z.object({ client: z.enum(["codex", "claude"]), prompt: z.string().trim().min(1).max(12_000) }).strict()]),
  "brace:run-assistant": z.tuple([z.object({ client: z.enum(["codex", "claude"]), prompt: z.string().trim().min(1).max(12_000), contextId: id }).strict()]),
  "brace:clear-assistant-history": noArguments,
  "brace:copy-text": z.tuple([z.string().max(100_000)]),
  "brace:get-automations": noArguments,
  "brace:create-automation": z.tuple([boundedRecord]),
  "brace:update-automation": z.tuple([id, boundedRecord]),
  "brace:set-automation-enabled": z.tuple([id, z.boolean()]),
  "brace:run-automation": z.tuple([id, z.object({ dryRun: z.boolean().optional(), payload: boundedRecord.optional() }).strict()]),
  "brace:retry-automation-run": z.tuple([id, z.boolean()]),
  "brace:export-automations": z.tuple([id.optional()]),
  "brace:import-automations": noArguments,
  "brace:delete-automation": z.tuple([id]),
  "brace:set-automations-paused": z.tuple([z.boolean()]),
} satisfies Record<string, z.ZodType>;

export type BraceIpcChannel = keyof typeof ipcArgumentSchemas;

export function parseIpcArguments(channel: string, args: unknown[]) {
  const schema = ipcArgumentSchemas[channel as BraceIpcChannel];
  if (!schema) throw new Error(`Unknown BRACE IPC channel: ${channel}`);
  return schema.parse(args) as unknown[];
}
