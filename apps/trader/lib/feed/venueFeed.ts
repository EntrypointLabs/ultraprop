import type { MarkTick } from "@shared/venues";

export type FeedStatus = "live" | "reconnecting" | "stale";

/** SSE event name the gateway emits batches under (NOT the default `message`). */
const MARKS_EVENT = "marks";
/** Heartbeat the gateway sends (~5s) so a quiet-but-healthy feed stays "live". */
const PING_EVENT = "ping";
/** Server batches/heartbeats well under this; treat as stale after this silence. */
const SILENCE_TIMEOUT_MS = 15_000;
/** Fixed reconnect cadence — we drive retries ourselves rather than relying on
 * EventSource's native exponential backoff (which leaves recovery >30s after a
 * hard disconnect). A healthy gateway then comes back "live" within this window. */
const RECONNECT_MS = 3_000;

export interface VenueFeed {
  close: () => void;
}

/**
 * Subscribe to the gateway's live mark feed over Server-Sent Events. The browser
 * hits same-origin `/api/feed` (proxied to the gateway) — never the venue
 * directly. Each `"marks"` event carries a batched `MarkTick[]` snapshot; status
 * is `"live"` on any frame, `"reconnecting"` while a connection is down/retrying,
 * and `"stale"` only when an established feed goes silent past the timeout.
 *
 * Reconnection is driven HERE (close + retry on a fixed cadence) so a hard
 * gateway restart recovers in ~`RECONNECT_MS`, not the browser's slow native
 * backoff. Must only run in a client effect — it touches `EventSource`, timers,
 * and the clock, none of which may exist at module scope (SSR determinism).
 */
export function openVenueFeed(
  venue: string,
  onBatch: (ticks: MarkTick[]) => void,
  onStatus: (status: FeedStatus) => void,
): VenueFeed {
  let source: EventSource | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  // "stale" is a CONFIRMED live->silent transition, never a cold-start gap. We
  // only arm the silence timer (and only surface "stale") once the feed has
  // actually reached "live"; before that, a slow/down feed reads "reconnecting".
  let everLive = false;

  const clearSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = null;
  };

  const armSilenceTimer = () => {
    clearSilence();
    if (!everLive) return;
    // A silent-but-open feed: surface stale, then force a fresh connection so
    // recovery doesn't wait on the dead socket.
    silenceTimer = setTimeout(() => {
      onStatus("stale");
      reconnect();
    }, SILENCE_TIMEOUT_MS);
  };

  // Any frame (batch or heartbeat) proves the connection is alive: clear stale
  // and (re)disarm the silence timer. This is what recovers from a reconnect.
  const markLive = () => {
    everLive = true;
    onStatus("live");
    armSilenceTimer();
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, RECONNECT_MS);
  };

  const reconnect = () => {
    if (closed) return;
    clearSilence();
    if (source) {
      source.close();
      source = null;
    }
    scheduleReconnect();
  };

  function connect() {
    if (closed) return;
    source = new EventSource(`/api/feed?venue=${venue}`);

    source.onopen = markLive;

    source.onerror = () => {
      // A transport error is "reconnecting", never "stale" — stale is reserved
      // for an open-but-quiet feed. Take control of the retry: drop the dead
      // socket and reconnect on our own cadence (the halt latch in the store
      // keeps the stale banner up until a live frame actually arrives).
      onStatus("reconnecting");
      reconnect();
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
  }

  connect();

  return {
    close: () => {
      closed = true;
      clearSilence();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      source?.close();
      source = null;
    },
  };
}
