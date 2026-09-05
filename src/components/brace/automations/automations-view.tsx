"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  ArrowRight, Brain, CalendarClock, ChevronRight, CloudOff, Download, FileSearch,
  FolderInput, FolderSync, Info, Pause, Play, Plus, RotateCcw, Save, ShieldCheck,
  SlidersHorizontal, TimerReset, Trash2, WandSparkles, Workflow, X, Zap,
  type LucideIcon,
} from "lucide-react";
import { useBrace } from "@/lib/brace/store";
import type {
  BraceAutomation, BraceAutomationAction, BraceAutomationCondition, BraceAutomationRun,
  BraceAutomationTemplate, BraceProject, BraceSkill,
} from "@/lib/brace/types";
import { Page } from "@/components/brace/primitives/page";

function formatDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const automationTriggerLabels: Record<string, string> = {
  manual: "Manual launch",
  "schedule.interval": "Repeating interval",
  "schedule.daily": "Daily schedule",
  "memory.created": "Memory created",
  "decision.created": "Decision recorded",
  "project.indexed": "Project indexed",
  "session.handoff": "AI session handoff",
};

const automationActionLabels: Record<string, string> = {
  "memory.create": "Create durable memory",
  "decision.create": "Record a decision",
  "memory.search": "Search local memory",
  "memory.quality_scan": "Scan memory quality",
  "timeline.digest": "Build timeline brief",
  "project.reindex": "Refresh project index",
  "skill.run": "Run a BRACE skill",
};

const automationPermissionLabels: Record<string, string> = {
  "memory:read": "Read memory",
  "memory:write": "Write memory",
  "source:read": "Read source index",
  "source:write": "Refresh source index",
  "decision:write": "Write decisions",
  "timeline:read": "Read timeline",
  "project:read": "Read project metadata",
  "skill:run": "Run enabled skills",
};

function automationSchedule(automation: BraceAutomation) {
  if (automation.trigger.type === "schedule.interval") {
    const minutes = Number(automation.trigger.config.intervalMinutes || 0);
    if (minutes % 10080 === 0) return `Every ${minutes / 10080}w`;
    if (minutes % 1440 === 0) return `Every ${minutes / 1440}d`;
    if (minutes % 60 === 0) return `Every ${minutes / 60}h`;
    return `Every ${minutes}m`;
  }
  if (automation.trigger.type === "schedule.daily") {
    return `At ${String(automation.trigger.config.time || "09:00")} local time`;
  }
  return automationTriggerLabels[automation.trigger.type] || automation.trigger.type;
}

