"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useBrace } from "@/lib/brace/store";

export function Page({ eyebrow, title, description, actions, children }: { eyebrow?: string; title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  const { snapshot, view, setView } = useBrace();
  return (
    <div className="brace-page mx-auto w-full max-w-[1500px] px-5 py-7 lg:px-9 lg:py-10">
      <div className="brace-page-heading mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          {eyebrow && <div className="brace-eyebrow mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8edcff]"><span />{eyebrow}</div>}
          <h1 className="text-[clamp(2rem,3vw,3.2rem)] font-medium leading-[1.02] tracking-[-0.055em] text-[#faf7f1]">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/42">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {view !== "home" && view !== "graph" && <button type="button" className="page-brain-thread" onClick={() => setView("graph")} aria-label={`Open your Brain from ${title}`}>
        <svg viewBox="0 0 64 34" aria-hidden="true"><path d="M31 6C25 1 14 3 9 9c-6 7-4 16 3 21 6 4 14 2 19-2M33 6c6-5 17-3 22 3 6 7 4 16-3 21-6 4-14 2-19-2M31 9c4 4-3 8 2 12-4 4 1 6-2 9" /><g><circle cx="14" cy="13" r="2"/><circle cx="23" cy="23" r="2"/><circle cx="49" cy="13" r="2"/><circle cx="41" cy="24" r="2"/></g></svg>
        <span><small>CONNECTED TO YOUR BRAIN</small><strong>{snapshot?.graph.nodes.length.toLocaleString() || "0"} nodes maintain context for this workspace</strong></span>
        <span className="page-brain-thread-action">Enter Brain <ArrowRight className="h-3.5 w-3.5" /></span>
      </button>}
      {children}
    </div>
  );
}


