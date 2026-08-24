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
  kind: MemoryKind;
  scope: string;
  title: string;
  summary: string;
  content: string;
  status: "active" | "superseded" | "forgotten";
  confidence: number;
  importance: number;
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
  name: string;
  root_path: string;
  created_at: string;
  updated_at: string;
  last_indexed_at: string | null;
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

export interface BraceSnapshot {
  stats: {
    schemaVersion: number;
    projects: number;
    sources: number;
    sourceChunks: number;
    memories: number;
    forgotten: number;
    decisions: number;
    events: number;
    entities: number;
    relations: number;
    skills: number;
  };
  projects: BraceProject[];
  memories: BraceMemory[];
  timeline: TimelineEvent[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  skills: BraceSkill[];
  semantic: {
    enabled: boolean;
    config: { enabled: boolean; endpoint: string; model: string };
  };
  storage?: { directory: string; database: string };
  connections?: { command: string; args: string[] };
  environment?: "desktop" | "browser-preview";
}

export interface SearchResponse {
  mode: "lexical" | "semantic" | "hybrid";
  embeddingModel: string | null;
  warning: string | null;
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
  searchBrace: (input: Record<string, unknown>) => Promise<SearchResponse>;
  getBraceMemory: (id: string) => Promise<BraceMemory | null>;
  createBraceMemory: (input: Record<string, unknown>) => Promise<unknown>;
  updateBraceMemory: (id: string, changes: Record<string, unknown>) => Promise<unknown>;
  forgetBraceMemory: (id: string) => Promise<boolean>;
  addBraceEvidence: (id: string, input: Record<string, unknown>) => Promise<unknown>;
  createBraceDecision: (input: Record<string, unknown>) => Promise<unknown>;
  addBraceProject: () => Promise<unknown>;
  reindexBraceProject: (projectId: string) => Promise<unknown>;
  installBraceSkill: () => Promise<unknown>;
  setBraceSkillEnabled: (name: string, enabled: boolean) => Promise<unknown>;
  removeBraceSkill: (name: string) => Promise<unknown>;
  runBraceSkill: (name: string, action: string, input: unknown) => Promise<unknown>;
  setBraceEmbeddingConfig: (input: Record<string, unknown>) => Promise<unknown>;
  exportBraceData: () => Promise<unknown>;
  backupBraceData: () => Promise<unknown>;
  deleteAllBraceData: (confirmation: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electron?: BraceElectronApi & Record<string, unknown>;
  }
}