export function AutomationsView() {
  const {
    snapshot,
    saveAutomation,
    toggleAutomation,
    runAutomation,
    retryAutomation,
    exportAutomations,
    importAutomations,
    deleteAutomation,
    pauseAutomations,
  } = useBrace();
  const automations = snapshot?.automations;
  const definitions = automations?.definitions || [];
  const runs = automations?.runs || [];
  const [selectedId, setSelectedId] = useState(definitions[0]?.id || "");
  const [builder, setBuilder] = useState<{
    source?: BraceAutomation | BraceAutomationTemplate;
    existingId?: string;
  } | null>(null);
  const [runFilter, setRunFilter] = useState("all");
  const [expandedRun, setExpandedRun] = useState<string | null>(runs[0]?.id || null);
  const selected = definitions.find((automation) => automation.id === selectedId) || definitions[0] || null;
  const visibleRuns = runs.filter((run) => runFilter === "all" || run.status === runFilter).slice(0, 30);
  const successful = runs.filter((run) => run.status === "success").length;
  const failed = runs.filter((run) => run.status === "failed").length;

  useEffect(() => {
    if (selectedId && definitions.some((automation) => automation.id === selectedId)) return;
    setSelectedId(definitions[0]?.id || "");
  }, [definitions, selectedId]);

  if (!snapshot || !automations) return null;
  return (
    <Page
      eyebrow="Let BRACE handle the routine"
      title="Automations"
      description="Start with a safe template or build a local workflow. You can preview every action before enabling it and inspect every run afterward."
      actions={
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void importAutomations()} className="brace-secondary h-10 px-4"><FolderInput className="h-4 w-4" />Import recipes</button>
          <button type="button" onClick={() => void exportAutomations()} disabled={!definitions.length} className="brace-secondary h-10 px-4"><Download className="h-4 w-4" />Export all</button>
          <button type="button" onClick={() => void pauseAutomations(!automations.paused)} className={`brace-secondary h-10 px-4 ${automations.paused ? "automation-resume" : ""}`}>
            {automations.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {automations.paused ? "Resume all" : "Pause all"}
          </button>
          <button type="button" onClick={() => setBuilder({})} className="brace-primary h-10 px-4"><Plus className="h-4 w-4" />Create automation</button>
        </div>
      }
    >
      <section className={`automation-pulse ${automations.paused ? "is-paused" : ""}`} aria-label="Automation runtime status">
        <div className="automation-pulse-orbit" aria-hidden="true"><i /><i /><i /></div>
        <div><span><i />{automations.paused ? "AUTOMATIONS PAUSED" : "RUNNING ON THIS DEVICE"}</span><h2>{definitions.filter((item) => item.enabled).length} active workflow{definitions.filter((item) => item.enabled).length === 1 ? "" : "s"}.</h2><p>Enabled workflows run while BRACE is open. You can pause everything at any time, and previews never change memory.</p></div>
        <dl><div><dt>Recipes</dt><dd>{definitions.length}</dd></div><div><dt>Successful</dt><dd>{successful}</dd></div><div><dt>Attention</dt><dd className={failed ? "text-rose-200" : ""}>{failed}</dd></div></dl>
      </section>

      {automations.schedulerError && (
        <div className="automation-warning" role="alert"><Info className="h-4 w-4" /><div><strong>Scheduler needs attention</strong><span>{automations.schedulerError.message}</span></div><small>{formatDate(automations.schedulerError.occurredAt)}</small></div>
      )}

      <section className="mt-5">
        <div className="mb-3 flex items-end justify-between gap-4"><div><span className="brace-label">Start with a template</span><p className="mt-1 text-[11px] text-white/30">Choose one, review what it will do, then decide whether to enable it.</p></div><span className="text-[9px] text-white/22">No code · no cloud</span></div>
        <div className="automation-template-strip">
          {automations.templates.map((template) => (
            <button key={template.id} type="button" onClick={() => setBuilder({ source: template })} className="automation-template">
              <span><WandSparkles className="h-4 w-4" /></span><strong>{template.name}</strong><small>{template.description}</small><em>Use blueprint <ArrowRight className="h-3 w-3" /></em>
            </button>
          ))}
        </div>
      </section>

      <div className="automation-studio mt-5">
        <section className="automation-library" aria-label="Saved automations">
          <div className="automation-panel-head"><div><span>SAVED RECIPES</span><strong>{definitions.length}</strong></div><button type="button" onClick={() => setBuilder({})} aria-label="Create automation"><Plus className="h-4 w-4" /></button></div>
          <div className="automation-library-scroll">
            {!definitions.length && <div className="automation-empty"><Workflow className="h-6 w-6" /><strong>No recipes yet</strong><p>Choose a blueprint or build a private local workflow from scratch.</p><button type="button" onClick={() => setBuilder({})}>Build the first recipe</button></div>}
            {definitions.map((automation) => {
              const active = selected?.id === automation.id;
              const lastRun = runs.find((run) => run.automationId === automation.id);
              return (
                <button key={automation.id} type="button" onClick={() => setSelectedId(automation.id)} className={`automation-library-row ${active ? "is-active" : ""}`} aria-pressed={active}>
                  <span className={`automation-recipe-light ${automation.enabled && !automations.paused ? "is-live" : ""}`} />
                  <span><strong>{automation.name}</strong><small>{automationSchedule(automation)}</small></span>
                  <em className={lastRun ? `is-${lastRun.status}` : ""}>{lastRun?.status || "never run"}</em>
                </button>
              );
            })}
          </div>
        </section>

        <section className="automation-inspector" aria-label="Automation recipe">
          {!selected && <div className="automation-inspector-empty"><Workflow className="h-8 w-8" /><h2>Choose a recipe to inspect</h2><p>Every trigger, condition, action, permission, and run remains visible.</p></div>}
          {selected && (
            <>
              <header className="automation-inspector-head">
                <div><span>RECIPE · V{selected.version}</span><h2>{selected.name}</h2><p>{selected.description || "No description yet."}</p></div>
                <button type="button" role="switch" aria-checked={selected.enabled} onClick={() => void toggleAutomation(selected.id, !selected.enabled)} className={`automation-master-switch ${selected.enabled ? "is-on" : ""}`}><i /><span>{selected.enabled ? "Enabled" : "Paused"}</span></button>
              </header>
              <div className="automation-recipe-spine">
                <AutomationRecipeNode number="WHEN" icon={CalendarClock} title={automationTriggerLabels[selected.trigger.type]} detail={automationSchedule(selected)} tone="trigger" />
                <div className="automation-spine-link"><i /><span>{selected.conditions.length ? `${selected.conditionLogic.toUpperCase()} · ${selected.conditions.length} condition${selected.conditions.length === 1 ? "" : "s"}` : "Always continue"}</span></div>
                {selected.conditions.length > 0 && <AutomationRecipeNode number="IF" icon={SlidersHorizontal} title={selected.conditions.map((condition) => `${condition.field} ${condition.operator.replaceAll("_", " ")} ${String(condition.value)}`).join(` ${selected.conditionLogic.toUpperCase()} `)} detail="Evaluated against the event payload at run time" tone="condition" />}
                {selected.actions.map((action, index) => (
                  <div key={`${action.type}-${index}`}>
                    <div className="automation-spine-link"><i /><span>{index ? "THEN CONTINUE" : "THEN DO"}</span></div>
                    <AutomationRecipeNode number={String(index + 1).padStart(2, "0")} icon={action.type === "skill.run" ? Zap : action.type === "project.reindex" ? FolderSync : Brain} title={automationActionLabels[action.type]} detail={AutomationActionSummary({ action, projects: snapshot.projects, skills: snapshot.skills })} tone="action" />
                  </div>
                ))}
              </div>
              <div className="automation-permissions"><ShieldCheck className="h-4 w-4" /><div><span>CAPABILITY ENVELOPE</span><p>{selected.permissions.map((permission) => automationPermissionLabels[permission] || permission).join(" · ")}</p></div></div>
              <footer className="automation-inspector-actions">
                <button type="button" onClick={() => void runAutomation(selected.id, true)} className="brace-secondary h-10 px-3"><FileSearch className="h-4 w-4" />Preview</button>
                <button type="button" onClick={() => void runAutomation(selected.id)} className="brace-primary h-10 px-4"><Play className="h-4 w-4" />Run now</button>
                <button type="button" onClick={() => setBuilder({ source: selected, existingId: selected.id })} className="brace-secondary ml-auto h-10 px-3"><SlidersHorizontal className="h-4 w-4" />Edit</button>
                <button type="button" onClick={() => void exportAutomations(selected.id)} className="brace-secondary h-10 px-3"><Download className="h-4 w-4" />Export</button>
                <button type="button" onClick={() => void deleteAutomation(selected.id)} className="automation-delete" aria-label={`Delete ${selected.name}`}><Trash2 className="h-4 w-4" /></button>
              </footer>
            </>
          )}
        </section>
      </div>

      <section className="automation-runs mt-5">
        <div className="automation-runs-head"><div><span className="brace-label">Execution traces</span><p>Immutable recipe snapshots, step outputs, skips, failures, and retries.</p></div><div role="group" aria-label="Filter automation runs">{["all", "success", "failed", "skipped", "preview"].map((status) => <button key={status} type="button" className={runFilter === status ? "is-active" : ""} aria-pressed={runFilter === status} onClick={() => setRunFilter(status)}>{status}</button>)}</div></div>
        {!visibleRuns.length && <div className="automation-run-empty"><TimerReset className="h-5 w-5" />No {runFilter === "all" ? "automation" : runFilter} runs yet.</div>}
        <div className="automation-run-list">
          {visibleRuns.map((run) => <AutomationRunRow key={run.id} run={run} expanded={expandedRun === run.id} onExpand={() => setExpandedRun(expandedRun === run.id ? null : run.id)} onRetry={(dry) => void retryAutomation(run.id, dry)} />)}
        </div>
      </section>
      {builder && <AutomationBuilder source={builder.source} existingId={builder.existingId} projects={snapshot.projects} skills={snapshot.skills} onClose={() => setBuilder(null)} onSave={async (value) => { const saved = await saveAutomation(value, builder.existingId); if (saved) { setSelectedId(saved.id); setBuilder(null); } }} />}
    </Page>
  );
}

