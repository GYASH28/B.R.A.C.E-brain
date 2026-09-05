export type MemoryKind =
  | "project"
  | "decision"
  | "lesson"
  | "warning"
  | "preference"
  | "summary"
  | "hypothesis"
  | "fact"
  | "procedure";

export interface BraceMemory {
  id: string;
  workspaceId: string | null;
  kind: MemoryKind;
  scope: string;
  title: string;
  summary: string;
  content: string;
  status: "active" | "superseded" | "forgotten";
  confidence: number;
  importance: number;
  pinned: boolean;
  tags: string[];
  sourceId: string | null;
  sourceUri: string | null;
  sourceExcerpt: string | null;
  embeddingModel: string | null;
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
  duplicateOf: string | null;
  redacted: boolean;
  retrieval?: {
    score: number;
    lexicalRank: number | null;
    semanticRank: number | null;
    semanticSimilarity: number | null;
  };
  evidence?: Array<{
    id: string;
    outcome: "promoted" | "rejected" | "deferred" | "observed";
    summary: string;
    reference: string;
    observedAt: string;
  }>;
}

export interface BraceProject {
  id: string;
  workspace_id?: string | null;
  name: string;
  root_path: string;
  created_at: string;
  updated_at: string;
  last_indexed_at: string | null;
  watch?: {
    enabled: boolean;
    resourcePaused: boolean;
    pending: boolean;
    running: boolean;
    error: { message: string; occurredAt: string } | null;
  };
}

export interface BraceOrganization {
  id: string;
  name: string;
  slug: string;
  edition: "personal" | "team" | "enterprise";
  dataResidency: "local" | string;
  ownershipBoundary: string;
  createdAt: string;
  updatedAt: string;
}

export interface BraceWorkspaceMember {
  id: string;
  workspaceId: string;
  displayName: string;
  email: string | null;
  role: "owner" | "admin" | "manager" | "member" | "guest" | "auditor";
  status: "active" | "invited" | "suspended";
  createdAt: string;
  updatedAt: string;
}

export interface BraceBusinessWorkspace {
  id: string;
  organizationId: string;
  name: string;
  kind: "personal" | "team" | "executive" | "project";
  visibility: "personal" | "team" | "organization";
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  projectCount: number;
  memoryCount: number;
  members: BraceWorkspaceMember[];
}

export interface BraceOrganizationOverview {
  organization: BraceOrganization;
  workspaces: BraceBusinessWorkspace[];
  audit: Array<{
    id: string;
    organizationId: string;
    workspaceId: string | null;
    eventType: string;
    actorLabel: string;
    summary: string;
    metadata: Record<string, unknown>;
    occurredAt: string;
  }>;
  totals: { workspaces: number; members: number; projects: number; memories: number };
}

export interface BraceIndexResult {
  projectId: string;
  status: "complete" | "partial";
  filesSeen: number;
  indexed: number;
  unchanged: number;
  removed: number;
  skippedBinary: number;
  skippedLarge: number;
  skippedUnsupported: number;
  skippedUnsupportedEncoding: number;
  errors: number;
  embedded: number;
  redacted: number;
  ignoredByRule: number;
  truncated: boolean;
  completedAt: string;
}

export interface BraceDatabaseDiagnostics {
  integrity: "ok" | "attention";
  details: string[];
  schemaVersion: number;
  stats: BraceSnapshot["stats"];
  checkedAt: string;
  appVersion: string;
  platform: string;
  databasePath: string;
  projectIndex: Array<{ id: string; lastIndexedAt: string | null }>;
  embedding: { enabled: boolean; provider: string | null; model: string | null };
  connectors: Array<{ id: ConnectorId; detected: boolean; configured: boolean; version: string | null }>;
  scheduler: { paused: boolean; error: { message: string; occurredAt: string } | null };
}

