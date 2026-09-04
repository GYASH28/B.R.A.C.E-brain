#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const write = (relative, value) => fs.writeFileSync(path.join(root, relative), value.replace(/\r\n/g, "\n"));
const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Automation reliability patch could not locate ${label}.`);
  return source.replace(search, replacement);
};

let store = read("core/memory-store.js");
if (!store.includes("recoverInterruptedAutomationRuns(")) {
  store = replaceRequired(
    store,
    "  finishAutomationRun(id, input) {\n",
    `  updateAutomationRunSteps(id, steps) {\n    const current = this.getAutomationRun(id);\n    if (!current) throw new Error("Automation run not found.");\n    if (current.status !== "running") return current;\n    this.db.prepare("UPDATE automation_runs SET steps_json=? WHERE id=? AND status='running'")\n      .run(JSON.stringify(Array.isArray(steps) ? steps : []), current.id);\n    return this.getAutomationRun(current.id);\n  }\n\n  recoverInterruptedAutomationRuns(recoveredAt = nowIso()) {\n    const rows = this.db.prepare(\n      "SELECT id FROM automation_runs WHERE status='running' ORDER BY started_at ASC",\n    ).all();\n    const recovered = [];\n    for (const row of rows) {\n      const current = this.getAutomationRun(row.id);\n      if (!current) continue;\n      const steps = Array.isArray(current.steps)\n        ? current.steps.map((step) => ({ ...step }))\n        : [];\n      for (let index = steps.length - 1; index >= 0; index -= 1) {\n        if (steps[index]?.status !== "running") continue;\n        steps[index] = {\n          ...steps[index],\n          status: "failed",\n          detail: "BRACE closed before this action reported completion.",\n          recoveredAt,\n        };\n        break;\n      }\n      steps.push({\n        type: "recovery",\n        status: "failed",\n        detail: "BRACE closed before this automation run completed. It was not retried automatically.",\n        recoveredAt,\n      });\n      recovered.push(this.finishAutomationRun(current.id, {\n        status: "failed",\n        steps,\n        error: "BRACE closed before this automation run completed.",\n        finishedAt: recoveredAt,\n      }));\n    }\n    return recovered;\n  }\n\n  finishAutomationRun(id, input) {\n`,
    "automation run finalizer",
  );
}
write("core/memory-store.js", store);

let engine = read("core/automation-engine.js");
if (!engine.includes("this.recoveredRuns =")) {
  engine = replaceRequired(
    engine,
    `    this.store = store;\n    this.adapters = adapters;\n    this.running = new Set();\n`,
    `    this.store = store;\n    this.adapters = adapters;\n    this.running = new Set();\n    this.recoveredRuns = typeof this.store.recoverInterruptedAutomationRuns === "function"\n      ? this.store.recoverInterruptedAutomationRuns()\n      : [];\n    for (const run of this.recoveredRuns) {\n      const automation = run.automationId ? this.store.getAutomation(run.automationId) : null;\n      if (!automation?.enabled || !automation.trigger.type.startsWith("schedule.")) continue;\n      this.store.markAutomationRun(\n        automation.id,\n        run.finishedAt,\n        nextRunAt(automation.trigger, new Date(run.finishedAt)),\n      );\n    }\n`,
    "AutomationEngine constructor",
  );
}
if (!engine.includes("persistSteps = () =>")) {
  engine = replaceRequired(
    engine,
    `    this.running.add(automation.id);\n    const steps = [];\n    try {\n`,
    `    this.running.add(automation.id);\n    const steps = [];\n    const persistSteps = () => {\n      if (typeof this.store.updateAutomationRunSteps === "function") {\n        this.store.updateAutomationRunSteps(run.id, steps);\n      }\n    };\n    try {\n`,
    "run step trace setup",
  );
  engine = replaceRequired(
    engine,
    `      steps.push({\n        type: "conditions",\n        status: passed ? "success" : "skipped",\n        detail: automation.conditions.length\n          ? \`${'${automation.conditions.length}'} ${'${automation.conditionLogic.toUpperCase()}'} condition(s) evaluated.\`\n          : "No conditions configured.",\n      });\n`,
    `      steps.push({\n        type: "conditions",\n        status: passed ? "success" : "skipped",\n        detail: automation.conditions.length\n          ? \`${'${automation.conditions.length}'} ${'${automation.conditionLogic.toUpperCase()}'} condition(s) evaluated.\`\n          : "No conditions configured.",\n      });\n      persistSteps();\n`,
    "condition trace",
  );
  engine = replaceRequired(
    engine,
    `        if (dryRun) {\n          steps.push({ index, type: action.type, status: "preview", input: cleanObject(preview) });\n          continue;\n        }\n        const startedAt = Date.now();\n        const output = await this.executeAction(action, context);\n        steps.push({\n          index,\n          type: action.type,\n          status: output?.skipped ? "skipped" : "success",\n          durationMs: Date.now() - startedAt,\n          output: cleanObject(output),\n        });\n`,
    `        if (dryRun) {\n          steps.push({ index, type: action.type, status: "preview", input: cleanObject(preview) });\n          persistSteps();\n          continue;\n        }\n        const startedAt = Date.now();\n        const step = {\n          index,\n          type: action.type,\n          status: "running",\n          input: cleanObject(preview),\n          startedAt: new Date(startedAt).toISOString(),\n        };\n        steps.push(step);\n        persistSteps();\n        const output = await this.executeAction(action, context);\n        steps[steps.length - 1] = {\n          ...step,\n          status: output?.skipped ? "skipped" : "success",\n          durationMs: Date.now() - startedAt,\n          finishedAt: new Date().toISOString(),\n          output: cleanObject(output),\n        };\n        persistSteps();\n`,
    "action execution trace",
  );
  engine = replaceRequired(
    engine,
    `    } catch (error) {\n      const message = cleanText(error instanceof Error ? error.message : "Automation failed.", 2_000);\n      steps.push({ type: "error", status: "failed", detail: message });\n`,
    `    } catch (error) {\n      const message = cleanText(error instanceof Error ? error.message : "Automation failed.", 2_000);\n      for (let index = steps.length - 1; index >= 0; index -= 1) {\n        if (steps[index]?.status !== "running") continue;\n        steps[index] = { ...steps[index], status: "failed", detail: message, finishedAt: new Date().toISOString() };\n        break;\n      }\n      steps.push({ type: "error", status: "failed", detail: message });\n      persistSteps();\n`,
    "failed action trace",
  );
}
write("core/automation-engine.js", engine);

process.stdout.write("Applied BRACE automation reliability hardening.\n");
