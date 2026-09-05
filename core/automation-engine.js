"use strict";

const { createHash } = require("node:crypto");
const { redactSecrets } = require("./memory-store");

const TRIGGER_TYPES = new Set([
  "manual",
  "schedule.interval",
  "schedule.daily",
  "memory.created",
  "decision.created",
  "project.indexed",
  "session.handoff",
]);
const CONDITION_FIELDS = new Set([
  "title",
  "kind",
  "scope",
  "tags",
  "client",
  "projectId",
  "eventType",
]);
const CONDITION_OPERATORS = new Set([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "includes",
]);
const ACTION_TYPES = new Set([
  "memory.create",
  "decision.create",
  "memory.search",
  "memory.quality_scan",
  "timeline.digest",
  "project.reindex",
  "skill.run",
]);
const ACTION_PERMISSIONS = {
  "memory.create": ["memory:write"],
  "decision.create": ["decision:write"],
  "memory.search": ["memory:read", "source:read"],
  "memory.quality_scan": ["memory:read"],
  "timeline.digest": ["timeline:read", "memory:write"],
  "project.reindex": ["project:read", "source:write"],
  "skill.run": ["skill:run"],
};

const AUTOMATION_TEMPLATES = [
  {
    id: "daily-memory-brief",
    name: "Daily memory brief",
    description: "At a chosen local time, turn recent BRACE activity into a concise, sourced daily summary.",
    trigger: { type: "schedule.daily", config: { time: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] } },
    conditionLogic: "and",
    conditions: [],
    actions: [{ type: "timeline.digest", config: { title: "Daily BRACE brief", scope: "global", windowHours: 24 } }],
  },
  {
    id: "weekly-memory-health",
    name: "Weekly memory health check",
    description: "Inspect provenance, confidence, and overlap once a week without changing any memory.",
    trigger: { type: "schedule.interval", config: { intervalMinutes: 10080 } },
    conditionLogic: "and",
    conditions: [],
    actions: [{ type: "memory.quality_scan", config: { scope: "" } }],
  },
  {
    id: "decision-follow-up",
    name: "Decision follow-up",
    description: "When a decision is recorded, retain a procedure-shaped follow-up with the same project scope.",
    trigger: { type: "decision.created", config: {} },
    conditionLogic: "and",
    conditions: [],
    actions: [{
      type: "memory.create",
      config: {
        kind: "procedure",
        scope: "{{trigger.scope}}",
        title: "Follow up: {{trigger.title}}",
        summary: "Operational follow-up generated from an explicit BRACE decision.",
        content: "Decision: {{trigger.decision}}\n\nRationale: {{trigger.rationale}}",
        tags: ["automation", "decision-follow-up"],
        confidence: 0.82,
        importance: 0.72,
      },
    }],
  },
  {
    id: "session-handoff",
    name: "Handoff context check",
    description: "After an explicit AI handoff, inspect related local memory and preserve the result in the run trace.",
    trigger: { type: "session.handoff", config: {} },
    conditionLogic: "and",
    conditions: [],
    actions: [{ type: "memory.search", config: { query: "{{trigger.title}}", scope: "{{trigger.scope}}", limit: 8 } }],
  },
];

function cleanText(value, maximum = 4_000) {
  return redactSecrets(String(value ?? "")).value.trim().slice(0, maximum);
}

function cleanObject(value, depth = 0) {
  if (depth > 8) return null;
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") return cleanText(value, 12_000);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => cleanObject(item, depth + 1));
  if (typeof value !== "object") return cleanText(value);
  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    const cleanedKey = cleanText(key, 100);
    if (["__proto__", "prototype", "constructor"].includes(cleanedKey)) continue;
    output[cleanedKey] = cleanObject(item, depth + 1);
  }
  return output;
}

function getPath(value, path) {
  return String(path || "").split(".").reduce((current, key) => {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    if (["__proto__", "prototype", "constructor"].includes(key)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, key)) return undefined;
    return current[key];
  }, value);
}

function renderTemplate(value, context) {
  if (typeof value === "string") {
    return cleanText(value.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, path) => {
      const resolved = getPath(context, path);
      if (Array.isArray(resolved)) return resolved.join(", ");
      if (resolved && typeof resolved === "object") return JSON.stringify(resolved);
      return resolved === undefined || resolved === null ? "" : String(resolved);
    }), 12_000);
  }
  if (Array.isArray(value)) return value.map((item) => renderTemplate(item, context));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderTemplate(item, context)]));
  }
  return value;
}

