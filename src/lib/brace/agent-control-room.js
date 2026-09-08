"use strict";

function classifyAutomationAgent({ automation, lastRun = null, runtimePaused = false } = {}) {
  if (!automation || typeof automation !== "object") {
    return { id: "unassigned", label: "Unassigned", detail: "No local agent definition is selected.", tone: "idle" };
  }
  if (runtimePaused || automation.enabled !== true) {
    return { id: "assigned", label: "Assigned", detail: runtimePaused ? "The local agent team is paused." : "Ready after you review and enable it.", tone: "idle" };
  }
  if (lastRun?.status === "running") {
    return { id: "running", label: "Running", detail: "A typed local step is in progress.", tone: "live" };
  }
  if (lastRun?.status === "failed") {
    return { id: "attention", label: "Needs attention", detail: "Open the trace to inspect the failure and safe retry point.", tone: "danger" };
  }
  if (lastRun?.status === "success") {
    return { id: "completed", label: "Completed", detail: "The last run finished and its effects are recorded.", tone: "success" };
  }
  if (lastRun?.status === "preview") {
    return { id: "assigned", label: "Previewed", detail: "The plan was inspected without changing memory.", tone: "review" };
  }
  if (lastRun?.status === "skipped") {
    return { id: "assigned", label: "Waiting", detail: "The last trigger was safely skipped.", tone: "idle" };
  }
  return { id: "assigned", label: "Assigned", detail: "Enabled and waiting for its next approved trigger.", tone: "review" };
}

module.exports = { classifyAutomationAgent };
