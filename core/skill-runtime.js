"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { sha256 } = require("./memory-store");

const SKILL_SCHEMA_VERSION = 1;
const PERMISSIONS = new Set([
  "memory:read",
  "memory:write",
  "source:read",
  "timeline:read",
  "decision:write",
  "graph:read",
]);
const OPERATION_PERMISSION = {
  "memory.search": "memory:read",
  "memory.create": "memory:write",
  "source.search": "source:read",
  "timeline.list": "timeline:read",
  "decision.create": "decision:write",
  "graph.read": "graph:read",
};

function normalizeName(value) {
  return String(value || "").trim().toLocaleLowerCase("en-US");
}

function validateInputSchema(schema, input) {
  const candidate = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const properties = schema?.properties && typeof schema.properties === "object"
    ? schema.properties
    : {};
  const required = Array.isArray(schema?.required) ? schema.required : [];
  for (const key of required) {
    if (candidate[key] === undefined || candidate[key] === null || candidate[key] === "") {
      throw new Error(`Skill input '${key}' is required.`);
    }
  }
  for (const [key, value] of Object.entries(candidate)) {
    const rule = properties[key];
    if (!rule) {
      if (schema?.additionalProperties === false) throw new Error(`Unknown skill input '${key}'.`);
      continue;
    }
    if (rule.type === "string" && typeof value !== "string") throw new Error(`Skill input '${key}' must be a string.`);
    if (rule.type === "number" && typeof value !== "number") throw new Error(`Skill input '${key}' must be a number.`);
    if (rule.type === "boolean" && typeof value !== "boolean") throw new Error(`Skill input '${key}' must be a boolean.`);
    if (rule.type === "array" && !Array.isArray(value)) throw new Error(`Skill input '${key}' must be an array.`);
    if (Number.isFinite(rule.maxLength) && String(value).length > rule.maxLength) {
      throw new Error(`Skill input '${key}' exceeds its maximum length.`);
    }
    if (Array.isArray(rule.enum) && !rule.enum.includes(value)) {
      throw new Error(`Skill input '${key}' must be one of: ${rule.enum.join(", ")}.`);
    }
  }
  return candidate;
}

function resolveTemplate(value, context) {
  if (Array.isArray(value)) return value.map((item) => resolveTemplate(item, context));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveTemplate(item, context)]));
  }
  if (typeof value !== "string") return value;
  const exact = value.match(/^\{\{(input\.[A-Za-z0-9_-]+|now)\}\}$/);
  const lookup = (expression) => expression === "now"
    ? context.now
    : context.input[expression.slice("input.".length)];
  if (exact) return lookup(exact[1]);
  return value.replace(/\{\{(input\.[A-Za-z0-9_-]+|now)\}\}/g, (_match, expression) => {
    const resolved = lookup(expression);
    return resolved === undefined || resolved === null ? "" : String(resolved);
  });
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("A BRACE skill manifest must be a JSON object.");
  }
  if (manifest.schemaVersion !== SKILL_SCHEMA_VERSION) {
    throw new Error(`Unsupported BRACE skill schema: ${manifest.schemaVersion}.`);
  }
  const name = normalizeName(manifest.name);
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(name)) {
    throw new Error("Skill names must use 2-63 lowercase letters, numbers, or hyphens.");
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(manifest.version || ""))) {
    throw new Error("Skill versions must use semantic versioning.");
  }
  if (!String(manifest.description || "").trim()) throw new Error("A skill description is required.");
  if (!String(manifest.license || "").trim()) throw new Error("A skill must declare its license or private distribution status.");
  const requested = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  for (const permission of requested) {
    if (!PERMISSIONS.has(permission)) throw new Error(`Unknown skill permission: ${permission}.`);
  }
  if (!Array.isArray(manifest.actions) || manifest.actions.length === 0) {
    throw new Error("A skill must declare at least one action.");
  }
  const actionIds = new Set();
  for (const action of manifest.actions) {
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(String(action.id || ""))) {
      throw new Error("Skill action ids must use lowercase letters, numbers, or hyphens.");
    }
    if (actionIds.has(action.id)) throw new Error(`Duplicate skill action: ${action.id}.`);
    actionIds.add(action.id);
    if (!Array.isArray(action.steps) || action.steps.length === 0) {
      throw new Error(`Skill action '${action.id}' requires at least one step.`);
    }
    for (const step of action.steps) {
      const permission = OPERATION_PERMISSION[step.use];
      if (!permission) throw new Error(`Unsupported skill operation: ${step.use}.`);
      if (!requested.includes(permission)) {
        throw new Error(`Skill action '${action.id}' uses ${step.use} without requesting ${permission}.`);
      }
    }
  }
  return {
    ...manifest,
    name,
    permissions: [...new Set(requested)],
  };
}