function AutomationRecipeNode({ number, icon: Icon, title, detail, tone }: { number: string; icon: LucideIcon; title: string; detail: string; tone: "trigger" | "condition" | "action" }) {
  return <div className={`automation-recipe-node is-${tone}`}><span className="automation-node-number">{number}</span><span className="automation-node-icon"><Icon className="h-4 w-4" /></span><div><strong>{title}</strong><small>{detail}</small></div><ChevronRight className="ml-auto h-4 w-4" /></div>;
}

function AutomationActionSummary({ action, projects, skills }: { action: BraceAutomationAction; projects: BraceProject[]; skills: BraceSkill[] }) {
  const config = action.config;
  if (action.type === "memory.create") return String(config.title || "Create a templated memory");
  if (action.type === "decision.create") return String(config.title || "Record a templated decision");
  if (action.type === "memory.search") return `Query: ${String(config.query || "trigger title")}`;
  if (action.type === "memory.quality_scan") return config.scope ? `Scope: ${String(config.scope)}` : "Inspect the full active memory set";
  if (action.type === "timeline.digest") return `${String(config.windowHours || 24)}h window · ${String(config.title || "Activity brief")}`;
  if (action.type === "project.reindex") return projects.find((project) => project.id === config.projectId)?.name || "Selected project";
  if (action.type === "skill.run") return `${skills.find((skill) => skill.name === config.name)?.displayName || String(config.name || "Skill")} · ${String(config.action || "action")}`;
  return "Typed local action";
}

