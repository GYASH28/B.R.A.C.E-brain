"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { DatabaseSync, backup: backupSqlite } = require("node:sqlite");
const { OrganizationRepository } = require("./repositories/organization-repository");

const SCHEMA_VERSION = 6;
const MEMORY_KINDS = new Set([
  "project",
  "decision",
  "lesson",
  "warning",
  "preference",
  "summary",
  "hypothesis",
  "fact",
  "procedure",
]);
const MEMORY_STATUSES = new Set(["active", "superseded", "forgotten"]);
const EVIDENCE_OUTCOMES = new Set([
  "promoted",
  "rejected",
  "deferred",
  "observed",
]);

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, number))
    : fallback;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeSince(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Search time boundaries must be valid ISO dates.");
  return parsed.toISOString();
}

function normalizeForHash(value) {
  return normalizeText(value).toLocaleLowerCase("en-US");
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeTags(value) {
  const tags = Array.isArray(value) ? value : [];
  return [...new Set(tags.map(normalizeText).filter(Boolean))].slice(0, 50);
}

function redactSecrets(value) {
  const source = String(value || "");
  const rules = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]"],
    [/\b(?:sk|rk|pk)-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED API KEY]"],
    [/\b(?:ghp|github_pat|glpat|xox[baprs])-[_A-Za-z0-9-]{16,}\b/g, "[REDACTED TOKEN]"],
    [/\b(?:password|passwd|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*([^\s,;]{6,})/gi, (_match, _secret, offset, whole) => {
      const prefix = whole.slice(Math.max(0, offset - 32), offset);
      const key = prefix.match(/(?:password|passwd|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*$/i)?.[0] || "secret=";
      return `${key}[REDACTED]`;
    }],
  ];
  let result = source;
  for (const [pattern, replacement] of rules) {
    result = result.replace(pattern, replacement);
  }
  return { value: result, redacted: result !== source };
}

function tokenize(value) {
  return normalizeForHash(value)
    .match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) || [];
}

function ftsQuery(value) {
  return [...new Set(tokenize(value))]
    .slice(0, 20)
    .map((token) => `"${token.replaceAll('"', '""')}"*`)
    .join(" OR ");
}

function cosine(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length === 0) {
    return 0;
  }
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index]);
    const b = Number(right[index]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    dot += a * b;
    leftMagnitude += a * a;
    rightMagnitude += b * b;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function tokenJaccard(left, right) {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function reviewPair(leftId, rightId) {
  const pair = [String(leftId || ""), String(rightId || "")].sort();
  if (!pair[0] || !pair[1] || pair[0] === pair[1]) {
    throw new Error("A memory review requires two different memories.");
  }
  return { pairKey: sha256(JSON.stringify(pair)), leftId: pair[0], rightId: pair[1] };
}

function ensureParent(filePath) {
  if (filePath === ":memory:") return;
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function validateVector(vector) {
  if (!Array.isArray(vector) || vector.length < 2 || vector.length > 4096) {
    throw new Error("Embedding vectors must contain between 2 and 4096 numbers.");
  }
  const normalized = vector.map(Number);
  if (normalized.some((value) => !Number.isFinite(value))) {
    throw new Error("Embedding vectors may contain only finite numbers.");
  }
  return normalized;
}

function hydrateMemory(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id || null,
    kind: row.kind,
    scope: row.scope,
    title: row.title,
    summary: row.summary,
    content: row.content,
    status: row.status,
    confidence: row.confidence,
    importance: row.importance,
    pinned: Boolean(row.pinned),
    tags: safeJsonParse(row.tags_json, []),
    sourceId: row.source_id,
    sourceUri: row.source_uri,
    sourceExcerpt: row.source_excerpt,
    contentHash: row.content_hash,
    embeddingModel: row.embedding_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accessedAt: row.accessed_at,
    supersededBy: row.superseded_by,
    duplicateOf: row.duplicate_of,
    redacted: Boolean(row.redacted),
  };
}

function hydrateOrganization(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    edition: row.edition,
    dataResidency: row.data_residency,
    ownershipBoundary: row.ownership_boundary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hydrateWorkspace(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    kind: row.kind,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hydrateWorkspaceMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hydrateOrganizationAuditEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    eventType: row.event_type,
    actorLabel: row.actor_label,
    summary: row.summary,
    metadata: safeJsonParse(row.metadata_json, {}),
    occurredAt: row.occurred_at,
  };
}

function hydrateAutomation(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: Boolean(row.enabled),
    trigger: {
      type: row.trigger_type,
      config: safeJsonParse(row.trigger_config_json, {}),
    },
    conditionLogic: row.condition_logic,
    conditions: safeJsonParse(row.conditions_json, []),
    actions: safeJsonParse(row.actions_json, []),
    permissions: safeJsonParse(row.permissions_json, []),
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
  };
}

function hydrateAutomationRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    automationId: row.automation_id,
    automationName: row.automation_name,
    status: row.status,
    triggerType: row.trigger_type,
    triggerPayload: safeJsonParse(row.trigger_payload_json, {}),
    automationSnapshot: safeJsonParse(row.automation_snapshot_json, {}),
    steps: safeJsonParse(row.steps_json, []),
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
    retryOf: row.retry_of,
    dryRun: Boolean(row.dry_run),
  };
}