function permissionsFor(actions) {
  return [...new Set(actions.flatMap((action) => ACTION_PERMISSIONS[action.type] || []))].sort();
}

function validateTrigger(trigger) {
  const type = cleanText(trigger?.type, 80);
  if (!TRIGGER_TYPES.has(type)) throw new Error("Choose a supported automation trigger.");
  const config = cleanObject(trigger?.config || {});
  const timeoutSeconds = Number(config.timeoutSeconds ?? 120);
  const debounceSeconds = Number(config.debounceSeconds ?? 30);
  const retryAttempts = Number(config.retryAttempts ?? 2);
  const retryBaseSeconds = Number(config.retryBaseSeconds ?? 15);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 5 || timeoutSeconds > 600) {
    throw new Error("Automation timeout must be between 5 and 600 seconds.");
  }
  if (!Number.isInteger(debounceSeconds) || debounceSeconds < 0 || debounceSeconds > 86_400) {
    throw new Error("Automation debounce must be between 0 and 86,400 seconds.");
  }
  if (!Number.isInteger(retryAttempts) || retryAttempts < 0 || retryAttempts > 5) {
    throw new Error("Automation retry attempts must be between 0 and 5.");
  }
  if (!Number.isInteger(retryBaseSeconds) || retryBaseSeconds < 5 || retryBaseSeconds > 3_600) {
    throw new Error("Automation retry delay must be between 5 seconds and one hour.");
  }
  config.timeoutSeconds = timeoutSeconds;
  config.debounceSeconds = debounceSeconds;
  config.retryAttempts = retryAttempts;
  config.retryBaseSeconds = retryBaseSeconds;
  config.missedRunPolicy = config.missedRunPolicy === "skip" ? "skip" : "run-once";
  if (type === "schedule.interval") {
    const intervalMinutes = Number(config.intervalMinutes);
    if (!Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 525_600) {
      throw new Error("Scheduled intervals must be between 5 minutes and one year.");
    }
    config.intervalMinutes = intervalMinutes;
  }
  if (type === "schedule.daily") {
    const time = cleanText(config.time, 5);
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new Error("Daily schedules require a 24-hour time such as 09:00.");
    }
    const days = Array.isArray(config.daysOfWeek) ? config.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6];
    config.time = time;
    config.daysOfWeek = [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
    if (!config.daysOfWeek.length) throw new Error("Choose at least one day for a daily schedule.");
  }
  return { type, config };
}

function validateConditions(conditions) {
  if (!Array.isArray(conditions)) return [];
  if (conditions.length > 12) throw new Error("An automation may contain at most 12 conditions.");
  return conditions.map((condition) => {
    const field = cleanText(condition?.field, 80);
    const operator = cleanText(condition?.operator, 40);
    if (!CONDITION_FIELDS.has(field) || !CONDITION_OPERATORS.has(operator)) {
      throw new Error("Choose a supported automation condition.");
    }
    const value = cleanObject(condition?.value);
    if (value === null || value === "" || (Array.isArray(value) && !value.length)) {
      throw new Error("Every automation condition needs a comparison value.");
    }
    return { field, operator, value };
  });
}

function validateActions(actions) {
  if (!Array.isArray(actions) || !actions.length) throw new Error("Add at least one automation action.");
  if (actions.length > 8) throw new Error("An automation may contain at most eight actions.");
  return actions.map((action) => {
    const type = cleanText(action?.type, 80);
    if (!ACTION_TYPES.has(type)) throw new Error("Choose a supported automation action.");
    const config = cleanObject(action?.config || {});
    if (type === "memory.create") {
      if (!cleanText(config.title, 240) || !cleanText(config.content, 12_000)) {
        throw new Error("Create-memory actions require a title and content.");
      }
    }
    if (type === "decision.create") {
      if (!cleanText(config.title, 240) || !cleanText(config.decision, 12_000)) {
        throw new Error("Create-decision actions require a title and decision.");
      }
    }
    if (type === "timeline.digest") {
      const windowHours = Number(config.windowHours || 24);
      if (!Number.isFinite(windowHours) || windowHours < 1 || windowHours > 8_760) {
        throw new Error("Timeline digests may cover between one hour and one year.");
      }
      config.windowHours = windowHours;
    }
    if (type === "project.reindex" && !cleanText(config.projectId, 200)) {
      throw new Error("Project refresh actions require a project.");
    }
    if (type === "skill.run" && (!cleanText(config.name, 80) || !cleanText(config.action, 80))) {
      throw new Error("Skill actions require an installed skill and action identifier.");
    }
    return { type, config };
  });
}