export interface BraceTask {
  id: string;
  type: "project.index" | string;
  title: string;
  status: "running" | "complete" | "partial" | "failed" | "cancelled";
  phase: "scanning" | "reading" | "redacting" | "chunking" | "embedding" | "finalizing" | "complete" | "partial" | "failed" | "cancelled" | string;
  completed: number;
  total: number;
  startedAt: string;
  updatedAt: string;
  cancellable: boolean;
  error?: string | null;
  result?: { indexed: number; unchanged: number; errors: number; redacted: number; embedded: number };
}

export interface MemoryReviewCandidate {
  pairKey: string;
  similarity: number;
  signal: "captured-overlap" | "content-similarity";
  left: BraceMemory;
  right: BraceMemory;
}

export interface MemoryQuality {
  active: number;
  pendingReview: number;
  linked: number;
  highConfidence: number;
  linkedPercent: number;
  highConfidencePercent: number;
  candidates: MemoryReviewCandidate[];
}

export interface TimelineEvent {
  id: string;
  eventType: string;
  occurredAt: string;
  title: string;
  summary: string;
  memoryId: string | null;
  decisionId: string | null;
  projectId: string | null;
  sourceId: string | null;
  metadata: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  type: "project" | "source" | "memory" | "entity" | "decision";
  label: string;
  kind?: string;
  status?: string;
  projectId?: string | null;
  rootPath?: string;
  uri?: string;
  sourceUri?: string | null;
  mediaType?: string;
  entityType?: string;
  scope?: string;
  sourceCount?: number;
  chunkCount?: number;
  sectionCount?: number;
  timestamp?: string | null;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relation: string;
  weight: number;
  sourceId: string | null;
}