class MemoryStore {
  constructor(databasePath, options = {}) {
    if (!databasePath) throw new Error("A BRACE database path is required.");
    ensureParent(databasePath);
    this.databasePath = databasePath;
    this.db = new DatabaseSync(databasePath, {
      timeout: Number(options.timeoutMs) || 5_000,
    });
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    if (databasePath !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL;");
    const currentSchema = Number(this.db.prepare("PRAGMA user_version").get().user_version || 0);
    this.migrationBackup = null;
    if (currentSchema > 0 && currentSchema < SCHEMA_VERSION) {
      this.migrationBackup = {
        path: this.createPreMigrationBackup(currentSchema),
        from: currentSchema,
        to: SCHEMA_VERSION,
      };
    }
    this.migrate();
    this.organizations = new OrganizationRepository(this.db, (callback) => this.transaction(callback));
  }

  createPreMigrationBackup(currentSchema) {
    if (this.databasePath === ":memory:") return null;
    const directory = path.join(path.dirname(path.resolve(this.databasePath)), "recovery");
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.db.exec("PRAGMA wal_checkpoint(FULL)");
    const stamp = nowIso().replace(/[:.]/g, "-");
    const target = path.join(directory, `brace-pre-migration-v${currentSchema}-to-v${SCHEMA_VERSION}-${stamp}.sqlite3`);
    fs.copyFileSync(this.databasePath, target, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(target, 0o600);
    const check = new DatabaseSync(target, { readOnly: true });
    try {
      const result = check.prepare("PRAGMA quick_check").all().map((row) => String(row.quick_check));
      if (result.length !== 1 || result[0] !== "ok") {
        throw new Error("The automatic pre-migration backup failed its integrity check.");
      }
    } catch (error) {
      fs.rmSync(target, { force: true });
      throw error;
    } finally {
      check.close();
      fs.rmSync(`${target}-shm`, { force: true });
      fs.rmSync(`${target}-wal`, { force: true });
    }
    const backups = fs.readdirSync(directory)
      .filter((name) => /^brace-pre-migration-v\d+-to-v\d+-.*\.sqlite3$/.test(name))
      .sort()
      .reverse();
    for (const stale of backups.slice(5)) fs.rmSync(path.join(directory, stale), { force: true });
    return target;
  }

  quickCheck() {
    const details = this.db.prepare("PRAGMA quick_check").all().map((row) => String(row.quick_check || Object.values(row)[0] || ""));
    return { ok: details.length === 1 && details[0].toLowerCase() === "ok", details };
  }

  migrate() {
    const current = Number(this.db.prepare("PRAGMA user_version").get().user_version || 0);
    if (current > SCHEMA_VERSION) {
      throw new Error(`BRACE data schema ${current} is newer than this app supports (${SCHEMA_VERSION}).`);
    }
    if (current === 0) {
      this.db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE organizations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          edition TEXT NOT NULL DEFAULT 'team' CHECK(edition IN ('personal', 'team', 'enterprise')),
          data_residency TEXT NOT NULL DEFAULT 'local',
          ownership_boundary TEXT NOT NULL DEFAULT 'Company workspaces are governed; personal memory remains private.',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE workspaces (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'team' CHECK(kind IN ('personal', 'team', 'executive', 'project')),
          visibility TEXT NOT NULL DEFAULT 'team' CHECK(visibility IN ('personal', 'team', 'organization')),
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(organization_id, name)
        );
        CREATE INDEX workspaces_organization_idx ON workspaces(organization_id, status);
        CREATE TABLE workspace_members (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          display_name TEXT NOT NULL,
          email TEXT,
          role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'manager', 'member', 'guest', 'auditor')),
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'invited', 'suspended')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(workspace_id, email)
        );
        CREATE INDEX workspace_members_workspace_idx ON workspace_members(workspace_id, status);
        CREATE TABLE organization_audit_events (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
          event_type TEXT NOT NULL,
          actor_label TEXT NOT NULL,
          summary TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          occurred_at TEXT NOT NULL
        );
        CREATE INDEX organization_audit_time_idx ON organization_audit_events(organization_id, occurred_at DESC);
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          root_path TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_indexed_at TEXT
        );
        CREATE TABLE sources (
          id TEXT PRIMARY KEY,
          project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
          uri TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          media_type TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          mtime_ms REAL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          indexed_at TEXT NOT NULL
        );
        CREATE INDEX sources_project_idx ON sources(project_id);
        CREATE TABLE source_chunks (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
          ordinal INTEGER NOT NULL,
          heading TEXT NOT NULL DEFAULT '',
          content TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          embedding_model TEXT,
          embedding_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(source_id, ordinal)
        );
        CREATE INDEX source_chunks_source_idx ON source_chunks(source_id, ordinal);
        CREATE VIRTUAL TABLE source_chunks_fts USING fts5(
          heading,
          content,
          content='source_chunks',
          content_rowid='rowid',
          tokenize='unicode61 remove_diacritics 2'
        );
        CREATE TRIGGER source_chunks_ai AFTER INSERT ON source_chunks BEGIN
          INSERT INTO source_chunks_fts(rowid, heading, content)
          VALUES (new.rowid, new.heading, new.content);
        END;
        CREATE TRIGGER source_chunks_ad AFTER DELETE ON source_chunks BEGIN
          INSERT INTO source_chunks_fts(source_chunks_fts, rowid, heading, content)
          VALUES ('delete', old.rowid, old.heading, old.content);
        END;
        CREATE TRIGGER source_chunks_au AFTER UPDATE ON source_chunks BEGIN
          INSERT INTO source_chunks_fts(source_chunks_fts, rowid, heading, content)
          VALUES ('delete', old.rowid, old.heading, old.content);
          INSERT INTO source_chunks_fts(rowid, heading, content)
          VALUES (new.rowid, new.heading, new.content);
        END;
        CREATE TABLE memories (
          id TEXT PRIMARY KEY,
          workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
          kind TEXT NOT NULL,
          scope TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          content TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          confidence REAL NOT NULL DEFAULT 0.7,
          importance REAL NOT NULL DEFAULT 0.5,
          pinned INTEGER NOT NULL DEFAULT 0,
          tags_json TEXT NOT NULL DEFAULT '[]',
          source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
          source_uri TEXT,
          source_excerpt TEXT,
          content_hash TEXT NOT NULL,
          embedding_model TEXT,
          embedding_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          accessed_at TEXT NOT NULL,
          superseded_by TEXT REFERENCES memories(id) ON DELETE SET NULL,
          duplicate_of TEXT REFERENCES memories(id) ON DELETE SET NULL,
          redacted INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX memories_scope_status_idx ON memories(scope, status);
        CREATE INDEX memories_hash_idx ON memories(content_hash, status);
        CREATE INDEX memories_updated_idx ON memories(updated_at DESC);
        CREATE INDEX memories_pinned_idx ON memories(status, pinned DESC, importance DESC, updated_at DESC);
        CREATE VIRTUAL TABLE memories_fts USING fts5(
          title,
          summary,
          content,
          tags,
          content='memories',
          content_rowid='rowid',
          tokenize='unicode61 remove_diacritics 2'
        );
        CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
          INSERT INTO memories_fts(rowid, title, summary, content, tags)
          VALUES (new.rowid, new.title, new.summary, new.content, new.tags_json);
        END;
        CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
          INSERT INTO memories_fts(memories_fts, rowid, title, summary, content, tags)
          VALUES ('delete', old.rowid, old.title, old.summary, old.content, old.tags_json);
        END;
        CREATE TRIGGER memories_au AFTER UPDATE ON memories BEGIN
          INSERT INTO memories_fts(memories_fts, rowid, title, summary, content, tags)
          VALUES ('delete', old.rowid, old.title, old.summary, old.content, old.tags_json);
          INSERT INTO memories_fts(rowid, title, summary, content, tags)
          VALUES (new.rowid, new.title, new.summary, new.content, new.tags_json);
        END;
        CREATE TABLE evidence (
          id TEXT PRIMARY KEY,
          memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
          outcome TEXT NOT NULL,
          summary TEXT NOT NULL,
          reference TEXT NOT NULL,
          observed_at TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX evidence_memory_idx ON evidence(memory_id, observed_at DESC);
        CREATE TABLE decisions (
          id TEXT PRIMARY KEY,
          project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          context TEXT NOT NULL,
          decision TEXT NOT NULL,
          rationale TEXT NOT NULL,
          alternatives_json TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'accepted',
          decided_at TEXT NOT NULL,
          source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
          supersedes_id TEXT REFERENCES decisions(id) ON DELETE SET NULL
        );
        CREATE INDEX decisions_project_time_idx ON decisions(project_id, decided_at DESC);
        CREATE TABLE events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          memory_id TEXT REFERENCES memories(id) ON DELETE SET NULL,
          decision_id TEXT REFERENCES decisions(id) ON DELETE SET NULL,
          project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
          source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX events_time_idx ON events(occurred_at DESC);
        CREATE INDEX events_project_time_idx ON events(project_id, occurred_at DESC);
        CREATE TABLE entities (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          normalized_name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(entity_type, normalized_name)
        );
        CREATE TABLE relations (
          id TEXT PRIMARY KEY,
          from_type TEXT NOT NULL,
          from_id TEXT NOT NULL,
          to_type TEXT NOT NULL,
          to_id TEXT NOT NULL,
          relation TEXT NOT NULL,
          weight REAL NOT NULL DEFAULT 1,
          source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          UNIQUE(from_type, from_id, to_type, to_id, relation)
        );
        CREATE INDEX relations_from_idx ON relations(from_type, from_id);
        CREATE INDEX relations_to_idx ON relations(to_type, to_id);
        CREATE TABLE skills (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          version TEXT NOT NULL,
          manifest_json TEXT NOT NULL,
          install_path TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 0,
          permissions_json TEXT NOT NULL DEFAULT '[]',
          checksum TEXT NOT NULL,
          installed_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memory_reviews (
          pair_key TEXT PRIMARY KEY,
          left_memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
          right_memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
          outcome TEXT NOT NULL CHECK(outcome IN ('distinct', 'keep-left', 'keep-right')),
          canonical_memory_id TEXT REFERENCES memories(id) ON DELETE SET NULL,
          reviewed_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS memory_reviews_time_idx ON memory_reviews(reviewed_at DESC);
        CREATE TABLE automations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          enabled INTEGER NOT NULL DEFAULT 0,
          trigger_type TEXT NOT NULL,
          trigger_config_json TEXT NOT NULL DEFAULT '{}',
          condition_logic TEXT NOT NULL DEFAULT 'and' CHECK(condition_logic IN ('and', 'or')),
          conditions_json TEXT NOT NULL DEFAULT '[]',
          actions_json TEXT NOT NULL DEFAULT '[]',
          permissions_json TEXT NOT NULL DEFAULT '[]',
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_run_at TEXT,
          next_run_at TEXT
        );
        CREATE INDEX automations_due_idx ON automations(enabled, next_run_at);
        CREATE TABLE automation_runs (
          id TEXT PRIMARY KEY,
          automation_id TEXT REFERENCES automations(id) ON DELETE SET NULL,
          automation_name TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed', 'skipped', 'preview')),
          trigger_type TEXT NOT NULL,
          trigger_payload_json TEXT NOT NULL DEFAULT '{}',
          automation_snapshot_json TEXT NOT NULL DEFAULT '{}',
          steps_json TEXT NOT NULL DEFAULT '[]',
          error TEXT,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          duration_ms INTEGER,
          retry_of TEXT REFERENCES automation_runs(id) ON DELETE SET NULL,
          dry_run INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX automation_runs_time_idx ON automation_runs(started_at DESC);
        CREATE INDEX automation_runs_status_idx ON automation_runs(status, started_at DESC);
        PRAGMA user_version = 6;
        COMMIT;
      `);
    }
    if (current === 1) {
      this.db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE source_chunks (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
          ordinal INTEGER NOT NULL,
          heading TEXT NOT NULL DEFAULT '',
          content TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          embedding_model TEXT,
          embedding_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(source_id, ordinal)
        );
        CREATE INDEX source_chunks_source_idx ON source_chunks(source_id, ordinal);
        CREATE VIRTUAL TABLE source_chunks_fts USING fts5(
          heading,
          content,
          content='source_chunks',
          content_rowid='rowid',
          tokenize='unicode61 remove_diacritics 2'
        );
        CREATE TRIGGER source_chunks_ai AFTER INSERT ON source_chunks BEGIN
          INSERT INTO source_chunks_fts(rowid, heading, content)
          VALUES (new.rowid, new.heading, new.content);
        END;
        CREATE TRIGGER source_chunks_ad AFTER DELETE ON source_chunks BEGIN
          INSERT INTO source_chunks_fts(source_chunks_fts, rowid, heading, content)
          VALUES ('delete', old.rowid, old.heading, old.content);
        END;
        CREATE TRIGGER source_chunks_au AFTER UPDATE ON source_chunks BEGIN
          INSERT INTO source_chunks_fts(source_chunks_fts, rowid, heading, content)
          VALUES ('delete', old.rowid, old.heading, old.content);
          INSERT INTO source_chunks_fts(rowid, heading, content)
          VALUES (new.rowid, new.heading, new.content);
        END;
        PRAGMA user_version = 2;
        COMMIT;
      `);
    }
    if (current > 0 && current < 3) {
      this.db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS memory_reviews (
          pair_key TEXT PRIMARY KEY,
          left_memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
          right_memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
          outcome TEXT NOT NULL CHECK(outcome IN ('distinct', 'keep-left', 'keep-right')),
          canonical_memory_id TEXT REFERENCES memories(id) ON DELETE SET NULL,
          reviewed_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS memory_reviews_time_idx ON memory_reviews(reviewed_at DESC);
        PRAGMA user_version = 3;
        COMMIT;
      `);
    }
    if (current > 0 && current < 4) {
      this.db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS automations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          enabled INTEGER NOT NULL DEFAULT 0,
          trigger_type TEXT NOT NULL,
          trigger_config_json TEXT NOT NULL DEFAULT '{}',
          condition_logic TEXT NOT NULL DEFAULT 'and' CHECK(condition_logic IN ('and', 'or')),
          conditions_json TEXT NOT NULL DEFAULT '[]',
          actions_json TEXT NOT NULL DEFAULT '[]',
          permissions_json TEXT NOT NULL DEFAULT '[]',
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_run_at TEXT,
          next_run_at TEXT
        );
        CREATE INDEX IF NOT EXISTS automations_due_idx ON automations(enabled, next_run_at);
        CREATE TABLE IF NOT EXISTS automation_runs (
          id TEXT PRIMARY KEY,
          automation_id TEXT REFERENCES automations(id) ON DELETE SET NULL,
          automation_name TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed', 'skipped', 'preview')),
          trigger_type TEXT NOT NULL,
          trigger_payload_json TEXT NOT NULL DEFAULT '{}',
          automation_snapshot_json TEXT NOT NULL DEFAULT '{}',
          steps_json TEXT NOT NULL DEFAULT '[]',
          error TEXT,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          duration_ms INTEGER,
          retry_of TEXT REFERENCES automation_runs(id) ON DELETE SET NULL,
          dry_run INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS automation_runs_time_idx ON automation_runs(started_at DESC);
        CREATE INDEX IF NOT EXISTS automation_runs_status_idx ON automation_runs(status, started_at DESC);
        PRAGMA user_version = 4;
        COMMIT;
      `);
    }
    if (current > 0 && current < 5) {
      const hasPinned = this.db.prepare("PRAGMA table_info(memories)").all()
        .some((column) => column.name === "pinned");
      this.db.exec("BEGIN IMMEDIATE");
      try {
        if (!hasPinned) this.db.exec("ALTER TABLE memories ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS memories_pinned_idx
            ON memories(status, pinned DESC, importance DESC, updated_at DESC);
          PRAGMA user_version = 5;
          COMMIT;
        `);
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
    if (current > 0 && current < 6) {
      const projectColumns = this.db.prepare("PRAGMA table_info(projects)").all();
      const memoryColumns = this.db.prepare("PRAGMA table_info(memories)").all();
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            edition TEXT NOT NULL DEFAULT 'team' CHECK(edition IN ('personal', 'team', 'enterprise')),
            data_residency TEXT NOT NULL DEFAULT 'local',
            ownership_boundary TEXT NOT NULL DEFAULT 'Company workspaces are governed; personal memory remains private.',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            kind TEXT NOT NULL DEFAULT 'team' CHECK(kind IN ('personal', 'team', 'executive', 'project')),
            visibility TEXT NOT NULL DEFAULT 'team' CHECK(visibility IN ('personal', 'team', 'organization')),
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(organization_id, name)
          );
          CREATE INDEX IF NOT EXISTS workspaces_organization_idx ON workspaces(organization_id, status);
          CREATE TABLE IF NOT EXISTS workspace_members (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            display_name TEXT NOT NULL,
            email TEXT,
            role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'manager', 'member', 'guest', 'auditor')),
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'invited', 'suspended')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(workspace_id, email)
          );
          CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx ON workspace_members(workspace_id, status);
          CREATE TABLE IF NOT EXISTS organization_audit_events (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
            event_type TEXT NOT NULL,
            actor_label TEXT NOT NULL,
            summary TEXT NOT NULL,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            occurred_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS organization_audit_time_idx
            ON organization_audit_events(organization_id, occurred_at DESC);
        `);
        if (!projectColumns.some((column) => column.name === "workspace_id")) {
          this.db.exec("ALTER TABLE projects ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL");
        }
        if (!memoryColumns.some((column) => column.name === "workspace_id")) {
          this.db.exec("ALTER TABLE memories ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL");
        }
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS projects_workspace_idx ON projects(workspace_id, updated_at DESC);
          CREATE INDEX IF NOT EXISTS memories_workspace_idx ON memories(workspace_id, status, updated_at DESC);
          PRAGMA user_version = 6;
          COMMIT;
        `);
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
    return { from: current, to: SCHEMA_VERSION };
  }

  close() {
    this.db.close();
  }

  transaction(callback) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = callback();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  createOrganization(input = {}) { return this.organizations.create(input); }
  listOrganizations() { return this.organizations.list(); }
  createWorkspace(input = {}) { return this.organizations.createWorkspace(input); }
  upsertWorkspaceMember(input = {}) { return this.organizations.upsertMember(input); }
  insertOrganizationAuditEvent(input = {}) { return this.organizations.insertAudit(input); }
  getOrganizationOverview(organizationId) { return this.organizations.overview(organizationId); }

  upsertProject(input) {
    const rootPath = path.resolve(String(input.rootPath || ""));
    if (!input.rootPath || rootPath === path.parse(rootPath).root) {
      throw new Error("A project must use a specific non-root directory.");
    }
    const timestamp = nowIso();
    const existing = this.db.prepare("SELECT * FROM projects WHERE root_path = ?").get(rootPath);
    const id = existing?.id || String(input.id || randomUUID());
    const name = normalizeText(input.name || path.basename(rootPath)).slice(0, 120);
    this.db.prepare(`
      INSERT INTO projects(id, workspace_id, name, root_path, created_at, updated_at, last_indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(root_path) DO UPDATE SET
        workspace_id=COALESCE(excluded.workspace_id, projects.workspace_id),
        name=excluded.name,
        updated_at=excluded.updated_at,
        last_indexed_at=COALESCE(excluded.last_indexed_at, projects.last_indexed_at)
    `).run(id, input.workspaceId || null, name, rootPath, timestamp, timestamp, input.lastIndexedAt || null);
    return this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  }

  listProjects() {
    return this.db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all();
  }

  upsertSource(input) {
    const uri = normalizeText(input.uri);
    if (!uri) throw new Error("A source URI is required.");
    const timestamp = nowIso();
    const existing = this.db.prepare("SELECT id, created_at FROM sources WHERE uri = ?").get(uri);
    const id = existing?.id || String(input.id || randomUUID());
    this.db.prepare(`
      INSERT INTO sources(
        id, project_id, uri, title, media_type, content_hash, mtime_ms,
        metadata_json, created_at, updated_at, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(uri) DO UPDATE SET
        project_id=excluded.project_id,
        title=excluded.title,
        media_type=excluded.media_type,
        content_hash=excluded.content_hash,
        mtime_ms=excluded.mtime_ms,
        metadata_json=excluded.metadata_json,
        updated_at=excluded.updated_at,
        indexed_at=excluded.indexed_at
    `).run(
      id,
      input.projectId || null,
      uri,
      normalizeText(input.title || uri).slice(0, 240),
      normalizeText(input.mediaType || "text/plain").slice(0, 120),
      normalizeText(input.contentHash || sha256(uri)),
      Number.isFinite(Number(input.mtimeMs)) ? Number(input.mtimeMs) : null,
      JSON.stringify(input.metadata || {}),
      existing?.created_at || timestamp,
      timestamp,
      timestamp,
    );
    return this.getSource(id);
  }

  getSource(id) {
    const row = this.db.prepare("SELECT * FROM sources WHERE id = ?").get(id);
    if (!row) return null;
    return { ...row, metadata: safeJsonParse(row.metadata_json, {}) };
  }

  getSourceByUri(uri) {
    const row = this.db.prepare("SELECT * FROM sources WHERE uri = ?").get(String(uri || ""));
    if (!row) return null;
    return { ...row, metadata: safeJsonParse(row.metadata_json, {}) };
  }

  replaceSourceChunks(sourceId, chunks) {
    const source = this.getSource(sourceId);
    if (!source) throw new Error("Source not found.");
    const prepared = (Array.isArray(chunks) ? chunks : []).map((chunk, ordinal) => {
      const content = String(chunk.content || "").trim().slice(0, 200_000);
      if (!content) return null;
      return {
        id: String(chunk.id || sha256(`${sourceId}:${ordinal}:${content}`).slice(0, 32)),
        ordinal,
        heading: normalizeText(chunk.heading).slice(0, 400),
        content,
        contentHash: sha256(normalizeForHash(content)),
      };
    }).filter(Boolean);
    const timestamp = nowIso();
    this.transaction(() => {
      this.db.prepare("DELETE FROM source_chunks WHERE source_id = ?").run(sourceId);
      const insert = this.db.prepare(`
        INSERT INTO source_chunks(
          id, source_id, ordinal, heading, content, content_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const chunk of prepared) {
        insert.run(
          chunk.id,
          sourceId,
          chunk.ordinal,
          chunk.heading,
          chunk.content,
          chunk.contentHash,
          timestamp,
          timestamp,
        );
      }
    });
    return prepared;
  }

  commitIndexedSource(input, chunks, embedding = null) {
    const uri = normalizeText(input.uri);
    if (!uri) throw new Error("A source URI is required.");
    const existing = this.db.prepare("SELECT id, created_at FROM sources WHERE uri = ?").get(uri);
    const sourceId = existing?.id || String(input.id || randomUUID());
    const timestamp = nowIso();
    const prepared = (Array.isArray(chunks) ? chunks : []).map((chunk, ordinal) => {
      const content = String(chunk.content || "").trim().slice(0, 200_000);
      if (!content) return null;
      return {
        id: String(chunk.id || sha256(`${sourceId}:${ordinal}:${content}`).slice(0, 32)),
        ordinal,
        heading: normalizeText(chunk.heading).slice(0, 400),
        content,
        contentHash: sha256(normalizeForHash(content)),
      };
    }).filter(Boolean);
    const embeddingModel = embedding?.model ? normalizeText(embedding.model).slice(0, 180) : null;
    const vectors = embeddingModel
      ? (Array.isArray(embedding.vectors) ? embedding.vectors.map(validateVector) : [])
      : [];
    if (embeddingModel && vectors.length !== prepared.length) {
      throw new Error("The embedding adapter returned an unexpected vector count.");
    }
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO sources(
          id, project_id, uri, title, media_type, content_hash, mtime_ms,
          metadata_json, created_at, updated_at, indexed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(uri) DO UPDATE SET
          project_id=excluded.project_id,
          title=excluded.title,
          media_type=excluded.media_type,
          content_hash=excluded.content_hash,
          mtime_ms=excluded.mtime_ms,
          metadata_json=excluded.metadata_json,
          updated_at=excluded.updated_at,
          indexed_at=excluded.indexed_at
      `).run(
        sourceId,
        input.projectId || null,
        uri,
        normalizeText(input.title || uri).slice(0, 240),
        normalizeText(input.mediaType || "text/plain").slice(0, 120),
        normalizeText(input.contentHash || sha256(uri)),
        Number.isFinite(Number(input.mtimeMs)) ? Number(input.mtimeMs) : null,
        JSON.stringify(input.metadata || {}),
        existing?.created_at || timestamp,
        timestamp,
        timestamp,
      );
      this.db.prepare("DELETE FROM source_chunks WHERE source_id = ?").run(sourceId);
      this.db.prepare("DELETE FROM relations WHERE from_type = 'source' AND from_id = ?").run(sourceId);
      const insert = this.db.prepare(`
        INSERT INTO source_chunks(
          id, source_id, ordinal, heading, content, content_hash,
          embedding_model, embedding_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (let index = 0; index < prepared.length; index += 1) {
        const chunk = prepared[index];
        insert.run(
          chunk.id,
          sourceId,
          chunk.ordinal,
          chunk.heading,
          chunk.content,
          chunk.contentHash,
          embeddingModel,
          embeddingModel ? JSON.stringify(vectors[index]) : null,
          timestamp,
          timestamp,
        );
      }
    });
    return { source: this.getSource(sourceId), chunks: prepared };
  }

  listSourceChunks(sourceId) {
    return this.db.prepare(`
      SELECT id, source_id AS sourceId, ordinal, heading, content, content_hash AS contentHash,
        embedding_model AS embeddingModel, created_at AS createdAt, updated_at AS updatedAt
      FROM source_chunks WHERE source_id = ? ORDER BY ordinal
    `).all(sourceId);
  }

  upsertSourceChunkEmbedding(chunkId, model, vector) {
    const embeddingModel = normalizeText(model).slice(0, 180);
    if (!embeddingModel) throw new Error("An embedding model identifier is required.");
    const normalized = validateVector(vector);
    const result = this.db.prepare(`
      UPDATE source_chunks SET embedding_model=?, embedding_json=?, updated_at=? WHERE id=?
    `).run(embeddingModel, JSON.stringify(normalized), nowIso(), chunkId);
    if (Number(result.changes) !== 1) throw new Error("Source chunk not found.");
    return { chunkId, model: embeddingModel, dimensions: normalized.length };
  }

  searchSources(query, options = {}) {
    const clean = normalizeText(query);
    if (!clean) return { mode: "lexical", query: clean, results: [] };
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const candidateLimit = Math.min(500, Math.max(limit * 5, 50));
    const since = normalizeSince(options.since);
    const lexical = [];
    const match = ftsQuery(clean);
    if (match) {
      const filters = ["source_chunks_fts MATCH ?"];
      const params = [match];
      if (options.projectId) {
        filters.push("s.project_id = ?");
        params.push(options.projectId);
      }
      if (since) {
        filters.push("c.updated_at >= ?");
        params.push(since);
      }
      params.push(candidateLimit);
      this.db.prepare(`
        SELECT c.*, s.title AS source_title, s.uri AS source_uri,
          s.project_id, s.media_type, bm25(source_chunks_fts, 5.0, 1.0) AS lexical_rank
        FROM source_chunks_fts
        JOIN source_chunks c ON c.rowid = source_chunks_fts.rowid
        JOIN sources s ON s.id = c.source_id
        WHERE ${filters.join(" AND ")}
        ORDER BY lexical_rank ASC LIMIT ?
      `).all(...params).forEach((row, index) => lexical.push({ row, rank: index + 1 }));
    }

    const queryVector = options.queryVector ? validateVector(options.queryVector) : null;
    const embeddingModel = queryVector ? normalizeText(options.embeddingModel) : "";
    const semantic = [];
    if (queryVector && embeddingModel) {
      const filters = ["c.embedding_model = ?", "c.embedding_json IS NOT NULL"];
      const params = [embeddingModel];
      if (options.projectId) {
        filters.push("s.project_id = ?");
        params.push(options.projectId);
      }
      if (since) {
        filters.push("c.updated_at >= ?");
        params.push(since);
      }
      this.db.prepare(`
        SELECT c.*, s.title AS source_title, s.uri AS source_uri,
          s.project_id, s.media_type
        FROM source_chunks c JOIN sources s ON s.id = c.source_id
        WHERE ${filters.join(" AND ")} ORDER BY c.updated_at DESC LIMIT 10000
      `).all(...params)
        .map((row) => ({ row, similarity: cosine(queryVector, safeJsonParse(row.embedding_json, [])) }))
        .filter((item) => item.similarity > 0)
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, candidateLimit)
        .forEach((item, index) => semantic.push({ ...item, rank: index + 1 }));
    }

    const combined = new Map();
    const add = (item, channel, weight) => {
      const current = combined.get(item.row.id) || {
        row: item.row,
        score: 0,
        lexicalRank: null,
        semanticRank: null,
        semanticSimilarity: null,
      };
      current.score += weight / (60 + item.rank);
      current[`${channel}Rank`] = item.rank;
      if (channel === "semantic") current.semanticSimilarity = item.similarity;
      combined.set(item.row.id, current);
    };
    lexical.forEach((item) => add(item, "lexical", semantic.length ? 0.65 : 1));
    semantic.forEach((item) => add(item, "semantic", lexical.length ? 0.35 : 1));
    return {
      mode: semantic.length && lexical.length ? "hybrid" : semantic.length ? "semantic" : "lexical",
      query: clean,
      embeddingModel: semantic.length ? embeddingModel : null,
      results: [...combined.values()]
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map((item) => ({
          id: item.row.id,
          sourceId: item.row.source_id,
          projectId: item.row.project_id,
          sourceTitle: item.row.source_title,
          sourceUri: item.row.source_uri,
          mediaType: item.row.media_type,
          ordinal: item.row.ordinal,
          heading: item.row.heading,
          content: item.row.content,
          retrieval: {
            score: item.score,
            lexicalRank: item.lexicalRank,
            semanticRank: item.semanticRank,
            semanticSimilarity: item.semanticSimilarity,
          },
        })),
    };
  }

  removeMissingSources(projectId, retainedUris) {
    const retained = new Set((retainedUris || []).map(String));
    const rows = this.db.prepare("SELECT id, uri FROM sources WHERE project_id = ?").all(projectId);
    const remove = this.db.prepare("DELETE FROM sources WHERE id = ?");
    let removed = 0;
    this.transaction(() => {
      for (const row of rows) {
        if (retained.has(row.uri)) continue;
        remove.run(row.id);
        removed += 1;
      }
    });
    return removed;
  }

  createMemory(input) {
    const kind = MEMORY_KINDS.has(input.kind) ? input.kind : "fact";
    const scope = normalizeText(input.scope || "global").slice(0, 180);
    const titleRedaction = redactSecrets(normalizeText(input.title));
    const summaryRedaction = redactSecrets(normalizeText(input.summary));
    const contentRedaction = redactSecrets(String(input.content || "").trim());
    const title = titleRedaction.value.slice(0, 240);
    const content = contentRedaction.value.slice(0, 200_000);
    const summary = (summaryRedaction.value || content.slice(0, 400)).slice(0, 600);
    if (!title || !content) throw new Error("A memory requires a title and content.");
    const contentHash = sha256([scope, kind, normalizeForHash(content)].join("\n"));
    const exact = this.db.prepare(`
      SELECT * FROM memories
      WHERE content_hash = ? AND status = 'active'
      ORDER BY updated_at DESC LIMIT 1
    `).get(contentHash);
    if (exact) return { memory: hydrateMemory(exact), duplicate: true };

    const candidates = this.db.prepare(`
      SELECT id, title, summary, content FROM memories
      WHERE scope = ? AND kind = ? AND status = 'active'
      ORDER BY updated_at DESC LIMIT 100
    `).all(scope, kind);
    const duplicateCandidate = candidates
      .map((candidate) => ({
        id: candidate.id,
        similarity: Math.max(
          tokenJaccard(title, candidate.title),
          tokenJaccard(`${title} ${summary}`, `${candidate.title} ${candidate.summary}`),
          tokenJaccard(content, candidate.content),
        ),
      }))
      .sort((left, right) => right.similarity - left.similarity)[0];
    // Near duplicates are suggestions only. Exact hashes above are the sole
    // automatic reuse path, so this threshold can favor recall without
    // silently merging conflicting memories.
    const duplicateOf = duplicateCandidate?.similarity >= 0.7
      ? duplicateCandidate.id
      : null;
    const id = String(input.id || randomUUID());
    const timestamp = nowIso();
    const redacted = titleRedaction.redacted || summaryRedaction.redacted || contentRedaction.redacted;
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO memories(
          id, workspace_id, kind, scope, title, summary, content, status, confidence,
          importance, pinned, tags_json, source_id, source_uri, source_excerpt,
          content_hash, created_at, updated_at, accessed_at, duplicate_of, redacted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.workspaceId || null,
        kind,
        scope,
        title,
        summary,
        content,
        clamp(input.confidence, 0, 1, 0.7),
        clamp(input.importance, 0, 1, 0.5),
        input.pinned ? 1 : 0,
        JSON.stringify(normalizeTags(input.tags)),
        input.sourceId || null,
        normalizeText(input.sourceUri) || null,
        redactSecrets(normalizeText(input.sourceExcerpt)).value.slice(0, 1_000) || null,
        contentHash,
        timestamp,
        timestamp,
        timestamp,
        duplicateOf,
        redacted ? 1 : 0,
      );
      this.insertEvent({
        eventType: "memory.created",
        title: `Remembered: ${title}`,
        summary,
        memoryId: id,
        projectId: input.projectId || null,
        sourceId: input.sourceId || null,
      });
    });
    return {
      memory: this.getMemory(id),
      duplicate: false,
      duplicateCandidate: duplicateOf
        ? { id: duplicateOf, similarity: duplicateCandidate.similarity }
        : null,
    };
  }

