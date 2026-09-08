"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { buildCompanyBrief, companyBriefLenses, type CompanyBriefFilter, type CompanyBriefLens } from "@/lib/brace/company-brief";
import type { BraceOrganizationOverview, BraceSnapshot } from "@/lib/brace/types";
import { useBrace } from "@/lib/brace/store";

export function CompanyBrief({ overview, snapshot }: { overview: BraceOrganizationOverview; snapshot: BraceSnapshot }) {
  const [query, setQuery] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [filter, setFilter] = useState<CompanyBriefFilter>("recent");
  const [lens, setLens] = useState<CompanyBriefLens>("executive");
  const brief = useMemo(() => buildCompanyBrief(overview, snapshot.memories, snapshot.projects, { query, workspaceId, filter }), [overview, snapshot.memories, snapshot.projects, query, workspaceId, filter]);
  const sharedWorkspaces = overview.workspaces.filter((workspace) => workspace.organizationId === overview.organization.id && workspace.status === "active" && workspace.visibility !== "personal" && workspace.kind !== "personal");
  const activeLens = companyBriefLenses[lens];

  return <section className="company-brief" aria-labelledby="company-brief-title">
    <header><div><span>YOUR COMPANY BRIEF · {activeLens.label.toUpperCase()} LENS</span><h2 id="company-brief-title">{activeLens.headline}</h2><p>{activeLens.question}</p></div><label><span className="sr-only">Brief workspace</span><select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}><option value="">All shared workspaces</option>{sharedWorkspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label></header>
    <div className="company-brief-lenses" role="group" aria-label="Company brief presentation lens">{(Object.keys(companyBriefLenses) as CompanyBriefLens[]).map((item) => <button type="button" key={item} aria-pressed={lens === item} onClick={() => setLens(item)}>{companyBriefLenses[item].label}</button>)}</div>
    <div className="company-brief-lens-action"><span>{activeLens.question}</span><button type="button" onClick={() => activeLens.action.filter ? setFilter(activeLens.action.filter) : useBrace.getState().setView("projects")}>{activeLens.action.label}<ArrowUpRight aria-hidden="true" /></button></div>
    <p className="company-brief-lens-note">This is a local presentation lens only. It never grants permissions, changes workspace access, or connects to a remote service.</p>
    <div className="company-brief-controls">
      <div role="group" aria-label="Brief category">{([{ id: "recent", label: "Recent knowledge", count: brief.totals.memories }, { id: "decisions", label: "Decisions", count: brief.totals.decisions }, { id: "warnings", label: "Warnings", count: brief.totals.warnings }] as const).map((item) => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{item.count}</span></button>)}</div>
      <label className="company-brief-search"><Search aria-hidden="true" /><span className="sr-only">Search company brief</span><input type="search" placeholder="Find a decision or topic" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    </div>
    <p className="company-brief-count" role="status">Showing {brief.records.length} of {brief.totalMatches} matching records</p>
    <div className="company-brief-records">{brief.records.map((memory) => <button type="button" key={memory.id} onClick={() => useBrace.getState().setSelectedMemory(memory)}>
      <span className="company-record-kind">{memory.kind}</span><div><strong>{memory.title}</strong><p>{memory.summary}</p><small>{brief.workspaces.find((workspace) => workspace.id === memory.workspaceId)?.name} · {memory.sourceId || memory.sourceUri ? "Source attached" : "No source attached"}</small></div><ArrowUpRight aria-hidden="true" />
    </button>)}{!brief.records.length && <div className="company-brief-empty"><strong>{query ? "No records match this search." : "No shared records in this view yet."}</strong><p>{query ? "Try another topic or workspace." : "Add knowledge to a shared workspace to see its decisions and warnings here."}</p></div>}</div>
    {brief.projectIssues.length > 0 && <aside className="company-brief-attention"><h3>Project sources need attention</h3><p>These are indexing conditions, not estimates of project progress.</p>{brief.projectIssues.map((project) => <button type="button" key={project.id} onClick={() => useBrace.getState().setView("projects")}><strong>{project.name}</strong><span>{project.watch?.error ? "Indexing reported an error" : "Not indexed yet"}</span><ArrowUpRight aria-hidden="true" /></button>)}</aside>}
  </section>;
}
