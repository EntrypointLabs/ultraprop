import {
  HyperliquidAdapter,
  type MarkTick,
  type VenueAdapter,
  type VenueId,
} from "@shared/venues";

/**
 * The gateway-side live feed. One venue subscription (the adapter owns the WS)
 * fills a latest-per-market `MarkTick` map; a single ~1s interval fans the whole
 * snapshot out to every connected SSE client. The adapter is the ONLY venue
 * caller, and batching here is the second throttle gate — every FE `usePrice`
 * consumer re-renders per write, so the wire stays at ~1Hz no matter how fast HL
 * pushes.
 */

const EMIT_INTERVAL_MS = 1_000;

type BatchListener = (ticks: MarkTick[]) => void;

class VenueFeed {
  private readonly latest = new Map<string, MarkTick>();
  private readonly listeners = new Set<BatchListener>();
  private unsubscribe: (() => void) | null = null;
  private emitTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly adapter: VenueAdapter) {}

  /** Subscribe to ~1s batches; lazily starts the venue feed on the first client. */
  subscribe(listener: BatchListener): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    // Seed the new client with the current snapshot so it renders immediately.
    const snapshot = [...this.latest.values()];
    if (snapshot.length > 0) listener(snapshot);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  private start(): void {
    this.unsubscribe = this.adapter.subscribeMarks((ticks) => {
      for (const t of ticks) this.latest.set(t.marketId, t);
    });
    this.emitTimer = setInterval(() => this.emit(), EMIT_INTERVAL_MS);
  }

  private stop(): void {
    if (this.emitTimer) clearInterval(this.emitTimer);
    this.emitTimer = null;
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = null;
    this.latest.clear();
  }

  private emit(): void {
    if (this.latest.size === 0) return;
    const batch = [...this.latest.values()];
    for (const listener of this.listeners) listener(batch);
  }
}

const feeds = new Map<VenueId, VenueFeed>();

function adapterFor(venue: VenueId): VenueAdapter {
  if (venue === "hyperliquid") return new HyperliquidAdapter();
  throw new Error(`unknown venue: ${venue}`);
}

/** The shared feed for a venue, created lazily and reused across all clients. */
export function getFeed(venue: VenueId): VenueFeed {
  let feed = feeds.get(venue);
  if (!feed) {
    feed = new VenueFeed(adapterFor(venue));
    feeds.set(venue, feed);
  }
  return feed;
}