  getMemory(id, options = {}) {
    const row = this.db.prepare("SELECT * FROM memories WHERE id = ?").get(String(id || ""));
    if (!row) return null;
    const memory = hydrateMemory(row);
    if (options.includeEvidence) {
      memory.evidence = this.db.prepare(`
        SELECT id, outcome, summary, reference, observed_at AS observedAt, metadata_json
        FROM evidence WHERE memory_id = ? ORDER BY observed_at DESC
      `).all(row.id).map((item) => ({
        ...item,
        metadata: safeJsonParse(item.metadata_json, {}),
        metadata_json: undefined,
      }));
    }
    return memory;
  }

  listMemories(options = {}) {
    const status = MEMORY_STATUSES.has(options.status) ? options.status : "active";
    const limit = Math.min(500, Math.max(1, Number(options.limit) || 100));
    const filters = ["status = ?"];
    const params = [status];
    if (options.scope) {
      filters.push("scope = ?");
      params.push(normalizeText(options.scope));
    }
    if (options.workspaceId) {
      filters.push("workspace_id = ?");
      params.push(String(options.workspaceId));
    }
    if (options.kind && MEMORY_KINDS.has(options.kind)) {
      filters.push("kind = ?");
      params.push(options.kind);
    }
    if (options.pinned === true) filters.push("pinned = 1");
    params.push(limit);
    return this.db.prepare(`
      SELECT * FROM memories WHERE ${filters.join(" AND ")}
      ORDER BY pinned DESC, importance DESC, updated_at DESC LIMIT ?
    `).all(...params).map(hydrateMemory);
  }