function AutomationRunRow({ run, expanded, onExpand, onRetry }: { run: BraceAutomationRun; expanded: boolean; onExpand: () => void; onRetry: (dryRun: boolean) => void }) {
  return (
    <article className={`automation-run is-${run.status} ${expanded ? "is-expanded" : ""}`}>
      <button type="button" className="automation-run-summary" onClick={onExpand} aria-expanded={expanded}>
        <i /><span><strong>{run.automationName}</strong><small>{automationTriggerLabels[run.triggerType] || run.triggerType} · {formatDate(run.startedAt)}</small></span><em>{run.status}</em><code>{run.durationMs === null ? "—" : `${run.durationMs}ms`}</code><ChevronRight className="h-4 w-4" />
      </button>
      {expanded && <div className="automation-run-trace"><div className="automation-run-snapshot"><span>RECIPE SNAPSHOT</span><strong>v{String(run.automationSnapshot.version || "?")}</strong><small>{run.retryOf ? `Retry of ${run.retryOf.slice(0, 8)}` : run.dryRun ? "No mutations executed" : "Original definition preserved"}</small></div>{run.steps.map((step, index) => <div key={index} className={`automation-run-step is-${String(step.status || "success")}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{automationActionLabels[String(step.type)] || String(step.type || "Step")}</strong><small>{String(step.detail || (step.output ? JSON.stringify(step.output) : step.input ? `Preview: ${JSON.stringify(step.input)}` : "Completed"))}</small></div><em>{String(step.status || "success")}</em></div>)}{run.error && <div className="automation-run-error"><Info className="h-4 w-4" />{run.error}</div>}<footer><button type="button" onClick={() => onRetry(true)}><FileSearch className="h-3.5 w-3.5" />Preview retry</button><button type="button" onClick={() => onRetry(false)}><RotateCcw className="h-3.5 w-3.5" />Retry now</button></footer></div>}
    </article>
  );
}

function defaultAutomationAction(type: BraceAutomationAction["type"]): BraceAutomationAction {
  const configs: Record<string, Record<string, unknown>> = {
    "memory.create": { kind: "summary", scope: "global", title: "New automated memory", summary: "Created by an enabled local recipe.", content: "Describe what BRACE should retain.", tags: ["automation"], confidence: 0.8, importance: 0.65 },
    "decision.create": { projectId: "", title: "Automated decision", context: "", decision: "", rationale: "" },
    "memory.search": { query: "{{trigger.title}}", scope: "", limit: 8 },
    "memory.quality_scan": { scope: "" },
    "timeline.digest": { title: "BRACE activity brief", scope: "global", windowHours: 24 },
    "project.reindex": { projectId: "" },
    "skill.run": { name: "", action: "", input: {} },
  };
  return { type, config: configs[type] };
}

function AutomationBuilder({ source, existingId, projects, skills, onClose, onSave }: { source?: BraceAutomation | BraceAutomationTemplate; existingId?: string; projects: BraceProject[]; skills: BraceSkill[]; onClose: () => void; onSave: (input: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState(source?.name || "");
  const [description, setDescription] = useState(source?.description || "");
  const [triggerType, setTriggerType] = useState<BraceAutomation["trigger"]["type"]>(source?.trigger.type || "manual");
  const [intervalMinutes, setIntervalMinutes] = useState(Number(source?.trigger.config.intervalMinutes || 60));
  const [dailyTime, setDailyTime] = useState(String(source?.trigger.config.time || "09:00"));
  const [days, setDays] = useState<number[]>(Array.isArray(source?.trigger.config.daysOfWeek) ? source.trigger.config.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6]);
  const [timeoutSeconds, setTimeoutSeconds] = useState(Number(source?.trigger.config.timeoutSeconds || 120));
  const [debounceSeconds, setDebounceSeconds] = useState(Number(source?.trigger.config.debounceSeconds ?? 30));
  const [retryAttempts, setRetryAttempts] = useState(Number(source?.trigger.config.retryAttempts ?? 2));
  const [missedRunPolicy, setMissedRunPolicy] = useState(String(source?.trigger.config.missedRunPolicy || "run-once"));
  const [conditionLogic, setConditionLogic] = useState<"and" | "or">(source?.conditionLogic || "and");
  const [conditions, setConditions] = useState<BraceAutomationCondition[]>(source?.conditions ? structuredClone(source.conditions) : []);
  const [actions, setActions] = useState<BraceAutomationAction[]>(source?.actions ? structuredClone(source.actions) : [defaultAutomationAction("memory.quality_scan")]);
  const [saving, setSaving] = useState(false);
  const permissions = [...new Set(actions.flatMap((action) => ({
    "memory.create": ["memory:write"], "decision.create": ["decision:write"], "memory.search": ["memory:read", "source:read"], "memory.quality_scan": ["memory:read"], "timeline.digest": ["timeline:read", "memory:write"], "project.reindex": ["project:read", "source:write"], "skill.run": ["skill:run"],
  }[action.type] || [])))].sort();
  const setCondition = (index: number, change: Partial<BraceAutomationCondition>) => setConditions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  const setAction = (index: number, action: BraceAutomationAction) => setActions((items) => items.map((item, itemIndex) => itemIndex === index ? action : item));
  const moveAction = (index: number, direction: -1 | 1) => setActions((items) => { const next = [...items]; const target = index + direction; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const triggerConfig = {
        ...(triggerType === "schedule.interval" ? { intervalMinutes } : triggerType === "schedule.daily" ? { time: dailyTime, daysOfWeek: days } : {}),
        timeoutSeconds,
        debounceSeconds,
        retryAttempts,
        retryBaseSeconds: 15,
        missedRunPolicy,
      };
      await onSave({ name, description, enabled: existingId && "enabled" in (source || {}) ? Boolean((source as BraceAutomation).enabled) : false, trigger: { type: triggerType, config: triggerConfig }, conditionLogic, conditions, actions });
    } finally { setSaving(false); }
  };
  return (
    <div className="brace-dialog-backdrop brace-dialog-backdrop--side" role="dialog" aria-modal="true" aria-labelledby="automation-builder-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="automation-builder" onSubmit={(event) => void submit(event)}>
        <header><div><span>{existingId ? "EDIT LOCAL RECIPE" : source ? "CONFIGURE BLUEPRINT" : "NEW LOCAL RECIPE"}</span><h1 id="automation-builder-title">Make BRACE work while you work.</h1><p>Build an inspectable trigger → conditions → actions chain. It starts paused.</p></div><button type="button" onClick={onClose} aria-label="Close automation builder"><X className="h-4 w-4" /></button></header>
        <div className="automation-builder-scroll">
          <section className="automation-builder-identity"><label><span>Name</span><input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Daily project pulse" /></label><label><span>Purpose</span><textarea maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should this recipe make easier?" /></label></section>
          <AutomationBuilderBlock number="01" label="WHEN" title="Choose one reliable trigger" icon={CalendarClock}>
            <select value={triggerType} onChange={(event) => setTriggerType(event.target.value as BraceAutomation["trigger"]["type"])}>{Object.entries(automationTriggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            {triggerType === "schedule.interval" && <label className="automation-inline-field"><span>Repeat every</span><input type="number" min="5" max="525600" value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))} /><em>minutes</em></label>}
            {triggerType === "schedule.daily" && <div className="automation-daily"><label><span>Local time</span><input type="time" value={dailyTime} onChange={(event) => setDailyTime(event.target.value)} /></label><fieldset><legend>Days</legend><div>{["S", "M", "T", "W", "T", "F", "S"].map((label, day) => <button key={day} type="button" className={days.includes(day) ? "is-active" : ""} aria-pressed={days.includes(day)} onClick={() => setDays((value) => value.includes(day) ? value.filter((item) => item !== day) : [...value, day].sort())}>{label}</button>)}</div></fieldset></div>}
            <div className="automation-runtime-policy" aria-label="Automation reliability policy">
              <label><span>Timeout</span><input type="number" min="5" max="600" value={timeoutSeconds} onChange={(event) => setTimeoutSeconds(Number(event.target.value))} /><em>seconds</em></label>
              <label><span>Debounce</span><input type="number" min="0" max="86400" value={debounceSeconds} onChange={(event) => setDebounceSeconds(Number(event.target.value))} /><em>seconds</em></label>
              <label><span>Retries</span><input type="number" min="0" max="5" value={retryAttempts} onChange={(event) => setRetryAttempts(Number(event.target.value))} /></label>
              {triggerType.startsWith("schedule.") && <label><span>Missed run</span><select value={missedRunPolicy} onChange={(event) => setMissedRunPolicy(event.target.value)}><option value="run-once">Run once on resume</option><option value="skip">Skip and continue</option></select></label>}
            </div>
            <p className="automation-builder-note"><CloudOff className="h-3.5 w-3.5" />Schedules use your computer’s local clock and run only while BRACE is open.</p>
          </AutomationBuilderBlock>
          <AutomationBuilderBlock number="02" label="IF" title="Narrow the event only when useful" icon={SlidersHorizontal} optional>
            <div className="automation-logic" role="group" aria-label="Condition logic"><button type="button" className={conditionLogic === "and" ? "is-active" : ""} onClick={() => setConditionLogic("and")}>Match all</button><button type="button" className={conditionLogic === "or" ? "is-active" : ""} onClick={() => setConditionLogic("or")}>Match any</button></div>
            <div className="automation-condition-list">{conditions.map((condition, index) => <div key={index} className="automation-condition"><select aria-label={`Condition ${index + 1} field`} value={condition.field} onChange={(event) => setCondition(index, { field: event.target.value as BraceAutomationCondition["field"] })}>{["title", "kind", "scope", "tags", "client", "projectId", "eventType"].map((field) => <option key={field} value={field}>{field}</option>)}</select><select aria-label={`Condition ${index + 1} operator`} value={condition.operator} onChange={(event) => setCondition(index, { operator: event.target.value as BraceAutomationCondition["operator"] })}>{["equals", "not_equals", "contains", "not_contains", "includes"].map((operator) => <option key={operator} value={operator}>{operator.replaceAll("_", " ")}</option>)}</select><input aria-label={`Condition ${index + 1} value`} value={String(condition.value)} onChange={(event) => setCondition(index, { value: event.target.value })} placeholder="comparison value" /><button type="button" onClick={() => setConditions((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove condition ${index + 1}`}><X className="h-3.5 w-3.5" /></button></div>)}</div>
            <button type="button" disabled={conditions.length >= 12} onClick={() => setConditions((items) => [...items, { field: "title", operator: "contains", value: "" }])} className="automation-add-step"><Plus className="h-3.5 w-3.5" />Add condition</button>
          </AutomationBuilderBlock>
          <AutomationBuilderBlock number="03" label="THEN" title="Compose a bounded action sequence" icon={Workflow}>
            <div className="automation-action-editor-list">{actions.map((action, index) => <div key={index} className="automation-action-editor"><div className="automation-action-editor-head"><span>{String(index + 1).padStart(2, "0")}</span><select aria-label={`Action ${index + 1} type`} value={action.type} onChange={(event) => setAction(index, defaultAutomationAction(event.target.value as BraceAutomationAction["type"]))}>{Object.entries(automationActionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><div><button type="button" disabled={index === 0} onClick={() => moveAction(index, -1)} aria-label="Move action up">↑</button><button type="button" disabled={index === actions.length - 1} onClick={() => moveAction(index, 1)} aria-label="Move action down">↓</button><button type="button" disabled={actions.length === 1} onClick={() => setActions((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove action"><X className="h-3.5 w-3.5" /></button></div></div><AutomationActionFields action={action} projects={projects} skills={skills} onChange={(config) => setAction(index, { ...action, config })} /></div>)}</div>
            <button type="button" disabled={actions.length >= 8} onClick={() => setActions((items) => [...items, defaultAutomationAction("memory.quality_scan")])} className="automation-add-step"><Plus className="h-3.5 w-3.5" />Add action</button>
          </AutomationBuilderBlock>
          <section className="automation-safety-review"><ShieldCheck className="h-5 w-5" /><div><span>PERMISSION PREVIEW</span><h2>This recipe can only:</h2><p>{permissions.map((permission) => automationPermissionLabels[permission] || permission).join(" · ")}</p><small>BRACE automations cannot run shell commands, arbitrary code, network requests, deletion, exports, backups, or connector changes.</small></div></section>
        </div>
        <footer><span><i />Stored in your local SQLite profile</span><div><button type="button" onClick={onClose} className="brace-secondary h-10 px-4">Cancel</button><button type="submit" disabled={saving || !name.trim() || !actions.length} className="brace-primary h-10 px-4"><Save className="h-4 w-4" />{saving ? "Saving…" : existingId ? "Save recipe" : "Create paused"}</button></div></footer>
      </form>
    </div>
  );
}

function AutomationBuilderBlock({ number, label, title, icon: Icon, optional, children }: { number: string; label: string; title: string; icon: LucideIcon; optional?: boolean; children: React.ReactNode }) {
  return <section className="automation-builder-block"><header><span>{number}</span><i><Icon className="h-4 w-4" /></i><div><em>{label}{optional ? " · OPTIONAL" : ""}</em><h2>{title}</h2></div></header><div className="automation-builder-block-body">{children}</div></section>;
}

function AutomationActionFields({ action, projects, skills, onChange }: { action: BraceAutomationAction; projects: BraceProject[]; skills: BraceSkill[]; onChange: (config: Record<string, unknown>) => void }) {
  const config = action.config;
  const change = (key: string, value: unknown) => onChange({ ...config, [key]: value });
  if (action.type === "memory.create") return <div className="automation-action-fields"><select value={String(config.kind || "summary")} onChange={(event) => change("kind", event.target.value)} aria-label="Memory kind">{["project", "decision", "lesson", "warning", "preference", "summary", "hypothesis", "fact", "procedure"].map((kind) => <option key={kind}>{kind}</option>)}</select><input value={String(config.scope || "global")} onChange={(event) => change("scope", event.target.value)} placeholder="Scope or {{trigger.scope}}" aria-label="Memory scope" /><input className="is-wide" required value={String(config.title || "")} onChange={(event) => change("title", event.target.value)} placeholder="Memory title · templates allowed" aria-label="Memory title" /><textarea className="is-wide" required value={String(config.content || "")} onChange={(event) => change("content", event.target.value)} placeholder="Durable content · use {{trigger.title}} or {{trigger.summary}}" aria-label="Memory content" /></div>;
  if (action.type === "decision.create") return <div className="automation-action-fields"><select value={String(config.projectId || "")} onChange={(event) => change("projectId", event.target.value)} aria-label="Decision project"><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><input value={String(config.title || "")} onChange={(event) => change("title", event.target.value)} placeholder="Decision title" aria-label="Decision title" /><textarea className="is-wide" value={String(config.decision || "")} onChange={(event) => change("decision", event.target.value)} placeholder="What was decided?" aria-label="Decision" /></div>;
  if (action.type === "memory.search") return <div className="automation-action-fields"><input value={String(config.query || "")} onChange={(event) => change("query", event.target.value)} placeholder="Query or {{trigger.title}}" aria-label="Search query" /><input value={String(config.scope || "")} onChange={(event) => change("scope", event.target.value)} placeholder="Optional scope" aria-label="Search scope" /></div>;
  if (action.type === "memory.quality_scan") return <div className="automation-action-fields"><input className="is-wide" value={String(config.scope || "")} onChange={(event) => change("scope", event.target.value)} placeholder="Optional memory scope; blank scans all" aria-label="Memory quality scope" /></div>;
  if (action.type === "timeline.digest") return <div className="automation-action-fields"><input value={String(config.title || "")} onChange={(event) => change("title", event.target.value)} placeholder="Brief title" aria-label="Timeline brief title" /><input type="number" min="1" max="8760" value={Number(config.windowHours || 24)} onChange={(event) => change("windowHours", Number(event.target.value))} aria-label="Timeline window in hours" /><input className="is-wide" value={String(config.scope || "global")} onChange={(event) => change("scope", event.target.value)} placeholder="Memory scope" aria-label="Timeline brief scope" /></div>;
  if (action.type === "project.reindex") return <div className="automation-action-fields"><select className="is-wide" required value={String(config.projectId || "")} onChange={(event) => change("projectId", event.target.value)} aria-label="Project to refresh"><option value="">Choose an imported project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>;
  if (action.type === "skill.run") { const selectedSkill = skills.find((skill) => skill.name === config.name) || skills[0]; return <div className="automation-action-fields"><select value={String(config.name || "")} onChange={(event) => { const skill = skills.find((item) => item.name === event.target.value); onChange({ ...config, name: event.target.value, action: skill?.actions[0]?.id || "" }); }} aria-label="Skill"><option value="">Choose enabled skill</option>{skills.filter((skill) => skill.enabled).map((skill) => <option key={skill.name} value={skill.name}>{skill.displayName}</option>)}</select><select value={String(config.action || "")} onChange={(event) => change("action", event.target.value)} aria-label="Skill action"><option value="">Choose action</option>{selectedSkill?.actions.map((skillAction) => <option key={skillAction.id} value={skillAction.id}>{skillAction.label}</option>)}</select></div>; }
  return null;
}


