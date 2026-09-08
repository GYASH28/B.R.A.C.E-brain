"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, FolderKanban, Landmark, ShieldCheck, UsersRound } from "lucide-react";
import { buildCompanyOperations } from "@/lib/brace/company-operations";
import type { BraceOrganizationOverview, BraceSnapshot } from "@/lib/brace/types";
import { useBrace } from "@/lib/brace/store";

const tabs = [
  { id: "projects", label: "Project hub", icon: FolderKanban },
  { id: "people", label: "People & teams", icon: UsersRound },
  { id: "decisions", label: "Decision room", icon: Landmark },
  { id: "governance", label: "Governance", icon: ShieldCheck },
] as const;
type OperationsTab = typeof tabs[number]["id"];
const displayDate = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "Not recorded";

export function CompanyOperations({ overview, snapshot }: { overview: BraceOrganizationOverview; snapshot: BraceSnapshot }) {
  const [tab, setTab] = useState<OperationsTab>("projects");
  const id = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const model = useMemo(() => buildCompanyOperations(overview, snapshot), [overview, snapshot]);
  const selected = tabs.find((item) => item.id === tab)!;
  const changeTab = (next: OperationsTab, focus = false) => {
    setTab(next);
    if (focus) tabRefs.current[tabs.findIndex((item) => item.id === next)]?.focus();
  };
  return <section className="company-operations" aria-labelledby={`${id}-title`}>
    <header><div><span>LOCAL COMPANY OPERATIONS</span><h2 id={`${id}-title`}>Inspectable governed local-workspace view</h2><p>Snapshot-derived information only. This preview does not authenticate people, grant access, publish records, or report remote activity.</p></div></header>
    <div className="company-operations-tabs" role="tablist" aria-label="Company operations">
      {tabs.map((item, index) => { const Icon = item.icon; return <button key={item.id} ref={(element) => { tabRefs.current[index] = element; }} type="button" role="tab" id={`${id}-${item.id}`} aria-selected={tab === item.id} aria-controls={`${id}-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => changeTab(item.id)} onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "Home" || event.key === "End") { event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length; changeTab(tabs[next].id, true); }
      }}><Icon aria-hidden="true" />{item.label}</button>; })}
    </div>
    <div className="company-operations-panel" role="tabpanel" id={`${id}-panel-${tab}`} aria-labelledby={`${id}-${tab}`}>
      {selected.id === "projects" && <div className="company-operations-list">{model.projects.map((project) => <article key={project.id}><div><strong>{project.name}</strong><small>{project.workspaceName} · Last indexed: {displayDate(project.lastIndexedAt)} · {project.freshness}</small></div><span>{project.memoryCount} project-scoped memory records · {project.sourceCount} indexed sources</span><button type="button" onClick={() => useBrace.getState().setView("projects")}>Projects <ArrowUpRight aria-hidden="true" /></button></article>)}{!model.projects.length && <p className="company-operations-empty">No projects are recorded in eligible governed local workspaces.</p>}</div>}
      {selected.id === "people" && <div className="company-operations-list"><p className="company-operations-note">Workspace access follows the recorded workspace boundary. Local role labels and subject bindings are not proof of a currently authenticated identity.</p>{model.people.map((person) => <article key={person.key}><div><strong>{person.displayName}</strong><small>{person.roles.join(", ")} · {person.workspaceNames.join(", ")}</small></div><span>{person.hasSubjectBinding ? "Subject binding recorded" : "Local role label only"}</span></article>)}{!model.people.length && <p className="company-operations-empty">No local member records in eligible governed local workspaces.</p>}</div>}
      {selected.id === "decisions" && <div className="company-operations-list">{model.decisions.map((decision) => <article key={decision.id}><div><strong>{decision.title}</strong><small>{decision.workspaceName} · {decision.status} · Updated {displayDate(decision.updatedAt)} · Confidence {Math.round(decision.confidence * 100)}%</small></div><span>{decision.sourceUri ? "Source linked" : "No source link"}</span><button type="button" onClick={() => useBrace.getState().openGraphNode(decision.id)}>Brain <ArrowUpRight aria-hidden="true" /></button></article>)}{!model.decisions.length && <p className="company-operations-empty">No eligible company-labeled decision memories are recorded.</p>}</div>}
      {selected.id === "governance" && <div className="company-operations-list"><p className="company-operations-note">{model.governance.authorizationLocked ? "Authorization changes are locked pending verified enrollment." : "Member-management availability is a local UI hint; the desktop service re-authorizes mutations."}</p>{model.governance.visibility.map((item) => <article key={item.workspaceName}><div><strong>{item.workspaceName}</strong><small>Recorded visibility: {item.visibility}</small></div></article>)}<article><div><strong>{model.governance.memberRecords} member records</strong><small>Local membership records only; private content is not shown.</small></div></article>{model.governance.auditEvents.map((event) => <article key={event.id}><div><strong>{event.summary}</strong><small>Local audit event · {displayDate(event.occurredAt)}</small></div></article>)}</div>}
    </div>
  </section>;
}