  updateMemory(id, changes) {
    const current = this.getMemory(id);
    if (!current) throw new Error("Memory not found.");
    const merged = {
      ...current,
      ...changes,
      id: current.id,
      kind: MEMORY_KINDS.has(changes.kind) ? changes.kind : current.kind,
      status: MEMORY_STATUSES.has(changes.status) ? changes.status : current.status,
    };
    const title = redactSecrets(normalizeText(merged.title)).value.slice(0, 240);
    const summary = redactSecrets(normalizeText(merged.summary)).value.slice(0, 600);
    const content = redactSecrets(String(merged.content || "").trim()).value.slice(0, 200_000);
    if (!title || !content) throw new Error("A memory requires a title and content.");
    const timestamp = nowIso();
    const reviewRelevantChange = current.kind !== merged.kind ||
      current.scope !== normalizeText(merged.scope || "global") ||
      current.title !== title || current.summary !== summary || current.content !== content;
    this.db.prepare(`
      UPDATE memories SET
        workspace_id=?, kind=?, scope=?, title=?, summary=?, content=?, status=?, confidence=?,
        importance=?, pinned=?, tags_json=?, source_uri=?, source_excerpt=?, content_hash=?,
        updated_at=?, superseded_by=?
      WHERE id=?
    `).run(
      merged.workspaceId || null,
      merged.kind,
      normalizeText(merged.scope || "global"),
      title,
      summary,
      content,
      merged.status,
      clamp(merged.confidence, 0, 1, 0.7),
      clamp(merged.importance, 0, 1, 0.5),
      merged.pinned ? 1 : 0,
      JSON.stringify(normalizeTags(merged.tags)),
      normalizeText(merged.sourceUri) || null,
      redactSecrets(normalizeText(merged.sourceExcerpt)).value.slice(0, 1_000) || null,
      sha256([merged.scope, merged.kind, normalizeForHash(content)].join("\n")),
      timestamp,
      merged.supersededBy || null,
      current.id,
    );
    if (reviewRelevantChange) {
      this.db.prepare(`
        DELETE FROM memory_reviews WHERE left_memory_id = ? OR right_memory_id = ?
      `).run(current.id, current.id);
    }
    return this.getMemory(current.id);
  }

