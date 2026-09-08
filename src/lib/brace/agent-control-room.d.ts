import type { BraceAutomation, BraceAutomationRun } from "./types";

export interface AutomationAgentState {
  id: "unassigned" | "assigned" | "running" | "attention" | "completed";
  label: string;
  detail: string;
  tone: "idle" | "live" | "danger" | "success" | "review";
}

export function classifyAutomationAgent(input?: {
  automation?: BraceAutomation | null;
  lastRun?: BraceAutomationRun | null;
  runtimePaused?: boolean;
}): AutomationAgentState;