function normalizeDefinition(input) {
  const name = cleanText(input?.name, 120);
  if (!name) throw new Error("Name this automation.");
  const trigger = validateTrigger(input?.trigger);
  const conditions = validateConditions(input?.conditions);
  const actions = validateActions(input?.actions);
  return {
    name,
    description: cleanText(input?.description, 600),
    enabled: Boolean(input?.enabled),
    trigger,
    conditionLogic: input?.conditionLogic === "or" ? "or" : "and",
    conditions,
    actions,
    permissions: permissionsFor(actions),
  };
}

function nextRunAt(trigger, from = new Date()) {
  if (trigger.type === "schedule.interval") {
    return new Date(from.getTime() + trigger.config.intervalMinutes * 60_000).toISOString();
  }
  if (trigger.type !== "schedule.daily") return null;
  const [hour, minute] = trigger.config.time.split(":").map(Number);
  const days = new Set(trigger.config.daysOfWeek);
  for (let offset = 0; offset <= 8; offset += 1) {
    const candidate = new Date(from);
    candidate.setSeconds(0, 0);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);
    if (candidate.getTime() <= from.getTime() || !days.has(candidate.getDay())) continue;
    return candidate.toISOString();
  }
  throw new Error("BRACE could not calculate the next scheduled run.");
}