  setMemoryPinned(id, pinned) {
    const memory = this.getMemory(id);
    if (!memory || memory.status !== "active") throw new Error("An active memory is required.");
    this.db.prepare("UPDATE memories SET pinned = ?, updated_at = ? WHERE id = ?")
      .run(pinned ? 1 : 0, nowIso(), memory.id);
    return this.getMemory(memory.id);
  }

  touchMemory(id) {
    this.db.prepare("UPDATE memories SET accessed_at = ? WHERE id = ?").run(nowIso(), id);
  }

  upsertEmbedding(memoryId, model, vector) {
    const memory = this.getMemory(memoryId);
    if (!memory || memory.status !== "active") throw new Error("An active memory is required.");
    const embeddingModel = normalizeText(model).slice(0, 180);
    if (!embeddingModel) throw new Error("An embedding model identifier is required.");
    const normalized = validateVector(vector);
    this.db.prepare(`
      UPDATE memories SET embedding_model = ?, embedding_json = ?, updated_at = ? WHERE id = ?
    `).run(embeddingModel, JSON.stringify(normalized), nowIso(), memoryId);
    return { memoryId, model: embeddingModel, dimensions: normalized.length };
  }

  search(query, options = {}) {
    const clean = normalizeText(query);
    if (!clean) return { mode: "lexical", query: clean, results: [] };
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const candidateLimit = Math.min(500, Math.max(limit * 5, 50));
    const since = normalizeSince(options.since);
    const lexical = [];
    const match = ftsQuery(clean);
    if (match) {
      const filters = ["m.status = 'active'", "memories_fts MATCH ?"];
      const params = [match];
      if (options.scope) {
        filters.push("m.scope = ?");
        params.push(normalizeText(options.scope));
      }
      if (since) {
        filters.push("m.updated_at >= ?");
        params.push(since);
      }
      if (Array.isArray(options.kinds) && options.kinds.length) {
        const kinds = options.kinds.filter((kind) => MEMORY_KINDS.has(kind));
        if (kinds.length) {
          filters.push(`m.kind IN (${kinds.map(() => "?").join(",")})`);
          params.push(...kinds);
        }
      }
      params.push(candidateLimit);
      const rows = this.db.prepare(`
        SELECT m.*, bm25(memories_fts, 7.0, 4.0, 1.0, 3.0) AS lexical_rank
        FROM memories_fts
        JOIN memories m ON m.rowid = memories_fts.rowid
        WHERE ${filters.join(" AND ")}
        ORDER BY lexical_rank ASC
        LIMIT ?
      `).all(...params);
      rows.forEach((row, index) => lexical.push({ row, rank: index + 1 }));
    }

    const queryVector = options.queryVector ? validateVector(options.queryVector) : null;
    const embeddingModel = queryVector ? normalizeText(options.embeddingModel) : "";
    const semantic = [];
    if (queryVector && embeddingModel) {
      const filters = [
        "status = 'active'",
        "embedding_model = ?",
        "embedding_json IS NOT NULL",
      ];
      const params = [embeddingModel];
      if (options.scope) {
        filters.push("scope = ?");
        params.push(normalizeText(options.scope));
      }
      if (since) {
        filters.push("updated_at >= ?");
        params.push(since);
      }
      const rows = this.db.prepare(`
        SELECT * FROM memories WHERE ${filters.join(" AND ")}
        ORDER BY updated_at DESC LIMIT 5000
      `).all(...params);
      rows
        .map((row) => ({ row, similarity: cosine(queryVector, safeJsonParse(row.embedding_json, [])) }))
        .filter((item) => item.similarity > 0)
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, candidateLimit)
        .forEach((item, index) => semantic.push({ ...item, rank: index + 1 }));
    }

    const combined = new Map();
    const add = (item, channel, weight) => {
      const current = combined.get(item.row.id) || {
        row: item.row,
        score: 0,
        lexicalRank: null,
        semanticRank: null,
        semanticSimilarity: null,
      };
      current.score += weight / (60 + item.rank);
      current[`${channel}Rank`] = item.rank;
      if (channel === "semantic") current.semanticSimilarity = item.similarity;
      combined.set(item.row.id, current);
    };
    lexical.forEach((item) => add(item, "lexical", semantic.length ? 0.65 : 1));
    semantic.forEach((item) => add(item, "semantic", lexical.length ? 0.35 : 1));
    const results = [...combined.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((item) => ({
        ...hydrateMemory(item.row),
        retrieval: {
          score: item.score,
          lexicalRank: item.lexicalRank,
          semanticRank: item.semanticRank,
          semanticSimilarity: item.semanticSimilarity,
        },
      }));
    return {
      mode: semantic.length && lexical.length ? "hybrid" : semantic.length ? "semantic" : "lexical",
      query: clean,
      embeddingModel: semantic.length ? embeddingModel : null,
      results,
    };
  }

