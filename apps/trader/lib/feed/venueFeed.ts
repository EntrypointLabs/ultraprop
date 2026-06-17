import type { MarkTick } from "@shared/venues";

export type FeedStatus = "live" | "reconnecting" | "stale";

/** SSE event name the gateway emits batches under (NOT the default `message`). */
const MARKS_EVENT = "marks";
/** Heartbeat the gateway sends (~5s) so a quiet-but-healthy feed stays "live". */
const PING_EVENT = "ping";
/** Server batches/heartbeats well under this; treat as stale after this silence. */
const SILENCE_TIMEOUT_MS = 15_000;

export interface VenueFeed {
  close: () => void;
}

/**
 * Subscribe to the gateway's live mark feed over Server-Sent Events. The browser
 * hits same-origin `/api/feed` (proxied to the gateway) — never the venue
 * directly. Each `"marks"` event carries a batched `MarkTick[]` snapshot; status
 * is reported `"live"` on open, `"reconnecting"` on transport error (EventSource
 * auto-retries), and `"stale"` when no batch arrives within the silence window.
 *
 * Must only run in a client effect — it touches `EventSource`, timers, and the
 * clock, none of which may exist at module scope (SSR determinism).
 */
export function openVenueFeed(
  venue: string,
  onBatch: (ticks: MarkTick[]) => void,
  onStatus: (status: FeedStatus) => void,
): VenueFeed {
  const source = new EventSource(`/api/feed?venue=${venue}`);
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const armSilenceTimer = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => onStatus("stale"), SILENCE_TIMEOUT_MS);
  };

  // Any frame (batch or heartbeat) proves the connection is alive: clear stale
  // and (re)disarm the silence timer. This is what recovers from a reconnect.
  const markLive = () => {
    onStatus("live");
    armSilenceTimer();
  };

  source.onopen = markLive;

  source.onerror = () => {
    // EventSource reconnects on its own; surface the gap so the UI degrades.
    onStatus("reconnecting");
  };

  source.addEventListener(PING_EVENT, markLive);

  source.addEventListener(MARKS_EVENT, (event) => {
    try {
      const ticks = JSON.parse((event as MessageEvent).data) as MarkTick[];
      markLive();
      onBatch(ticks);
    } catch {
      // A malformed frame is a transient hiccup; the next batch recovers.
    }
  });

  return {
    close: () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      source.close();
    },
  };
}