function compareCondition(condition, payload) {
  const actual = getPath(payload, condition.field);
  const expected = condition.value;
  const normalizedActual = String(actual ?? "").toLocaleLowerCase("en-US");
  const normalizedExpected = String(expected ?? "").toLocaleLowerCase("en-US");
  if (condition.operator === "equals") return normalizedActual === normalizedExpected;
  if (condition.operator === "not_equals") return normalizedActual !== normalizedExpected;
  if (condition.operator === "contains") return normalizedActual.includes(normalizedExpected);
  if (condition.operator === "not_contains") return !normalizedActual.includes(normalizedExpected);
  if (condition.operator === "includes") {
    return Array.isArray(actual)
      ? actual.some((item) => String(item).toLocaleLowerCase("en-US") === normalizedExpected)
      : normalizedActual.split(",").map((item) => item.trim()).includes(normalizedExpected);
  }
  return false;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function idempotencyKey(automation, triggerType, payload, attempt = 0) {
  const debounceSeconds = Number(automation?.trigger?.config?.debounceSeconds || 0);
  const identity = payload?.eventId || payload?.id || payload?.scheduledAt || (
    triggerType !== "manual" && debounceSeconds > 0
      ? `${stableJson(payload)}:${Math.floor(Date.now() / (debounceSeconds * 1_000))}`
      : null
  );
  if (!identity) return null;
  return createHash("sha256")
    .update(stableJson([automation.id, triggerType, identity, Number(attempt) || 0]))
    .digest("hex");
}

async function withTimeout(task, milliseconds, controller) {
  let timer;
  try {
    return await Promise.race([
      task,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`Automation exceeded its ${Math.round(milliseconds / 1_000)} second safety timeout.`));
        }, milliseconds);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class AutomationEngine {
  constructor(store, adapters = {}) {
    if (!store) throw new Error("AutomationEngine requires a BRACE memory store.");
    this.store = store;
    this.adapters = adapters;
    this.running = new Set();
    this.maximumConcurrent = Math.min(8, Math.max(1, Number(adapters.maximumConcurrent) || 3));
  }

  templates() {
    return cleanObject(AUTOMATION_TEMPLATES);
  }

  validate(input) {
    const definition = normalizeDefinition(input);
    return {
      ...definition,
      nextRunAt: definition.enabled ? nextRunAt(definition.trigger) : null,
    };
  }

  create(input) {
    if (this.store.listAutomations({ limit: 500 }).length >= 500) {
      throw new Error("BRACE supports up to 500 local automations per profile.");
    }
    const definition = this.validate(input);
    return this.store.createAutomation(definition);
  }

  update(id, input) {
    const current = this.store.getAutomation(id);
    if (!current) throw new Error("Automation not found.");
    const definition = this.validate({ ...current, ...input });
    return this.store.updateAutomation(id, definition);
  }

  setEnabled(id, enabled) {
    const automation = this.store.getAutomation(id);
    if (!automation) throw new Error("Automation not found.");
    return this.store.setAutomationEnabled(
      id,
      Boolean(enabled),
      enabled ? nextRunAt(automation.trigger) : null,
    );
  }

  remove(id) {
    return this.store.deleteAutomation(id);
  }

  conditionsPass(automation, payload) {
    if (!automation.conditions.length) return true;
    const results = automation.conditions.map((condition) => compareCondition(condition, payload));
    return automation.conditionLogic === "or" ? results.some(Boolean) : results.every(Boolean);
  }

  async executeAction(action, context) {
    const config = renderTemplate(action.config, context);
    if (action.type === "memory.create") {
      const result = this.store.createMemory({
        kind: config.kind || "summary",
        scope: config.scope || "global",
        title: config.title,
        summary: config.summary || config.content,
        content: config.content,
        tags: Array.isArray(config.tags) ? config.tags : [],
        confidence: config.confidence,
        importance: config.importance,
        sourceUri: `brace-automation://${context.automation.id}/${context.runId}`,
        sourceExcerpt: `Created by automation “${context.automation.name}”.`,
      });
      return { memoryId: result.memory.id, title: result.memory.title, duplicate: result.duplicate };
    }
    if (action.type === "decision.create") {
      const decision = this.store.createDecision({
        projectId: config.projectId || null,
        title: config.title,
        context: config.context || "Created by a local BRACE automation.",
        decision: config.decision,
        rationale: config.rationale || "Recorded by an explicitly enabled automation.",
        alternatives: Array.isArray(config.alternatives) ? config.alternatives : [],
      });
      return { decisionId: decision.id, title: decision.title };
    }
    if (action.type === "memory.search") {
      const result = this.store.search(config.query || context.trigger.title || "memory", {
        scope: config.scope || undefined,
        limit: Math.min(25, Math.max(1, Number(config.limit) || 8)),
      });
      return {
        mode: result.mode,
        count: result.results.length,
        memories: result.results.map((memory) => ({ id: memory.id, title: memory.title, kind: memory.kind })),
      };
    }
    if (action.type === "memory.quality_scan") {
      const quality = this.store.memoryQuality({ scope: config.scope || undefined, limit: 50 });
      return {
        active: quality.active,
        pendingReview: quality.pendingReview,
        linkedPercent: quality.linkedPercent,
        highConfidencePercent: quality.highConfidencePercent,
      };
    }
    if (action.type === "timeline.digest") {
      const cutoff = Date.now() - Number(config.windowHours || 24) * 3_600_000;
      const events = this.store.listTimeline({ limit: 300 })
        .filter((event) => new Date(event.occurredAt).getTime() >= cutoff)
        .filter((event) => !config.scope || config.scope === "global" || event.metadata?.scope === config.scope);
      if (!events.length) return { skipped: true, reason: "No timeline activity in this window." };
      const lines = events.slice(0, 40).map((event) => `- ${event.title}: ${event.summary}`);
      const result = this.store.createMemory({
        kind: "summary",
        scope: config.scope || "global",
        title: config.title || "BRACE activity brief",
        summary: `${events.length} local timeline ${events.length === 1 ? "event" : "events"} summarized without a cloud model.`,
        content: lines.join("\n"),
        tags: ["automation", "timeline-digest"],
        confidence: 0.9,
        importance: 0.65,
        sourceUri: `brace-automation://${context.automation.id}/${context.runId}`,
        sourceExcerpt: "Deterministic summary of local BRACE timeline entries.",
      });
      return { memoryId: result.memory.id, eventCount: events.length, duplicate: result.duplicate };
    }
    if (action.type === "project.reindex") {
      if (typeof this.adapters.reindexProject !== "function") {
        throw new Error("Project refresh is unavailable in this BRACE runtime.");
      }
      const result = await this.adapters.reindexProject(config.projectId, { signal: context.signal });
      return { projectId: config.projectId, indexed: Boolean(result) };
    }
    if (action.type === "skill.run") {
      if (typeof this.adapters.runSkill !== "function") {
        throw new Error("Skill execution is unavailable in this BRACE runtime.");
      }
      return cleanObject(await this.adapters.runSkill(config.name, config.action, config.input || {}));
    }
    throw new Error("Unsupported automation action.");
  }

  async run(id, options = {}) {
    const persistedAutomation = this.store.getAutomation(id);
    if (!persistedAutomation) throw new Error("Automation not found.");
    const automation = options.definitionSnapshot
      ? {
          ...persistedAutomation,
          ...normalizeDefinition(options.definitionSnapshot),
          id: persistedAutomation.id,
          version: Number(options.definitionSnapshot.version) || persistedAutomation.version,
        }
      : persistedAutomation;
    const triggerType = cleanText(options.triggerType || "manual", 80);
    const dryRun = Boolean(options.dryRun);
    if (!dryRun && triggerType !== "manual" && !automation.enabled) {
      throw new Error("This automation is paused.");
    }
    const payload = cleanObject(options.payload || {});
    const retryAttempt = Math.max(0, Number(options.retryAttempt || payload?._retryAttempt) || 0);
    const key = options.idempotencyKey || idempotencyKey(automation, triggerType, payload, retryAttempt);
    if (!dryRun && key) {
      const previous = this.store.findAutomationRunByIdempotencyKey?.(key);
      if (previous) return previous;
    }
    const snapshot = cleanObject(automation);
    const run = this.store.createAutomationRun({
      automationId: automation.id,
      automationName: automation.name,
      triggerType,
      triggerPayload: { ...payload, ...(key ? { _idempotencyKey: key } : {}), _retryAttempt: retryAttempt },
      automationSnapshot: snapshot,
      retryOf: options.retryOf || null,
      dryRun,
    });
    if (this.running.has(automation.id) || this.running.size >= this.maximumConcurrent) {
      return this.store.finishAutomationRun(run.id, {
        status: "skipped",
        steps: [{ type: "guard", status: "skipped", detail: this.running.has(automation.id)
          ? "A previous run of this recipe is still active."
          : `The local concurrency limit of ${this.maximumConcurrent} active recipes was reached.` }],
      });
    }
    this.running.add(automation.id);
    const steps = [];
    try {
      const passed = this.conditionsPass(automation, payload);
      steps.push({
        type: "conditions",
        status: passed ? "success" : "skipped",
        detail: automation.conditions.length
          ? `${automation.conditions.length} ${automation.conditionLogic.toUpperCase()} condition(s) evaluated.`
          : "No conditions configured.",
      });
      if (!passed) {
        return this.store.finishAutomationRun(run.id, { status: "skipped", steps });
      }
      const context = {
        trigger: payload,
        automation,
        runId: run.id,
        now: new Date().toISOString(),
        signal: null,
      };
      const deadline = Date.now() + Number(automation.trigger.config.timeoutSeconds || 120) * 1_000;
      for (const [index, action] of automation.actions.entries()) {
        const preview = renderTemplate(action.config, context);
        if (dryRun) {
          steps.push({ index, type: action.type, status: "preview", input: cleanObject(preview) });
          continue;
        }
        const startedAt = Date.now();
        const controller = new AbortController();
        context.signal = controller.signal;
        const output = await withTimeout(
          this.executeAction(action, context),
          Math.max(1, deadline - Date.now()),
          controller,
        );
        steps.push({
          index,
          type: action.type,
          status: output?.skipped ? "skipped" : "success",
          durationMs: Date.now() - startedAt,
          output: cleanObject(output),
        });
      }
      const finished = this.store.finishAutomationRun(run.id, {
        status: dryRun ? "preview" : "success",
        steps,
      });
      if (!dryRun && !options.retryOf) {
        const scheduleAnchor = Math.max(
          new Date(finished.finishedAt).getTime(),
          new Date(payload.firedAt || 0).getTime() || 0,
          new Date(payload.scheduledAt || 0).getTime() || 0,
        );
        this.store.markAutomationRun(
          automation.id,
          finished.finishedAt,
          nextRunAt(automation.trigger, new Date(scheduleAnchor)),
        );
      }
      return finished;
    } catch (error) {
      const message = cleanText(error instanceof Error ? error.message : "Automation failed.", 2_000);
      steps.push({ type: "error", status: "failed", detail: message });
      const failed = this.store.finishAutomationRun(run.id, { status: "failed", steps, error: message });
      if (!dryRun && triggerType.startsWith("schedule.")) {
        const retryLimit = Number(persistedAutomation.trigger.config.retryAttempts || 0);
        const shouldRetry = retryAttempt < retryLimit;
        const retryDelay = Number(persistedAutomation.trigger.config.retryBaseSeconds || 15)
          * (2 ** retryAttempt) * 1_000;
        this.store.markAutomationRun(
          persistedAutomation.id,
          failed.finishedAt,
          shouldRetry
            ? new Date(Date.now() + retryDelay).toISOString()
            : nextRunAt(persistedAutomation.trigger, new Date(failed.finishedAt)),
        );
      }
      return failed;
    } finally {
      this.running.delete(automation.id);
    }
  }

  async retry(runId, dryRun = false) {
    const previous = this.store.getAutomationRun(runId);
    if (!previous) throw new Error("Automation run not found.");
    if (!previous.automationId || !this.store.getAutomation(previous.automationId)) {
      throw new Error("The original automation no longer exists.");
    }
    return this.run(previous.automationId, {
      triggerType: "manual",
      payload: previous.triggerPayload,
      definitionSnapshot: previous.automationSnapshot,
      retryOf: previous.id,
      dryRun,
    });
  }

  async dispatch(triggerType, payload = {}) {
    if (!TRIGGER_TYPES.has(triggerType) || triggerType.startsWith("schedule.") || triggerType === "manual") {
      throw new Error("Choose a supported event trigger.");
    }
    if (this.store.getSetting("automation.paused", false)) return [];
    const matches = this.store.listAutomations({ enabled: true, limit: 500 })
      .filter((automation) => automation.trigger.type === triggerType);
    const results = [];
    for (const automation of matches) {
      if (payload.originAutomationId === automation.id) continue;
      results.push(await this.run(automation.id, { triggerType, payload }));
    }
    return results;
  }

  async tick(at = new Date()) {
    if (this.store.getSetting("automation.paused", false)) return [];
    const due = this.store.listDueAutomations(at.toISOString(), 20);
    const results = [];
    for (const automation of due) {
      const scheduledAt = new Date(automation.nextRunAt).getTime();
      const latenessMs = Math.max(0, at.getTime() - scheduledAt);
      const missedThresholdMs = automation.trigger.type === "schedule.interval"
        ? Number(automation.trigger.config.intervalMinutes || 5) * 60_000
        : 6 * 60 * 60_000;
      if (latenessMs > missedThresholdMs && automation.trigger.config.missedRunPolicy === "skip") {
        const skipped = this.store.createAutomationRun({
          automationId: automation.id,
          automationName: automation.name,
          triggerType: automation.trigger.type,
          triggerPayload: { scheduledAt: automation.nextRunAt, firedAt: at.toISOString(), missed: true },
          automationSnapshot: cleanObject(automation),
        });
        results.push(this.store.finishAutomationRun(skipped.id, {
          status: "skipped",
          steps: [{ type: "schedule", status: "skipped", detail: "Missed while BRACE was asleep or closed; this recipe is configured to skip missed runs." }],
        }));
        this.store.markAutomationRun(automation.id, at.toISOString(), nextRunAt(automation.trigger, at));
        continue;
      }
      const previous = this.store.listAutomationRuns({ automationId: automation.id, limit: 1 })[0];
      const retryAttempt = previous?.status === "failed" && previous?.triggerType === automation.trigger.type
        ? Number(previous.triggerPayload?._retryAttempt || 0) + 1
        : 0;
      results.push(await this.run(automation.id, {
        triggerType: automation.trigger.type,
        payload: { scheduledAt: automation.nextRunAt, firedAt: at.toISOString(), missed: latenessMs > missedThresholdMs },
        retryAttempt,
      }));
    }
    return results;
  }
}

module.exports = {
  ACTION_PERMISSIONS,
  ACTION_TYPES,
  AUTOMATION_TEMPLATES,
  AutomationEngine,
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  TRIGGER_TYPES,
  idempotencyKey,
  nextRunAt,
  normalizeDefinition,
  permissionsFor,
  renderTemplate,
};
