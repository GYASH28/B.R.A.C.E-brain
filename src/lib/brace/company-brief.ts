import type { BraceMemory, BraceOrganizationOverview, BraceProject } from "./types";

export type CompanyBriefFilter = "recent" | "decisions" | "warnings";
export type CompanyBriefLens = "employee" | "manager" | "executive" | "administrator";

export const companyBriefLenses: Record<CompanyBriefLens, {
  label: string;
  headline: string;
  question: string;
  action: { label: string; filter?: CompanyBriefFilter; view?: "projects" };
}> = {
  employee: {
    label: "Employee",
    headline: "What context can move your work forward?",
    question: "Which shared decision, lesson, or warning is useful for your next step?",
    action: { label: "Review recent knowledge", filter: "recent" },
  },
  manager: {
    label: "Manager",
    headline: "Where does the team need clarity?",
    question: "Which recorded decisions or warnings should the team align on next?",
    action: { label: "Review decisions", filter: "decisions" },
  },
  executive: {
    label: "Executive",
    headline: "What needs your attention?",
    question: "Which recorded decisions, warnings, or source conditions need an informed review?",
    action: { label: "Review warnings", filter: "warnings" },
  },
  administrator: {
    label: "Administrator",
    headline: "Which local sources need care?",
    question: "Which recorded indexing conditions should be inspected in the local project view?",
    action: { label: "Inspect source health", view: "projects" },
  },
};

// This is a presentation projection of the local snapshot, not authorization.
// Remote services must enforce membership before producing that snapshot.
export function buildCompanyBrief(
  overview: BraceOrganizationOverview,
  memories: BraceMemory[],
  projects: BraceProject[],
  options: { workspaceId?: string; query?: string; filter?: CompanyBriefFilter; limit?: number } = {},
) {
  const workspaces = overview.workspaces.filter((workspace) =>
    workspace.organizationId === overview.organization.id
    && workspace.status === "active"
    && workspace.visibility !== "personal"
    && workspace.kind !== "personal"
    && (!options.workspaceId || workspace.id === options.workspaceId));
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const query = (options.query || "").trim().toLocaleLowerCase();
  const eligible = memories.filter((memory) => memory.workspaceId
    && workspaceIds.has(memory.workspaceId)
    && memory.scope !== "personal" && memory.scope !== "private"
    && memory.status === "active" && !memory.redacted);
  const matched = eligible.filter((memory) =>
    (options.filter !== "decisions" || memory.kind === "decision")
    && (options.filter !== "warnings" || memory.kind === "warning")
    && (!query || `${memory.title} ${memory.summary} ${memory.tags.join(" ")}`.toLocaleLowerCase().includes(query)));
  const timestamp = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  matched.sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt) || a.id.localeCompare(b.id));
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit || 12)));
  const companyProjects = projects.filter((project) => project.workspace_id && workspaceIds.has(project.workspace_id));
  return {
    workspaces,
    records: matched.slice(0, limit),
    totalMatches: matched.length,
    totals: {
      memories: eligible.length,
      decisions: eligible.filter((memory) => memory.kind === "decision").length,
      warnings: eligible.filter((memory) => memory.kind === "warning").length,
      projects: companyProjects.length,
    },
    projectIssues: companyProjects.filter((project) => project.watch?.error || !project.last_indexed_at),
  };
}
