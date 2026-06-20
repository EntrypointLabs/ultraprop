"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useConnection, useDivergenceHalt } from "@/lib/mock/hooks";

const STALE_COPY =
  "Live market data is unavailable; trading is suspended until the oracle feed recovers.";
const RECONNECTING_COPY =
  "Reconnecting to the live feed — prices are momentarily not updating. Trading stays open.";

export function StaleFeedBanner() {
  const status = useConnection();
  const { halted, toggle } = useDivergenceHalt();
  const stale = status === "stale";
  const reconnecting = status === "reconnecting";

  if (!stale) {
    return (
      <>
        {/* Non-blocking notice: the feed is mid-reconnect, so the sim is marking
            against the last-known prices. Trading is NOT suspended (that is the
            stale path); this just tells the user prices are briefly frozen. */}
        {reconnecting && (
          <div
            role="status"
            className="fixed inset-x-0 top-[58px] z-30 flex items-center justify-center gap-2 border-b border-warn/30 bg-warn/10 px-4 py-1.5 text-xs text-warn/90 backdrop-blur-sm"
          >
            <Loader2
              className="h-3.5 w-3.5 shrink-0 animate-spin"
              aria-hidden="true"
            />
            <span>{RECONNECTING_COPY}</span>
          </div>
        )}
        {/* dev affordance: a tiny corner toggle so QA can simulate a feed halt. */}
        {process.env.NODE_ENV !== "production" && (
          <button
            type="button"
            onClick={toggle}
            title="Dev: simulate feed halt"
            className="fixed bottom-3 left-3 z-30 rounded-full border border-border bg-surface-2/80 px-2 py-1 text-[10px] uppercase tracking-wide text-text-faint backdrop-blur transition-colors hover:text-warn"
          >
            sim halt
          </button>
        )}
      </>
    );
  }

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-[58px] z-30 flex items-center justify-center gap-2 border-b border-warn/40 bg-warn/15 px-4 py-2 text-sm text-warn backdrop-blur-sm"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{STALE_COPY}</span>
      {halted && (
        <button
          type="button"
          onClick={toggle}
          className="ml-3 rounded-sm border border-warn/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-warn/80 transition-colors hover:text-warn"
        >
          dev: resume
        </button>
      )}
    </div>
  );
}