  addEvidence(memoryId, input) {
    if (!this.getMemory(memoryId)) throw new Error("Memory not found.");
    const outcome = EVIDENCE_OUTCOMES.has(input.outcome) ? input.outcome : "observed";
    const summary = redactSecrets(normalizeText(input.summary)).value.slice(0, 1_000);
    const reference = normalizeText(input.reference).slice(0, 2_000);
    if (!summary || !reference) throw new Error("Evidence requires a summary and reference.");
    const evidence = {
      id: String(input.id || randomUUID()),
      memoryId,
      outcome,
      summary,
      reference,
      observedAt: input.observedAt || nowIso(),
      metadata: input.metadata || {},
    };
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO evidence(id, memory_id, outcome, summary, reference, observed_at, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        evidence.id,
        evidence.memoryId,
        evidence.outcome,
        evidence.summary,
        evidence.reference,
        evidence.observedAt,
        JSON.stringify(evidence.metadata),
      );
      this.insertEvent({
        eventType: "evidence.recorded",
        title: `Evidence: ${this.getMemory(memoryId).title}`,
        summary,
        memoryId,
        metadata: { outcome, reference },
      });
    });
    return evidence;
  }

  createDecision(input) {
    const title = normalizeText(input.title).slice(0, 240);
    const decision = String(input.decision || "").trim().slice(0, 100_000);
    if (!title || !decision) throw new Error("A decision requires a title and decision text.");
    const record = {
      id: String(input.id || randomUUID()),
      projectId: input.projectId || null,
      title,
      context: String(input.context || "").trim().slice(0, 50_000),
      decision,
      rationale: String(input.rationale || "").trim().slice(0, 50_000),
      alternatives: Array.isArray(input.alternatives) ? input.alternatives.slice(0, 50) : [],
      status: ["proposed", "accepted", "superseded", "rejected"].includes(input.status)
        ? input.status
        : "accepted",
      decidedAt: input.decidedAt || nowIso(),
      sourceId: input.sourceId || null,
      supersedesId: input.supersedesId || null,
    };
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO decisions(
          id, project_id, title, context, decision, rationale, alternatives_json,
          status, decided_at, source_id, supersedes_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.id,
        record.projectId,
        record.title,
        record.context,
        record.decision,
        record.rationale,
        JSON.stringify(record.alternatives),
        record.status,
        record.decidedAt,
        record.sourceId,
        record.supersedesId,
      );
      this.insertEvent({
        eventType: "decision.recorded",
        occurredAt: record.decidedAt,
        title: record.title,
        summary: record.decision.slice(0, 600),
        decisionId: record.id,
        projectId: record.projectId,
        sourceId: record.sourceId,
      });
    });
    return record;
  }

  insertEvent(input) {
    const event = {
      id: String(input.id || randomUUID()),
      eventType: normalizeText(input.eventType || "event").slice(0, 120),
      occurredAt: input.occurredAt || nowIso(),
      title: redactSecrets(normalizeText(input.title)).value.slice(0, 240),
      summary: redactSecrets(normalizeText(input.summary)).value.slice(0, 1_000),
      memoryId: input.memoryId || null,
      decisionId: input.decisionId || null,
      projectId: input.projectId || null,
      sourceId: input.sourceId || null,
      metadata: input.metadata || {},
    };
    this.db.prepare(`
      INSERT INTO events(
        id, event_type, occurred_at, title, summary, memory_id, decision_id,
        project_id, source_id, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.eventType,
      event.occurredAt,
      event.title,
      event.summary,
      event.memoryId,
      event.decisionId,
      event.projectId,
      event.sourceId,
      JSON.stringify(event.metadata),
    );
    return event;
  }

  listTimeline(options = {}) {
    const limit = Math.min(500, Math.max(1, Number(options.limit) || 100));
    const filters = [];
    const params = [];
    if (options.projectId) {
      filters.push("project_id = ?");
      params.push(options.projectId);
    }
    if (options.before) {
      filters.push("occurred_at < ?");
      params.push(options.before);
    }
    params.push(limit);
    return this.db.prepare(`
      SELECT * FROM events
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY occurred_at DESC, id DESC LIMIT ?
    `).all(...params).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      occurredAt: row.occurred_at,
      title: row.title,
      summary: row.summary,
      memoryId: row.memory_id,
      decisionId: row.decision_id,
      projectId: row.project_id,
      sourceId: row.source_id,
      metadata: safeJsonParse(row.metadata_json, {}),
    }));
  }

  upsertEntity(input) {
    const name = normalizeText(input.name).slice(0, 240);
    const entityType = normalizeText(input.entityType || "topic").slice(0, 80);
    if (!name) throw new Error("An entity name is required.");
    const normalizedName = normalizeForHash(name);
    const existing = this.db.prepare(`
      SELECT * FROM entities WHERE entity_type = ? AND normalized_name = ?
    `).get(entityType, normalizedName);
    if (existing) return existing;
    const id = String(input.id || randomUUID());
    this.db.prepare(`
      INSERT INTO entities(id, name, entity_type, normalized_name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, entityType, normalizedName, nowIso());
    return this.db.prepare("SELECT * FROM entities WHERE id = ?").get(id);
  }

  relate(input) {
    const fromType = normalizeText(input.fromType).slice(0, 40);
    const toType = normalizeText(input.toType).slice(0, 40);
    const relation = normalizeText(input.relation).slice(0, 80);
    if (!fromType || !input.fromId || !toType || !input.toId || !relation) {
      throw new Error("A relation requires typed source and target identifiers.");
    }
    const existing = this.db.prepare(`
      SELECT * FROM relations
      WHERE from_type=? AND from_id=? AND to_type=? AND to_id=? AND relation=?
    `).get(fromType, input.fromId, toType, input.toId, relation);
    if (existing) return existing;
    const id = String(input.id || randomUUID());
    this.db.prepare(`
      INSERT INTO relations(
        id, from_type, from_id, to_type, to_id, relation, weight, source_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      fromType,
      input.fromId,
      toType,
      input.toId,
      relation,
      clamp(input.weight, 0, 1, 1),
      input.sourceId || null,
      nowIso(),
    );
    return this.db.prepare("SELECT * FROM relations WHERE id = ?").get(id);
  }

  graph(options = {}) {
    const limit = Math.min(2_000, Math.max(1, Number(options.limit) || 500));
    const memories = this.listMemories({ scope: options.scope, limit });
    const memoryIds = new Set(memories.map((memory) => memory.id));
    const entities = this.db.prepare("SELECT * FROM entities ORDER BY name LIMIT ?").all(limit);
    const decisions = this.db.prepare(`
      SELECT id, project_id, title, status, decided_at FROM decisions
      ORDER BY decided_at DESC LIMIT ?
    `).all(limit);
    const projects = this.listProjects().slice(0, limit);
    const sources = this.db.prepare(`
      SELECT s.id, s.project_id, s.title, s.uri, s.media_type, s.updated_at,
        COUNT(c.id) AS chunk_count,
        COUNT(DISTINCT NULLIF(c.heading, '')) AS section_count
      FROM sources s LEFT JOIN source_chunks c ON c.source_id = s.id
      GROUP BY s.id
      ORDER BY s.updated_at DESC LIMIT ?
    `).all(limit);
    const sourceCountByProject = new Map();
    for (const source of sources) {
      if (!source.project_id) continue;
      sourceCountByProject.set(source.project_id, (sourceCountByProject.get(source.project_id) || 0) + 1);
    }
    const allowed = {
      memory: memoryIds,
      entity: new Set(entities.map((item) => item.id)),
      decision: new Set(decisions.map((item) => item.id)),
      project: new Set(projects.map((item) => item.id)),
      source: new Set(sources.map((item) => item.id)),
    };
    const edges = this.db.prepare("SELECT * FROM relations ORDER BY created_at DESC LIMIT ?").all(limit * 4)
      .filter((edge) => allowed[edge.from_type]?.has(edge.from_id) && allowed[edge.to_type]?.has(edge.to_id))
      .map((edge) => ({
        id: edge.id,
        from: edge.from_id,
        to: edge.to_id,
        relation: edge.relation,
        weight: edge.weight,
        sourceId: edge.source_id,
      }));
    for (const decision of decisions) {
      if (decision.project_id && allowed.project.has(decision.project_id)) {
        edges.push({
          id: `decision-project-${decision.id}`,
          from: decision.id,
          to: decision.project_id,
          relation: "belongs_to",
          weight: 1,
          sourceId: null,
        });
      }
    }
    for (const source of sources) {
      if (source.project_id && allowed.project.has(source.project_id)) {
        edges.push({
          id: `source-project-${source.id}`,
          from: source.id,
          to: source.project_id,
          relation: "belongs_to",
          weight: 1,
          sourceId: source.id,
        });
      }
    }
    return {
      nodes: [
        ...projects.map((item) => ({ id: item.id, type: "project", label: item.name, rootPath: item.root_path, sourceCount: sourceCountByProject.get(item.id) || 0, timestamp: item.created_at })),
        ...sources.map((item) => ({ id: item.id, type: "source", label: item.title, uri: item.uri, projectId: item.project_id, mediaType: item.media_type, chunkCount: item.chunk_count, sectionCount: item.section_count, timestamp: item.updated_at })),
        ...memories.map((item) => ({ id: item.id, type: "memory", label: item.title, kind: item.kind, scope: item.scope, sourceUri: item.sourceUri, timestamp: item.updatedAt })),
        ...entities.map((item) => ({ id: item.id, type: "entity", label: item.name, entityType: item.entity_type, timestamp: item.created_at })),
        ...decisions.map((item) => ({ id: item.id, type: "decision", label: item.title, projectId: item.project_id, status: item.status, timestamp: item.decided_at })),
      ],
      edges,
    };
  }

  consolidate(scope = null) {
    const memories = this.listMemories({ scope, limit: 500 });
    const suggestions = [];
    for (let leftIndex = 0; leftIndex < memories.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < memories.length; rightIndex += 1) {
        const left = memories[leftIndex];
        const right = memories[rightIndex];
        if (left.kind !== right.kind || left.scope !== right.scope) continue;
        const similarity = Math.max(
          tokenJaccard(left.title, right.title),
          tokenJaccard(`${left.title} ${left.summary}`, `${right.title} ${right.summary}`),
          tokenJaccard(left.content, right.content),
        );
        if (similarity >= 0.72 || left.duplicateOf === right.id || right.duplicateOf === left.id) {
          suggestions.push({ leftId: left.id, rightId: right.id, similarity });
        }
      }
    }
    return suggestions.sort((left, right) => right.similarity - left.similarity).slice(0, 200);
  }

  listMemoryReviewCandidates(options = {}) {
    const limit = Math.min(200, Math.max(1, Number(options.limit) || 50));
    const reviewed = new Set(
      this.db.prepare("SELECT pair_key FROM memory_reviews").all().map((row) => row.pair_key),
    );
    return this.consolidate(options.scope || null)
      .map((suggestion) => {
        const pair = reviewPair(suggestion.leftId, suggestion.rightId);
        if (reviewed.has(pair.pairKey)) return null;
        const left = this.getMemory(suggestion.leftId);
        const right = this.getMemory(suggestion.rightId);
        if (!left || !right || left.status !== "active" || right.status !== "active") return null;
        return {
          pairKey: pair.pairKey,
          similarity: suggestion.similarity,
          left,
          right,
          signal: left.duplicateOf === right.id || right.duplicateOf === left.id
            ? "captured-overlap"
            : "content-similarity",
        };
      })
      .filter(Boolean)
      .slice(0, limit);
  }

  memoryQuality(options = {}) {
    const active = Number(this.db.prepare(
      "SELECT count(*) AS count FROM memories WHERE status='active'",
    ).get().count);
    const linked = Number(this.db.prepare(`
      SELECT count(*) AS count FROM memories
      WHERE status='active' AND (source_id IS NOT NULL OR source_uri IS NOT NULL)
    `).get().count);
    const highConfidence = Number(this.db.prepare(`
      SELECT count(*) AS count FROM memories WHERE status='active' AND confidence >= 0.8
    `).get().count);
    const limit = Math.min(200, Math.max(1, Number(options.limit) || 50));
    const allCandidates = this.listMemoryReviewCandidates({ limit: 200 });
    return {
      active,
      pendingReview: allCandidates.length,
      linked,
      highConfidence,
      linkedPercent: active ? Math.round((linked / active) * 100) : 100,
      highConfidencePercent: active ? Math.round((highConfidence / active) * 100) : 100,
      candidates: allCandidates.slice(0, limit),
    };
  }

  resolveMemoryReview(input) {
    const outcome = String(input?.outcome || "");
    if (!new Set(["distinct", "keep-left", "keep-right"]).has(outcome)) {
      throw new Error("Choose whether to keep the left memory, keep the right memory, or keep both.");
    }
    const requestedLeft = this.getMemory(String(input?.leftId || ""));
    const requestedRight = this.getMemory(String(input?.rightId || ""));
    if (!requestedLeft || !requestedRight) throw new Error("Both review memories must exist.");
    if (requestedLeft.status !== "active" || requestedRight.status !== "active") {
      throw new Error("This review pair is no longer active. Refresh the queue.");
    }
    if (requestedLeft.scope !== requestedRight.scope || requestedLeft.kind !== requestedRight.kind) {
      throw new Error("Only memories with the same scope and type can be resolved together.");
    }
    const pair = reviewPair(requestedLeft.id, requestedRight.id);
    const pending = this.listMemoryReviewCandidates({ limit: 200 })
      .some((candidate) => candidate.pairKey === pair.pairKey);
    if (!pending) throw new Error("This pair is not in the active memory review queue.");
    const canonical = outcome === "keep-left"
      ? requestedLeft
      : outcome === "keep-right"
        ? requestedRight
        : null;
    const superseded = outcome === "keep-left"
      ? requestedRight
      : outcome === "keep-right"
        ? requestedLeft
        : null;
    const storedOutcome = canonical
      ? canonical.id === pair.leftId ? "keep-left" : "keep-right"
      : "distinct";
    const reviewedAt = nowIso();
    this.transaction(() => {
      if (superseded && canonical) {
        this.db.prepare(`
          UPDATE memories SET status='superseded', superseded_by=?, updated_at=? WHERE id=?
        `).run(canonical.id, reviewedAt, superseded.id);
      }
      this.db.prepare(`
        INSERT INTO memory_reviews(
          pair_key, left_memory_id, right_memory_id, outcome, canonical_memory_id, reviewed_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(pair_key) DO UPDATE SET
          outcome=excluded.outcome,
          canonical_memory_id=excluded.canonical_memory_id,
          reviewed_at=excluded.reviewed_at
      `).run(
        pair.pairKey,
        pair.leftId,
        pair.rightId,
        storedOutcome,
        canonical?.id || null,
        reviewedAt,
      );
      this.insertEvent({
        eventType: outcome === "distinct" ? "memory.reviewed" : "memory.superseded",
        occurredAt: reviewedAt,
        title: outcome === "distinct"
          ? "Memory overlap reviewed"
          : `Superseded: ${superseded.title}`,
        summary: outcome === "distinct"
          ? `Kept “${requestedLeft.title}” and “${requestedRight.title}” as distinct memories.`
          : `Replaced by ${canonical.title}`,
        memoryId: superseded?.id || requestedLeft.id,
        metadata: {
          reviewPair: pair.pairKey,
          outcome: storedOutcome,
          canonicalMemoryId: canonical?.id || null,
        },
      });
    });
    return {
      outcome,
      canonicalMemoryId: canonical?.id || null,
      supersededMemoryId: superseded?.id || null,
    };
  }

  supersedeMemory(memoryId, replacementId) {
    if (memoryId === replacementId) throw new Error("A memory cannot supersede itself.");
    const memory = this.getMemory(memoryId);
    const replacement = this.getMemory(replacementId);
    if (!memory || !replacement) throw new Error("Both memories must exist.");
    this.db.prepare(`
      UPDATE memories SET status='superseded', superseded_by=?, updated_at=? WHERE id=?
    `).run(replacementId, nowIso(), memoryId);
    this.insertEvent({
      eventType: "memory.superseded",
      title: `Superseded: ${memory.title}`,
      summary: `Replaced by ${replacement.title}`,
      memoryId,
      metadata: { replacementId },
    });
    return this.getMemory(memoryId);
  }

  restoreSupersededMemory(memoryId) {
    const memory = this.getMemory(memoryId);
    if (!memory) throw new Error("Memory not found.");
    if (memory.status !== "superseded") throw new Error("Only a superseded memory can be restored.");
    const timestamp = nowIso();
    this.transaction(() => {
      this.db.prepare(`
        UPDATE memories SET status='active', superseded_by=NULL, duplicate_of=NULL, updated_at=? WHERE id=?
      `).run(timestamp, memory.id);
      this.insertEvent({
        eventType: "memory.restored",
        occurredAt: timestamp,
        title: `Restored: ${memory.title}`,
        summary: "Returned a superseded memory to active recall by explicit user action.",
        memoryId: memory.id,
        metadata: { previousReplacementId: memory.supersededBy },
      });
    });
    return this.getMemory(memory.id, { includeEvidence: true });
  }

  setEvidenceOutcome(memoryId, evidenceId, outcome) {
    if (!EVIDENCE_OUTCOMES.has(outcome)) throw new Error("Choose a supported evidence outcome.");
    const memory = this.getMemory(memoryId);
    if (!memory) throw new Error("Memory not found.");
    const evidence = this.db.prepare("SELECT * FROM evidence WHERE id=? AND memory_id=?").get(String(evidenceId || ""), memory.id);
    if (!evidence) throw new Error("Evidence not found for this memory.");
    const timestamp = nowIso();
    this.transaction(() => {
      this.db.prepare("UPDATE evidence SET outcome=? WHERE id=? AND memory_id=?").run(outcome, evidence.id, memory.id);
      this.insertEvent({
        eventType: "evidence.reviewed",
        occurredAt: timestamp,
        title: `Evidence ${outcome}: ${memory.title}`,
        summary: normalizeText(evidence.summary).slice(0, 500),
        memoryId: memory.id,
        metadata: { evidenceId: evidence.id, outcome },
      });
    });
    return this.getMemory(memory.id, { includeEvidence: true });
  }

  forgetMemory(memoryId, options = {}) {
    const memory = this.getMemory(memoryId);
    if (!memory) return false;
    const timestamp = nowIso();
    this.transaction(() => {
      this.db.prepare("DELETE FROM evidence WHERE memory_id = ?").run(memoryId);
      this.db.prepare(`
        UPDATE memories SET
          title='Forgotten memory', summary='', content='', tags_json='[]',
          source_uri=NULL, source_excerpt=NULL, embedding_model=NULL,
          embedding_json=NULL, status='forgotten', updated_at=?, redacted=1
        WHERE id=?
      `).run(timestamp, memoryId);
      if (options.keepTombstone !== false) {
        this.insertEvent({
          eventType: "memory.forgotten",
          occurredAt: timestamp,
          title: "A memory was forgotten",
          summary: "Content and embeddings were deleted by explicit request.",
          metadata: { tombstone: true },
        });
      }
    });
    return true;
  }

  setSetting(key, value) {
    const normalized = normalizeText(key).slice(0, 160);
    if (!normalized) throw new Error("A setting key is required.");
    this.db.prepare(`
      INSERT INTO settings(key, value_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at
    `).run(normalized, JSON.stringify(value), nowIso());
  }

  getSetting(key, fallback = null) {
    const row = this.db.prepare("SELECT value_json FROM settings WHERE key = ?").get(key);
    return row ? safeJsonParse(row.value_json, fallback) : fallback;
  }

  installSkillRecord(input) {
    const name = normalizeText(input.name).toLocaleLowerCase("en-US");
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(name)) {
      throw new Error("Skill names must use 2-63 lowercase letters, numbers, or hyphens.");
    }
    const timestamp = nowIso();
    const existing = this.db.prepare("SELECT id, installed_at FROM skills WHERE name = ?").get(name);
    const id = existing?.id || String(input.id || randomUUID());
    this.db.prepare(`
      INSERT INTO skills(
        id, name, version, manifest_json, install_path, enabled,
        permissions_json, checksum, installed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        version=excluded.version,
        manifest_json=excluded.manifest_json,
        install_path=excluded.install_path,
        enabled=excluded.enabled,
        permissions_json=excluded.permissions_json,
        checksum=excluded.checksum,
        updated_at=excluded.updated_at
    `).run(
      id,
      name,
      normalizeText(input.version).slice(0, 80),
      JSON.stringify(input.manifest),
      String(input.installPath || ""),
      input.enabled ? 1 : 0,
      JSON.stringify(normalizeTags(input.permissions)),
      normalizeText(input.checksum),
      existing?.installed_at || timestamp,
      timestamp,
    );
    return this.getSkill(name);
  }

  getSkill(name) {
    const row = this.db.prepare("SELECT * FROM skills WHERE name = ?").get(String(name || ""));
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      manifest: safeJsonParse(row.manifest_json, {}),
      installPath: row.install_path,
      enabled: Boolean(row.enabled),
      permissions: safeJsonParse(row.permissions_json, []),
      checksum: row.checksum,
      installedAt: row.installed_at,
      updatedAt: row.updated_at,
    };
  }

  listSkills() {
    return this.db.prepare("SELECT name FROM skills ORDER BY name").all()
      .map((row) => this.getSkill(row.name));
  }

  setSkillEnabled(name, enabled) {
    const result = this.db.prepare("UPDATE skills SET enabled=?, updated_at=? WHERE name=?")
      .run(enabled ? 1 : 0, nowIso(), name);
    if (Number(result.changes) !== 1) throw new Error("Skill not found.");
    return this.getSkill(name);
  }

  removeSkill(name) {
    return Number(this.db.prepare("DELETE FROM skills WHERE name = ?").run(name).changes) === 1;
  }

  createAutomation(input) {
    const timestamp = nowIso();
    const id = String(input.id || randomUUID());
    const name = normalizeText(input.name).slice(0, 120);
    if (!name) throw new Error("An automation name is required.");
    this.db.prepare(`
      INSERT INTO automations(
        id, name, description, enabled, trigger_type, trigger_config_json,
        condition_logic, conditions_json, actions_json, permissions_json,
        version, created_at, updated_at, last_run_at, next_run_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL, ?)
    `).run(
      id,
      name,
      normalizeText(input.description).slice(0, 600),
      input.enabled ? 1 : 0,
      normalizeText(input.trigger?.type).slice(0, 80),
      JSON.stringify(input.trigger?.config || {}),
      input.conditionLogic === "or" ? "or" : "and",
      JSON.stringify(Array.isArray(input.conditions) ? input.conditions : []),
      JSON.stringify(Array.isArray(input.actions) ? input.actions : []),
      JSON.stringify(normalizeTags(input.permissions)),
      timestamp,
      timestamp,
      input.nextRunAt || null,
    );
    return this.getAutomation(id);
  }

  getAutomation(id) {
    return hydrateAutomation(
      this.db.prepare("SELECT * FROM automations WHERE id = ?").get(String(id || "")),
    );
  }

  listAutomations(options = {}) {
    const filters = [];
    const parameters = [];
    if (options.enabled !== undefined) {
      filters.push("enabled = ?");
      parameters.push(options.enabled ? 1 : 0);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const limit = Math.min(500, Math.max(1, Number(options.limit) || 200));
    return this.db.prepare(`
      SELECT * FROM automations ${where}
      ORDER BY enabled DESC, updated_at DESC LIMIT ?
    `).all(...parameters, limit).map(hydrateAutomation);
  }

  updateAutomation(id, changes) {
    const current = this.getAutomation(id);
    if (!current) throw new Error("Automation not found.");
    const next = {
      name: changes.name === undefined ? current.name : normalizeText(changes.name).slice(0, 120),
      description: changes.description === undefined
        ? current.description
        : normalizeText(changes.description).slice(0, 600),
      enabled: changes.enabled === undefined ? current.enabled : Boolean(changes.enabled),
      trigger: changes.trigger === undefined ? current.trigger : changes.trigger,
      conditionLogic: changes.conditionLogic === undefined ? current.conditionLogic : changes.conditionLogic,
      conditions: changes.conditions === undefined ? current.conditions : changes.conditions,
      actions: changes.actions === undefined ? current.actions : changes.actions,
      permissions: changes.permissions === undefined ? current.permissions : changes.permissions,
      nextRunAt: changes.nextRunAt === undefined ? current.nextRunAt : changes.nextRunAt,
    };
    if (!next.name) throw new Error("An automation name is required.");
    this.db.prepare(`
      UPDATE automations SET
        name=?, description=?, enabled=?, trigger_type=?, trigger_config_json=?,
        condition_logic=?, conditions_json=?, actions_json=?, permissions_json=?,
        version=version+1, updated_at=?, next_run_at=?
      WHERE id=?
    `).run(
      next.name,
      next.description,
      next.enabled ? 1 : 0,
      normalizeText(next.trigger?.type).slice(0, 80),
      JSON.stringify(next.trigger?.config || {}),
      next.conditionLogic === "or" ? "or" : "and",
      JSON.stringify(Array.isArray(next.conditions) ? next.conditions : []),
      JSON.stringify(Array.isArray(next.actions) ? next.actions : []),
      JSON.stringify(normalizeTags(next.permissions)),
      nowIso(),
      next.nextRunAt || null,
      current.id,
    );
    return this.getAutomation(current.id);
  }

  setAutomationEnabled(id, enabled, nextRunAt = undefined) {
    const current = this.getAutomation(id);
    if (!current) throw new Error("Automation not found.");
    this.db.prepare(`
      UPDATE automations SET enabled=?, updated_at=?, next_run_at=? WHERE id=?
    `).run(
      enabled ? 1 : 0,
      nowIso(),
      enabled ? (nextRunAt === undefined ? current.nextRunAt : nextRunAt) : null,
      current.id,
    );
    return this.getAutomation(current.id);
  }

  markAutomationRun(id, lastRunAt, nextRunAt) {
    const result = this.db.prepare(`
      UPDATE automations SET last_run_at=?, next_run_at=?, updated_at=? WHERE id=?
    `).run(lastRunAt || nowIso(), nextRunAt || null, nowIso(), id);
    if (Number(result.changes) !== 1) throw new Error("Automation not found.");
    return this.getAutomation(id);
  }

  deleteAutomation(id) {
    return Number(this.db.prepare("DELETE FROM automations WHERE id = ?").run(id).changes) === 1;
  }

  listDueAutomations(at = nowIso(), limit = 20) {
    return this.db.prepare(`
      SELECT * FROM automations
      WHERE enabled=1 AND next_run_at IS NOT NULL AND next_run_at <= ?
      ORDER BY next_run_at ASC LIMIT ?
    `).all(String(at), Math.min(100, Math.max(1, Number(limit) || 20))).map(hydrateAutomation);
  }

  createAutomationRun(input) {
    const id = String(input.id || randomUUID());
    const startedAt = input.startedAt || nowIso();
    this.db.prepare(`
      INSERT INTO automation_runs(
        id, automation_id, automation_name, status, trigger_type,
        trigger_payload_json, automation_snapshot_json, steps_json, error,
        started_at, finished_at, duration_ms, retry_of, dry_run
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?, ?)
    `).run(
      id,
      input.automationId || null,
      normalizeText(input.automationName || "Deleted automation").slice(0, 120),
      input.status || "running",
      normalizeText(input.triggerType || "manual").slice(0, 80),
      JSON.stringify(input.triggerPayload || {}),
      JSON.stringify(input.automationSnapshot || {}),
      JSON.stringify(input.steps || []),
      startedAt,
      input.retryOf || null,
      input.dryRun ? 1 : 0,
    );
    return this.getAutomationRun(id);
  }

  updateAutomationRunSteps(id, steps) {
    const current = this.getAutomationRun(id);
    if (!current) throw new Error("Automation run not found.");
    if (current.status !== "running") return current;
    this.db.prepare("UPDATE automation_runs SET steps_json=? WHERE id=? AND status='running'")
      .run(JSON.stringify(Array.isArray(steps) ? steps : []), current.id);
    return this.getAutomationRun(current.id);
  }

  recoverInterruptedAutomationRuns(recoveredAt = nowIso()) {
    const rows = this.db.prepare("SELECT id FROM automation_runs WHERE status='running' ORDER BY started_at ASC").all();
    const recovered = [];
    for (const row of rows) {
      const current = this.getAutomationRun(row.id);
      if (!current) continue;
      const steps = Array.isArray(current.steps) ? current.steps.map((step) => ({ ...step })) : [];
      for (let index = steps.length - 1; index >= 0; index -= 1) {
        if (steps[index]?.status !== "running") continue;
        steps[index] = { ...steps[index], status: "failed", detail: "BRACE closed before this action reported completion.", recoveredAt };
        break;
      }
      steps.push({
        type: "recovery",
        status: "failed",
        detail: "BRACE closed before this automation run completed. It was not retried automatically.",
        recoveredAt,
      });
      recovered.push(this.finishAutomationRun(current.id, {
        status: "failed",
        steps,
        error: "BRACE closed before this automation run completed.",
        finishedAt: recoveredAt,
      }));
    }
    return recovered;
  }

  finishAutomationRun(id, input) {
    const current = this.getAutomationRun(id);
    if (!current) throw new Error("Automation run not found.");
    const finishedAt = input.finishedAt || nowIso();
    const durationMs = Math.max(0, Number(input.durationMs) || (
      new Date(finishedAt).getTime() - new Date(current.startedAt).getTime()
    ));
    this.db.prepare(`
      UPDATE automation_runs SET status=?, steps_json=?, error=?,
        finished_at=?, duration_ms=? WHERE id=?
    `).run(
      input.status,
      JSON.stringify(Array.isArray(input.steps) ? input.steps : []),
      input.error ? normalizeText(input.error).slice(0, 2_000) : null,
      finishedAt,
      durationMs,
      current.id,
    );
    return this.getAutomationRun(current.id);
  }

  getAutomationRun(id) {
    return hydrateAutomationRun(
      this.db.prepare("SELECT * FROM automation_runs WHERE id = ?").get(String(id || "")),
    );
  }

  findAutomationRunByIdempotencyKey(key) {
    const normalized = normalizeText(key).slice(0, 128);
    if (!normalized) return null;
    const rows = this.db.prepare(`
      SELECT * FROM automation_runs
      WHERE json_extract(trigger_payload_json, '$._idempotencyKey') = ?
      ORDER BY started_at DESC LIMIT 1
    `).all(normalized);
    return hydrateAutomationRun(rows[0]);
  }

  listAutomationRuns(options = {}) {
    const filters = [];
    const parameters = [];
    if (options.automationId) {
      filters.push("automation_id = ?");
      parameters.push(String(options.automationId));
    }
    if (options.status) {
      filters.push("status = ?");
      parameters.push(String(options.status));
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const limit = Math.min(500, Math.max(1, Number(options.limit) || 100));
    return this.db.prepare(`
      SELECT * FROM automation_runs ${where}
      ORDER BY started_at DESC LIMIT ?
    `).all(...parameters, limit).map(hydrateAutomationRun);
  }

  exportData() {
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      organizations: this.listOrganizations().map((organization) => this.getOrganizationOverview(organization.id)),
      projects: this.listProjects().map((project) => ({
        id: project.id,
        name: project.name,
        created_at: project.created_at,
        updated_at: project.updated_at,
        last_indexed_at: project.last_indexed_at,
      })),
      sources: this.db.prepare("SELECT * FROM sources ORDER BY updated_at DESC").all().map((row) => ({
        ...row,
        metadata: safeJsonParse(row.metadata_json, {}),
        metadata_json: undefined,
      })),
      sourceChunks: this.db.prepare(`
        SELECT id, source_id AS sourceId, ordinal, heading, content,
          content_hash AS contentHash, embedding_model AS embeddingModel,
          created_at AS createdAt, updated_at AS updatedAt
        FROM source_chunks ORDER BY source_id, ordinal
      `).all(),
      memories: this.db.prepare("SELECT * FROM memories ORDER BY updated_at DESC").all().map((row) => ({
        ...hydrateMemory(row),
        evidence: this.getMemory(row.id, { includeEvidence: true }).evidence,
      })),
      decisions: this.db.prepare("SELECT * FROM decisions ORDER BY decided_at DESC").all().map((row) => ({
        ...row,
        alternatives: safeJsonParse(row.alternatives_json, []),
        alternatives_json: undefined,
      })),
      timeline: this.listTimeline({ limit: 500 }),
      entities: this.db.prepare("SELECT * FROM entities ORDER BY name").all(),
      relations: this.db.prepare("SELECT * FROM relations ORDER BY created_at").all(),
      memoryReviews: this.db.prepare(`
        SELECT pair_key AS pairKey, left_memory_id AS leftMemoryId,
          right_memory_id AS rightMemoryId, outcome,
          canonical_memory_id AS canonicalMemoryId, reviewed_at AS reviewedAt
        FROM memory_reviews ORDER BY reviewed_at DESC
      `).all(),
      skills: this.db.prepare(`
        SELECT id, name, version, manifest_json, enabled, permissions_json,
          checksum, installed_at, updated_at FROM skills ORDER BY name
      `).all().map((row) => ({
        ...row,
        manifest: safeJsonParse(row.manifest_json, {}),
        permissions: safeJsonParse(row.permissions_json, []),
        manifest_json: undefined,
        permissions_json: undefined,
      })),
      automations: this.listAutomations({ limit: 500 }),
      automationRuns: this.listAutomationRuns({ limit: 500 }),
    };
  }

  async backup(destination) {
    if (this.databasePath === ":memory:") {
      throw new Error("In-memory BRACE stores cannot be backed up to a file.");
    }
    const target = path.resolve(destination);
    ensureParent(target);
    await backupSqlite(this.db, target);
    return { path: target, bytes: fs.statSync(target).size, createdAt: nowIso() };
  }

  deleteAll() {
    this.transaction(() => {
      for (const table of [
        "automation_runs",
        "automations",
        "relations",
        "entities",
        "events",
        "decisions",
        "evidence",
        "memory_reviews",
        "memories",
        "source_chunks",
        "sources",
        "projects",
        "organization_audit_events",
        "workspace_members",
        "workspaces",
        "organizations",
        "skills",
        "settings",
      ]) {
        this.db.exec(`DELETE FROM ${table}`);
      }
    });
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  }

  stats() {
    const count = (table, where = "") => Number(
      this.db.prepare(`SELECT count(*) AS count FROM ${table} ${where}`).get().count,
    );
    return {
      schemaVersion: Number(this.db.prepare("PRAGMA user_version").get().user_version),
      organizations: count("organizations"),
      workspaces: count("workspaces"),
      workspaceMembers: count("workspace_members", "WHERE status='active'"),
      projects: count("projects"),
      sources: count("sources"),
      sourceChunks: count("source_chunks"),
      memories: count("memories", "WHERE status='active'"),
      pinnedMemories: count("memories", "WHERE status='active' AND pinned=1"),
      forgotten: count("memories", "WHERE status='forgotten'"),
      decisions: count("decisions"),
      events: count("events"),
      entities: count("entities"),
      relations: count("relations"),
      skills: count("skills"),
      automations: count("automations"),
      enabledAutomations: count("automations", "WHERE enabled=1"),
      automationRuns: count("automation_runs"),
    };
  }
}

module.exports = {
  EVIDENCE_OUTCOMES,
  MEMORY_KINDS,
  MEMORY_STATUSES,
  MemoryStore,
  SCHEMA_VERSION,
  cosine,
  redactSecrets,
  sha256,
  tokenJaccard,
};
