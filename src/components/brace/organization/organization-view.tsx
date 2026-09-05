"use client";

import { useState } from "react";
import { Activity, ArrowRight, Box, Brain, Check, ChevronRight, Database, FolderInput, Info, KeyRound, Plus, ServerCog, ShieldCheck } from "lucide-react";
import { useBrace } from "@/lib/brace/store";
import { Page } from "@/components/brace/primitives/page";

function formatDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function OrganizationView() {
  const { snapshot, createOrganization, createWorkspace, upsertWorkspaceMember } = useBrace();
  const [organizationId, setOrganizationId] = useState(snapshot?.organizations[0]?.organization.id || "");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(snapshot?.organizations[0]?.workspaces[0]?.id || "");
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  if (!snapshot) return null;
  const overview = snapshot.organizations.find((item) => item.organization.id === organizationId)
    || snapshot.organizations[0];
  const selectedWorkspace = overview?.workspaces.find((workspace) => workspace.id === selectedWorkspaceId)
    || overview?.workspaces[0];
  const desktopOnly = snapshot.environment !== "desktop";

  if (!overview) return (
    <Page eyebrow="Business memory control plane" title="Create a company brain" description="Define who owns company knowledge before adding team workspaces. Personal memory remains outside this governance boundary.">
      <form className="company-onboarding" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void createOrganization({ name: data.get("name"), edition: data.get("edition"), ownershipBoundary: data.get("boundary") });
      }}>
        <div className="company-onboarding-mark"><Brain className="h-8 w-8" /><i /><i /></div>
        <div><span>LOCAL ORGANIZATION LAYER</span><h2>Turn knowledge into governed infrastructure.</h2><p>This creates local workspace boundaries, role records, and an audit trail. It does not create accounts, send invitations, or upload data.</p></div>
        <label><span>Company name</span><input name="name" required maxLength={120} placeholder="Acme Research" /></label>
        <label><span>Edition</span><select name="edition" defaultValue="team"><option value="team">Team</option><option value="enterprise">Enterprise foundation</option><option value="personal">Personal</option></select></label>
        <label className="is-wide"><span>Ownership boundary</span><textarea name="boundary" maxLength={500} defaultValue="Company workspaces are governed; personal memory remains private." /></label>
        <button type="submit" className="brace-primary h-11 px-5"><ServerCog className="h-4 w-4" />Create local company brain</button>
      </form>
    </Page>
  );

  return (
    <Page eyebrow="Business memory control plane" title={overview.organization.name} description="A local command center for company knowledge, workspace ownership, roles, and inspectable governance."
      actions={<div className="company-page-actions">{snapshot.organizations.length > 1 && <select aria-label="Organization" value={overview.organization.id} onChange={(event) => { setOrganizationId(event.target.value); setSelectedWorkspaceId(""); }}>
        {snapshot.organizations.map((item) => <option key={item.organization.id} value={item.organization.id}>{item.organization.name}</option>)}
      </select>}<button type="button" className="brace-primary h-10 px-4" onClick={() => setShowWorkspaceForm((value) => !value)} disabled={desktopOnly}><Plus className="h-4 w-4" />Workspace</button></div>}>
      <section className="company-command-hero">
        <div className="company-brain-orbit" aria-hidden="true"><Brain /><i /><i /><i /></div>
        <div className="company-command-copy"><span>{overview.organization.edition.toUpperCase()} · {overview.organization.dataResidency.toUpperCase()} RESIDENCY</span><h2>The company remembers.<br />People keep their boundaries.</h2><p>{overview.organization.ownershipBoundary}</p></div>
        <div className="company-health"><span><i />GOVERNANCE ACTIVE</span><strong>{overview.totals.memories.toLocaleString()}</strong><small>company memories</small><button type="button" onClick={() => useBrace.getState().setView("graph")}>Enter company graph <ArrowRight className="h-3.5 w-3.5" /></button></div>
      </section>

      <div className="company-metrics" aria-label="Organization totals">
        {[{ label: "Workspaces", value: overview.totals.workspaces, icon: Box }, { label: "Active roles", value: overview.totals.members, icon: KeyRound }, { label: "Projects", value: overview.totals.projects, icon: FolderInput }, { label: "Knowledge", value: overview.totals.memories, icon: Database }].map((metric) => { const MetricIcon = metric.icon; return <article key={metric.label}><MetricIcon /><span>{metric.label}</span><strong>{metric.value.toLocaleString()}</strong></article>; })}
      </div>

      {showWorkspaceForm && <form className="company-inline-form" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void createWorkspace({ organizationId: overview.organization.id, name: data.get("name"), kind: data.get("kind"), visibility: data.get("visibility") }).then(() => setShowWorkspaceForm(false));
      }}><label><span>Workspace name</span><input name="name" required maxLength={120} autoFocus placeholder="Customer intelligence" /></label><label><span>Purpose</span><select name="kind" defaultValue="team"><option value="team">Team knowledge</option><option value="executive">Executive room</option><option value="project">Project portfolio</option><option value="personal">Personal</option></select></label><label><span>Visibility boundary</span><select name="visibility" defaultValue="team"><option value="team">Assigned team</option><option value="organization">Organization</option><option value="personal">Personal only</option></select></label><button className="brace-primary h-10 px-4" type="submit">Create</button><button className="brace-secondary h-10 px-4" type="button" onClick={() => setShowWorkspaceForm(false)}>Cancel</button></form>}

      <div className="company-grid">
        <section className="company-workspaces" aria-label="Company workspaces">
          <header><div><span>KNOWLEDGE DOMAINS</span><h2>Workspaces</h2></div><small>{overview.workspaces.length} governed boundaries</small></header>
          <div>{overview.workspaces.map((workspace, index) => <button type="button" key={workspace.id} className={selectedWorkspace?.id === workspace.id ? "is-active" : ""} onClick={() => setSelectedWorkspaceId(workspace.id)}><i>{String(index + 1).padStart(2, "0")}</i><span><strong>{workspace.name}</strong><small>{workspace.kind} · {workspace.visibility}</small></span><em>{workspace.memoryCount}<small>nodes</small></em><ChevronRight /></button>)}</div>
        </section>

        <section className="company-workspace-detail">
          {selectedWorkspace && <><header><div><span>{selectedWorkspace.kind.toUpperCase()} WORKSPACE</span><h2>{selectedWorkspace.name}</h2><p>{selectedWorkspace.visibility === "personal" ? "Visible only within its personal boundary." : selectedWorkspace.visibility === "organization" ? "Visible to organization-authorized roles." : "Visible to roles assigned to this workspace."}</p></div><button type="button" className="brace-secondary h-9 px-3" disabled={desktopOnly} onClick={() => setShowMemberForm((value) => !value)}><Plus className="h-3.5 w-3.5" />Role</button></header>
            <div className="workspace-vitals"><span><strong>{selectedWorkspace.memberCount}</strong> active roles</span><span><strong>{selectedWorkspace.projectCount}</strong> projects</span><span><strong>{selectedWorkspace.memoryCount}</strong> memories</span></div>
            {showMemberForm && <form className="member-inline-form" onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void upsertWorkspaceMember({ workspaceId: selectedWorkspace.id, displayName: data.get("displayName"), email: data.get("email"), role: data.get("role"), status: "active" }).then(() => setShowMemberForm(false));
            }}><input name="displayName" maxLength={120} required placeholder="Display name" aria-label="Member display name" /><input name="email" type="email" maxLength={254} placeholder="Email (local label)" aria-label="Member email" /><select name="role" defaultValue="member" aria-label="Workspace role"><option value="owner">Owner</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="member">Member</option><option value="guest">Guest</option><option value="auditor">Auditor</option></select><button className="brace-primary" type="submit">Save role</button></form>}
            <div className="workspace-member-list">{selectedWorkspace.members.map((member) => <article key={member.id}><span>{member.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>{member.displayName}</strong><small>{member.email || "No email label"}</small></div><em>{member.role}</em><i className={member.status === "active" ? "is-active" : ""}>{member.status}</i></article>)}{!selectedWorkspace.members.length && <div className="company-empty-row"><KeyRound /><p>No role records yet. Add the people who govern this knowledge boundary.</p></div>}</div>
          </>}
        </section>
      </div>

      <div className="company-lower-grid">
        <section className="company-audit"><header><div><span>LOCAL AUDIT TRAIL</span><h2>Governance events</h2></div><Activity /></header><div>{overview.audit.slice(0, 8).map((event) => <article key={event.id}><i /><div><strong>{event.summary}</strong><small>{event.actorLabel} · {formatDate(event.occurredAt)}</small></div><span>{event.eventType.replaceAll(".", " ")}</span></article>)}</div></section>
        <section className="company-boundary"><ShieldCheck /><span>PRIVACY CONTRACT</span><h2>Management without surveillance.</h2><p>BRACE records explicit workspace changes and knowledge ownership. It does not score employees, infer productivity, capture private activity, or upload this control plane.</p><ul><li><Check />Personal memory stays outside company workspaces</li><li><Check />Every role change is inspectable</li><li><Check />Local SQLite remains authoritative</li></ul></section>
      </div>
      {desktopOnly && <div className="company-preview-note"><Info />This synthetic preview demonstrates the management UX. Role and workspace changes require the desktop app.</div>}
    </Page>
  );
}

