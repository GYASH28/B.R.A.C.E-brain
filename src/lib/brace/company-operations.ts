import type { BraceMemory, BraceOrganizationOverview, BraceSnapshot } from "./types";

type OperationWorkspace = BraceOrganizationOverview["workspaces"][number];

export type CompanyOperationsProjection = {
  workspaces: OperationWorkspace[];
  projects: Array<{
    id: string;
    name: string;
    workspaceName: string;
    lastIndexedAt: string | null;
    freshness: "not indexed" | "indexed";
    memoryCount: number;
    sourceCount: number;
  }>;
  people: Array<{
    key: string;
    displayName: string;
    roles: string[];
    workspaceNames: string[];
    hasSubjectBinding: boolean;
  }>;
  decisions: Array<{
    id: string;
    title: string;
    status: BraceMemory["status"];
    updatedAt: string;
    confidence: number;
    sourceUri: string | null;
    workspaceName: string;
  }>;
  governance: {
    visibility: Array<{ workspaceName: string; visibility: OperationWorkspace["visibility"] }>;
    memberRecords: number;
    auditEvents: Array<{ id: string; summary: string; occurredAt: string }>;
    authorizationLocked: boolean;
  };
};

/**
 * Local presentation projection only. It is not authorization and deliberately
 * excludes personal, foreign, redacted, forgotten, and unscoped records.
 */
export function buildCompanyOperations(overview: BraceOrganizationOverview, snapshot: Pick<BraceSnapshot, "projects" | "memories" | "timeline" | "graph" | "businessAuthorization">): CompanyOperationsProjection {
  const workspaces = overview.workspaces.filter((workspace) =>
    workspace.organizationId === overview.organization.id
    && workspace.status === "active"
    && workspace.visibility !== "personal"
    && workspace.kind !== "personal");
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const workspaceName = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));
  const memories = snapshot.memories.filter((memory) => memory.workspaceId
    && workspaceIds.has(memory.workspaceId)
    && memory.scope !== "personal" && memory.scope !== "private"
    && memory.status === "active" && !memory.redacted);
  const sourcesByProject = new Map<string, number>();
  for (const node of snapshot.graph.nodes) if (node.type === "source" && node.projectId) sourcesByProject.set(node.projectId, (sourcesByProject.get(node.projectId) || 0) + 1);
  const projects = snapshot.projects.filter((project) => project.workspace_id && workspaceIds.has(project.workspace_id)).map((project) => ({
    id: project.id,
    name: project.name,
    workspaceName: workspaceName.get(project.workspace_id!) || "Unknown workspace",
    lastIndexedAt: project.last_indexed_at,
    freshness: project.last_indexed_at ? "indexed" as const : "not indexed" as const,
    memoryCount: memories.filter((memory) => memory.scope === `project:${project.id}`).length,
    sourceCount: sourcesByProject.get(project.id) || 0,
  }));
  const peopleByKey = new Map<string, CompanyOperationsProjection["people"][number]>();
  for (const workspace of workspaces) for (const member of workspace.members) {
    const key = member.subjectId ? `subject:${member.subjectId}` : `local:${member.displayName.trim().toLocaleLowerCase()}|${member.email || ""}`;
    const existing = peopleByKey.get(key) || { key, displayName: member.displayName || "Unnamed local record", roles: [], workspaceNames: [], hasSubjectBinding: Boolean(member.subjectId) };
    if (!existing.roles.includes(member.role)) existing.roles.push(member.role);
    if (!existing.workspaceNames.includes(workspace.name)) existing.workspaceNames.push(workspace.name);
    peopleByKey.set(key, existing);
  }
  const decisions = memories.filter((memory) => memory.kind === "decision").sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).map((memory) => ({
    id: memory.id, title: memory.title, status: memory.status, updatedAt: memory.updatedAt, confidence: memory.confidence, sourceUri: memory.sourceUri,
    workspaceName: workspaceName.get(memory.workspaceId!) || "Unknown workspace",
  }));
  const memberRecords = workspaces.reduce((total, workspace) => total + workspace.members.length, 0);
  return {
    workspaces,
    projects,
    people: [...peopleByKey.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    decisions,
    governance: {
      visibility: workspaces.map((workspace) => ({ workspaceName: workspace.name, visibility: workspace.visibility })),
      memberRecords,
      auditEvents: overview.audit.filter((event) => !event.workspaceId || workspaceIds.has(event.workspaceId)).slice(0, 6).map((event) => ({ id: event.id, summary: event.summary, occurredAt: event.occurredAt })),
      authorizationLocked: !workspaces.every((workspace) => Boolean(snapshot.businessAuthorization?.memberManagementByWorkspace[workspace.id])),
    },
  };
}
