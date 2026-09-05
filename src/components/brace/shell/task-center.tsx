"use client";

import { useEffect, useState } from "react";
import { Activity, Check, ChevronRight, Info, LoaderCircle, X } from "lucide-react";
import type { BraceTask } from "@/lib/brace/types";

export function TaskCenter({ initialTasks }: { initialTasks: BraceTask[] }) {
  const [tasks, setTasks] = useState<BraceTask[]>(initialTasks);
  const [open, setOpen] = useState(initialTasks.some((task) => task.status === "running"));

  useEffect(() => {
    setTasks((current) => {
      const merged = [...current];
      for (const task of initialTasks) {
        const index = merged.findIndex((item) => item.id === task.id);
        if (index >= 0) merged[index] = task;
        else merged.push(task);
      }
      return merged.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 20);
    });
  }, [initialTasks]);

  useEffect(() => window.electron?.onBraceTaskProgress?.((task) => {
    setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)].slice(0, 20));
    if (task.status === "running") setOpen(true);
  }), []);

  const running = tasks.filter((task) => task.status === "running");
  if (!tasks.length) return null;
  return (
    <aside className={`task-center ${open ? "is-open" : ""}`} aria-label="Background task center">
      <button type="button" className="task-center-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span><Activity />{running.length ? <i /> : <Check />}</span>
        <strong>{running.length ? `${running.length} task${running.length === 1 ? "" : "s"} running` : "Tasks"}</strong>
        <ChevronRight />
      </button>
      {open && (
        <div className="task-center-panel">
          <header><div><span>BACKGROUND WORK</span><h2>Task center</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close task center"><X /></button></header>
          <div>{tasks.slice(0, 8).map((task) => {
            const percent = task.total ? Math.round((task.completed / task.total) * 100) : 0;
            return (
              <article key={task.id} data-status={task.status}>
                <div className="task-center-row"><span>{task.status === "running" ? <LoaderCircle /> : task.status === "failed" ? <Info /> : <Check />}</span><div><strong>{task.title}</strong><small>{task.phase.replaceAll("-", " ")} · {task.completed.toLocaleString()}{task.total ? ` / ${task.total.toLocaleString()}` : ""}</small></div><em>{task.status === "running" ? `${percent}%` : task.status}</em></div>
                <div className="task-progress"><i style={{ width: `${task.status === "complete" ? 100 : percent}%` }} /></div>
                {task.error && <p>{task.error}</p>}
                {task.cancellable && <button type="button" onClick={() => void window.electron?.cancelBraceTask?.(task.id)}>Cancel safely</button>}
              </article>
            );
          })}</div>
        </div>
      )}
    </aside>
  );
}
