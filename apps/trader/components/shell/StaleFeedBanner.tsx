"use client";

import { AlertTriangle } from "lucide-react";
import { useDivergenceHalt } from "@/lib/mock/hooks";

const HALT_COPY =
  "Market data feed interrupted; trading paused to protect your evaluation. Resumes automatically.";

export function StaleFeedBanner() {
  const { halted, toggle } = useDivergenceHalt();

  if (!halted) {
    // dev affordance: a tiny corner toggle so QA can engage the halt.
    return (
      <button
        type="button"
        onClick={toggle}
        title="Dev: simulate feed halt"
        className="fixed bottom-3 left-3 z-30 rounded-full border border-border bg-surface-2/80 px-2 py-1 text-[10px] uppercase tracking-wide text-text-faint backdrop-blur transition-colors hover:text-warn"
      >
        sim halt
      </button>
    );
  }

  return (
    <div
      role="alert"
      className="sticky top-14 z-30 flex items-center justify-center gap-2 border-b border-warn/40 bg-warn/15 px-4 py-2 text-sm text-warn"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{HALT_COPY}</span>
      <button
        type="button"
        onClick={toggle}
        className="ml-3 rounded-sm border border-warn/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-warn/80 transition-colors hover:text-warn"
      >
        dev: resume
      </button>
    </div>
  );
}