function installSkill(store, manifestPath, options = {}) {
  const resolved = path.resolve(manifestPath);
  if (path.basename(resolved) !== "brace-skill.json") {
    throw new Error("Install BRACE skills from a brace-skill.json manifest.");
  }
  const raw = fs.readFileSync(resolved, "utf8");
  const manifest = validateManifest(JSON.parse(raw));
  const approved = new Set(Array.isArray(options.approvedPermissions) ? options.approvedPermissions : []);
  const missing = manifest.permissions.filter((permission) => !approved.has(permission));
  if (missing.length) {
    throw new Error(`Skill permissions require approval: ${missing.join(", ")}.`);
  }
  const installRoot = path.resolve(options.installRoot);
  if (!options.installRoot || installRoot === path.parse(installRoot).root) {
    throw new Error("A specific skill installation directory is required.");
  }
  const destination = path.join(installRoot, manifest.name);
  fs.mkdirSync(destination, { recursive: true });
  const normalized = `${JSON.stringify(manifest, null, 2)}\n`;
  const destinationManifest = path.join(destination, "brace-skill.json");
  fs.writeFileSync(destinationManifest, normalized, { encoding: "utf8", mode: 0o600 });
  const checksum = sha256(normalized);
  return store.installSkillRecord({
    name: manifest.name,
    version: manifest.version,
    manifest,
    installPath: destination,
    enabled: options.enabled === true,
    permissions: manifest.permissions,
    checksum,
  });
}

function verifyInstalledSkill(record) {
  if (!record) throw new Error("Skill not found.");
  const manifestPath = path.join(record.installPath, "brace-skill.json");
  const raw = fs.readFileSync(manifestPath, "utf8");
  if (sha256(raw) !== record.checksum) {
    throw new Error(`Skill '${record.name}' changed on disk and must be reinstalled.`);
  }
  return validateManifest(JSON.parse(raw));
}

function executeStep(store, step, context) {
  const args = resolveTemplate(step.with || {}, context);
  if (step.use === "memory.search") return store.search(args.query, args);
  if (step.use === "source.search") return store.searchSources(args.query, args);
  if (step.use === "memory.create") return store.createMemory(args);
  if (step.use === "decision.create") return store.createDecision(args);
  if (step.use === "timeline.list") return store.listTimeline(args);
  if (step.use === "graph.read") return store.graph(args);
  throw new Error(`Unsupported skill operation: ${step.use}.`);
}

function runSkillAction(store, name, actionId, input = {}) {
  const record = store.getSkill(normalizeName(name));
  if (!record) throw new Error("Skill not found.");
  if (!record.enabled) throw new Error(`Skill '${record.name}' is disabled.`);
  const manifest = verifyInstalledSkill(record);
  const action = manifest.actions.find((candidate) => candidate.id === actionId);
  if (!action) throw new Error(`Skill action not found: ${actionId}.`);
  const validatedInput = validateInputSchema(action.inputSchema || {}, input);
  const context = { input: validatedInput, now: new Date().toISOString() };
  const results = [];
  for (const step of action.steps) {
    const permission = OPERATION_PERMISSION[step.use];
    if (!record.permissions.includes(permission)) {
      throw new Error(`Skill '${record.name}' is not approved for ${permission}.`);
    }
    results.push({ use: step.use, result: executeStep(store, step, context) });
  }
  store.insertEvent({
    eventType: "skill.ran",
    title: `${manifest.displayName || manifest.name}: ${action.label || action.id}`,
    summary: `${results.length} permission-checked step${results.length === 1 ? "" : "s"} completed.`,
    metadata: { skill: manifest.name, action: action.id },
  });
  return { skill: manifest.name, action: action.id, results };
}

module.exports = {
  OPERATION_PERMISSION,
  PERMISSIONS,
  SKILL_SCHEMA_VERSION,
  installSkill,
  resolveTemplate,
  runSkillAction,
  validateInputSchema,
  validateManifest,
  verifyInstalledSkill,
};