export interface BraceSkillAction {
  id: string;
  label: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface BraceSkill {
  name: string;
  version: string;
  displayName: string;
  description: string;
  enabled: boolean;
  permissions: string[];
  actions: BraceSkillAction[];
}

export type AutomationTriggerType =
  | "manual"
  | "schedule.interval"
  | "schedule.daily"
  | "memory.created"
  | "decision.created"
  | "project.indexed"
  | "session.handoff";

export type AutomationActionType =
  | "memory.create"
  | "decision.create"
  | "memory.search"
  | "memory.quality_scan"
  | "timeline.digest"
  | "project.reindex"
  | "skill.run";

export interface BraceAutomationCondition {
  field: "title" | "kind" | "scope" | "tags" | "client" | "projectId" | "eventType";
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "includes";
  value: unknown;
}

export interface BraceAutomationAction {
  type: AutomationActionType;
  config: Record<string, unknown>;
}

export interface BraceAutomation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: { type: AutomationTriggerType; config: Record<string, unknown> };
  conditionLogic: "and" | "or";
  conditions: BraceAutomationCondition[];
  actions: BraceAutomationAction[];
  permissions: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface BraceAutomationRun {
  id: string;
  automationId: string | null;
  automationName: string;
  status: "running" | "success" | "failed" | "skipped" | "preview";
  triggerType: string;
  triggerPayload: Record<string, unknown>;
  automationSnapshot: Partial<BraceAutomation>;
  steps: Array<Record<string, unknown>>;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  retryOf: string | null;
  dryRun: boolean;
}

export interface BraceAutomationTemplate {
  id: string;
  name: string;
  description: string;
  trigger: BraceAutomation["trigger"];
  conditionLogic: "and" | "or";
  conditions: BraceAutomationCondition[];
  actions: BraceAutomationAction[];
}

export interface BraceAutomationSnapshot {
  paused: boolean;
  definitions: BraceAutomation[];
  runs: BraceAutomationRun[];
  templates: BraceAutomationTemplate[];
  schedulerError: { message: string; occurredAt: string } | null;
}

export interface BraceSnapshot {
  stats: {
    schemaVersion: number;
    organizations: number;
    workspaces: number;
    workspaceMembers: number;
    projects: number;
    sources: number;
    sourceChunks: number;
    memories: number;
    pinnedMemories: number;
    forgotten: number;
    decisions: number;
    events: number;
    entities: number;
    relations: number;
    skills: number;
    automations: number;
    enabledAutomations: number;
    automationRuns: number;
  };
  organizations: BraceOrganizationOverview[];
  projects: BraceProject[];
  memories: BraceMemory[];
  supersededMemories?: BraceMemory[];
  memoryQuality: MemoryQuality;
  timeline: TimelineEvent[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  skills: BraceSkill[];
  semantic: {
    enabled: boolean;
    config: { enabled: boolean; endpoint: string; model: string };
  };
  assistant?: {
    history: AssistantTurn[];
  };
  automations?: BraceAutomationSnapshot;
  tasks?: BraceTask[];
  storage?: { directory: string; database: string };
  connections?: {
    command: string;
    args: string[];
    env?: Record<string, string>;
    instruction?: string;
  };
  environment?: "desktop" | "browser-preview";
}

export interface AssistantTurn {
  id: string;
  client: "codex" | "claude";
  prompt: string;
  response: string;
  createdAt: string;
  context: {
    mode: "lexical" | "semantic" | "hybrid";
    embeddingModel: string | null;
    memoryCount: number;
    sourceCount: number;
  };
}

export interface AssistantContextPreview {
  id: string;
  client: "codex" | "claude";
  prompt: string;
  promptRedacted: boolean;
  mode: "lexical" | "semantic" | "hybrid";
  embeddingModel: string | null;
  warning: string | null;
  preparedAt: string;
  expiresAt: string;
  memories: Array<{ title: string; kind: string; summary: string; sourceUri: string | null }>;
  sources: Array<{ title: string; uri: string; excerpt: string }>;
}

export type ConnectorId = "codex" | "claude" | "antigravity" | "generic";
export type ConnectorAccess = "read-only" | "remember";

export interface BraceConnector {
  id: ConnectorId;
  name: string;
  description: string;
  detected: boolean;
  executablePath: string | null;
  version: string | null;
  configured: boolean;
  verified: boolean;
  health: "manual" | "not-installed" | "detected" | "configured" | "verified" | "needs-repair" | "missing-executable";
  access: ConnectorAccess | null;
  lastVerifiedAt: string | null;
  backupAvailable: boolean;
  configPath: string | null;
  supportsInstall: boolean;
  instruction: string;
  readOnlyConfig: Record<string, unknown>;
  rememberConfig: Record<string, unknown>;
}

export interface SearchResponse {
  mode: "lexical" | "semantic" | "hybrid";
  embeddingModel: string | null;
  warning: string | null;
  diagnostics: {
    query: string;
    mode: "lexical" | "semantic" | "hybrid";
    scope: string;
    projectId: string | null;
    since: string | null;
    embeddingModel: string | null;
  };
  memories: BraceMemory[];
  sources: Array<{
    id: string;
    sourceId: string;
    projectId: string | null;
    projectName: string | null;
    title: string;
    uri: string;
    heading: string;
    content: string;
    retrieval: {
      score: number;
      lexicalRank: number | null;
      semanticRank: number | null;
      semanticSimilarity: number | null;
    };
  }>;
}

export interface BraceElectronApi {
  getBraceSnapshot: () => Promise<BraceSnapshot>;
  initializeBraceDemo: () => Promise<BraceSnapshot>;
  createBraceOrganization: (input: Record<string, unknown>) => Promise<BraceOrganizationOverview>;
  createBraceWorkspace: (input: Record<string, unknown>) => Promise<BraceBusinessWorkspace>;
  upsertBraceWorkspaceMember: (input: Record<string, unknown>) => Promise<BraceWorkspaceMember>;
  cancelBraceTask: (id: string) => Promise<boolean>;
  onBraceTaskProgress: (listener: (task: BraceTask) => void) => () => void;
  searchBrace: (input: Record<string, unknown>) => Promise<SearchResponse>;
  getBraceMemory: (id: string) => Promise<BraceMemory | null>;
  createBraceMemory: (input: Record<string, unknown>) => Promise<unknown>;
  updateBraceMemory: (id: string, changes: Record<string, unknown>) => Promise<unknown>;
  setBraceMemoryPinned: (id: string, pinned: boolean) => Promise<BraceMemory>;
  resolveBraceMemoryReview: (input: {
    leftId: string;
    rightId: string;
    outcome: "distinct" | "keep-left" | "keep-right";
  }) => Promise<unknown>;
  restoreBraceMemory: (id: string) => Promise<BraceMemory>;
  forgetBraceMemory: (id: string) => Promise<boolean>;
  addBraceEvidence: (id: string, input: Record<string, unknown>) => Promise<unknown>;
  setBraceEvidenceOutcome: (memoryId: string, evidenceId: string, outcome: "promoted" | "rejected" | "deferred" | "observed") => Promise<BraceMemory>;
  createBraceDecision: (input: Record<string, unknown>) => Promise<unknown>;
  addBraceProject: () => Promise<BraceIndexResult | null>;
  reindexBraceProject: (projectId: string) => Promise<BraceIndexResult>;
  setBraceProjectWatch: (projectId: string, enabled: boolean) => Promise<BraceProject["watch"]>;
  installBraceSkill: () => Promise<unknown>;
  setBraceSkillEnabled: (name: string, enabled: boolean) => Promise<unknown>;
  removeBraceSkill: (name: string) => Promise<unknown>;
  runBraceSkill: (name: string, action: string, input: unknown) => Promise<unknown>;
  setBraceEmbeddingConfig: (input: Record<string, unknown>) => Promise<unknown>;
  exportBraceData: () => Promise<unknown>;
  importBraceContent: () => Promise<{ documents: number; memories: number; duplicates: number; evidence: number; redactions: number; projects: number; safetyBackupCreated: true } | null>;
  backupBraceData: () => Promise<unknown>;
  getBraceDiagnostics: () => Promise<BraceDatabaseDiagnostics>;
  saveBraceSupportBundle: () => Promise<{ path: string; included: string[]; uploaded: false } | null>;
  restoreBraceBackup: () => Promise<{ restarting: boolean; safetyPath: string } | null>;
  deleteAllBraceData: (confirmation: string) => Promise<boolean>;
  listBraceConnectors: () => Promise<BraceConnector[]>;
  installBraceConnector: (
    id: ConnectorId,
    access: ConnectorAccess,
  ) => Promise<{ connected: boolean; cancelled: boolean }>;
  restoreBraceConnector: (id: Exclude<ConnectorId, "generic">) => Promise<{ restored: boolean; cancelled: boolean }>;
  prepareBraceAssistantContext: (input: {
    client: "codex" | "claude";
    prompt: string;
  }) => Promise<AssistantContextPreview>;
  runBraceAssistant: (input: {
    client: "codex" | "claude";
    prompt: string;
    contextId: string;
  }) => Promise<{ cancelled: boolean; turn?: AssistantTurn }>;
  clearBraceAssistantHistory: () => Promise<boolean>;
  copyBraceText: (value: string) => Promise<boolean>;
  getBraceAutomations: () => Promise<BraceAutomationSnapshot>;
  createBraceAutomation: (input: Record<string, unknown>) => Promise<BraceAutomation>;
  updateBraceAutomation: (id: string, input: Record<string, unknown>) => Promise<BraceAutomation>;
  setBraceAutomationEnabled: (id: string, enabled: boolean) => Promise<BraceAutomation>;
  runBraceAutomation: (
    id: string,
    input: { dryRun?: boolean; payload?: Record<string, unknown> },
  ) => Promise<BraceAutomationRun>;
  retryBraceAutomationRun: (runId: string, dryRun: boolean) => Promise<BraceAutomationRun>;
  exportBraceAutomations: (id?: string) => Promise<{ count: number; path: string } | null>;
  importBraceAutomations: () => Promise<{ count: number; ids: string[] } | null>;
  deleteBraceAutomation: (id: string) => Promise<boolean>;
  setBraceAutomationsPaused: (paused: boolean) => Promise<BraceAutomationSnapshot>;
}

declare global {
  interface Window {
    electron?: BraceElectronApi & Record<string, unknown>;
  }
}
