import WebSocket from "ws";
import type {
  FeeSchedule,
  FundingTick,
  LiquidationParams,
  Market,
  MarkTick,
  VenueAdapter,
  VenueId,
} from "./adapter.js";

/**
 * The Hyperliquid adapter — the ONLY place that speaks HL's `/info` dialect.
 * Runs server-side (route handlers / indexer) so the browser never touches
 * `api.hyperliquid.xyz`. Validation is manual narrowing (repo convention: no
 * Zod). HL encodes numbers as strings, so values are parsed to `number` at this
 * edge. The default `info` call returns crypto perps only — the equity-index dex
 * needs an explicit `dex` param, so equities are excluded by construction.
 */

const INFO_URL = "https://api.hyperliquid.xyz/info";
const WS_URL = "wss://api.hyperliquid.xyz/ws";

/** Batched marks are flushed to the consumer at most this often. Kept tight (~4Hz)
 * so a fast adverse move reaches the trader's live PnL in ~250ms, not ~1s — a
 * leveraged position can drain meaningfully inside a one-second blind window. */
const MARK_FLUSH_MS = 250;
/** Reconnect backoff after the socket drops. */
const WS_RECONNECT_MS = 2_000;
/** REST fallback poll cadence when the WS subscription budget is exceeded. */
const REST_POLL_MS = 1_000;
/** HL caps a single connection at 1000 subscriptions. */
const WS_SUBSCRIPTION_LIMIT = 1000;

interface UniverseEntry {
  name: string;
  szDecimals: number | string;
  maxLeverage: number | string;
  onlyIsolated?: boolean;
  isDelisted?: boolean;
}

interface RawAssetCtx {
  markPx: string;
  oraclePx: string;
  /** thin books can omit a mid — guard before use */
  midPx: string | null;
  funding: string;
  prevDayPx: string;
}

type MetaAndAssetCtxs = [{ universe: UniverseEntry[] }, RawAssetCtx[]];

/** `activeAssetCtx` WS push: { channel, data: { coin, ctx } }. */
interface ActiveAssetCtxMsg {
  channel?: string;
  data?: {
    coin?: string;
    ctx?: Partial<RawAssetCtx>;
  };
}

/** Live mark/funding context for one market, keyed by bare symbol downstream. */
export interface AssetCtx {
  markPx: string;
  oraclePx: string;
  midPx: string | null;
  funding: string;
  prevDayPx: string;
}

/** A single OHLCV bar from `candleSnapshot` / the `candle` WS feed. */
export interface Candle {
  /** open time, epoch ms */
  t: number;
  /** close time, epoch ms */
  T: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface RawCandle {
  t: number;
  T: number;
  o: string;
  c: string;
  h: string;
  l: string;
  v: string;
}

async function postInfo<T>(body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Hyperliquid /info ${res.status}`);
  return (await res.json()) as T;
}

const HL_MAKER = 0.00015;
const HL_TAKER = 0.00045;
const HL_FUNDING_INTERVAL_MS = 3_600_000;

/**
 * HL price precision is `6 - szDecimals` decimals (perps); the tick is `10^-d`.
 * Clamp `d` to [0, 8] so a malformed `szDecimals` can never yield a nonsense
 * (e.g. negative-exponent-overflow) tick.
 */
function tickSizeFromSzDecimals(szDecimals: number): number {
  const d = Math.min(8, Math.max(0, 6 - szDecimals));
  return 10 ** -d;
}

function buildMarket(u: UniverseEntry): Market {
  const szDecimals = Number(u.szDecimals);
  return {
    id: `hyperliquid:${u.name}`,
    venue: "hyperliquid",
    symbol: u.name,
    base: u.name,
    displayName: `${u.name}-PERP`,
    szDecimals,
    tickSize: tickSizeFromSzDecimals(szDecimals),
    maxLeverage: Number(u.maxLeverage),
    maker: HL_MAKER,
    taker: HL_TAKER,
    fundingIntervalMs: HL_FUNDING_INTERVAL_MS,
    isDelisted: u.isDelisted === true,
  };
}

/** Parse a number from a venue string field; non-numeric → fallback. */
function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Build a `MarkTick` from a raw HL asset ctx. HL omits `nextFundingTime` on
 * `assetCtx` (it lives on `predictedFundings`), so it is stamped 0 (unknown).
 * A thin book may report no `midPx`; fall back to `markPx` so fills still price.
 *
 * `change24h` is derived from HL's `prevDayPx` (the only 24h reference HL gives
 * per-coin — it carries no 24h high/low here), and is `null` when prevDay is
 * absent or zero so the FE shows "—" rather than a bogus 0%/Infinity.
 */
export function ctxToMarkTick(
  marketId: string,
  ctx: Partial<AssetCtx>,
  ts: number,
): MarkTick {
  const markPx = toNum(ctx.markPx);
  const prevDayPx = toNum(ctx.prevDayPx);
  const change24h =
    prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : null;
  return {
    marketId,
    markPx,
    oraclePx: toNum(ctx.oraclePx, markPx),
    midPx: ctx.midPx == null ? markPx : toNum(ctx.midPx, markPx),
    fundingRate: toNum(ctx.funding),
    change24h,
    nextFundingTime: 0,
    ts,
  };
}

export class HyperliquidAdapter implements VenueAdapter {
  readonly venue: VenueId = "hyperliquid";

  /**
   * The full live HL perp catalog, normalized. Reads `meta.universe` only
   * (assetCtxs is live data, handled by `fetchAssetCtxs`), parses numbers off
   * the string fields, and drops delisted markets.
   */
  async listMarkets(signal?: AbortSignal): Promise<Market[]> {
    const data = await postInfo<MetaAndAssetCtxs>(
      { type: "metaAndAssetCtxs" },
      signal,
    );
    if (!Array.isArray(data) || !data[0]?.universe) {
      throw new Error("Hyperliquid metaAndAssetCtxs: unexpected shape");
    }
    const [meta] = data;
    return meta.universe.map(buildMarket).filter((m) => !m.isDelisted);
  }

  /**
   * Open ONE `wss://api.hyperliquid.xyz/ws`, subscribe `activeAssetCtx` per live
   * market (179 ≪ the 1000-sub/conn ceiling), and push batched `MarkTick[]` to
   * `onTick` at most once per second. HL pushes faster than that; coalescing here
   * keeps every downstream re-render to ~1Hz. Reconnects with backoff and
   * re-subscribes on drop. If the catalog ever exceeds the subscription budget,
   * falls back to a ~1s `metaAndAssetCtxs` REST poll. Returns an unsubscribe fn.
   */
  subscribeMarks(onTick: (ticks: MarkTick[]) => void): () => void {
    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let flushTimer: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    /** symbol → latest pending tick, flushed and cleared every MARK_FLUSH_MS. */
    const pending = new Map<string, MarkTick>();

    const flush = () => {
      if (pending.size === 0) return;
      const batch = [...pending.values()];
      pending.clear();
      onTick(batch);
    };

    const startFallbackPoll = () => {
      if (pollTimer || closed) return;
      const poll = async () => {
        try {
          const ctxs = await fetchAssetCtxs();
          const ts = Date.now();
          for (const [symbol, ctx] of Object.entries(ctxs)) {
            pending.set(
              symbol,
              ctxToMarkTick(`hyperliquid:${symbol}`, ctx, ts),
            );
          }
        } catch (err) {
          console.error("[HyperliquidAdapter] REST mark poll failed", err);
        }
      };
      void poll();
      pollTimer = setInterval(() => void poll(), REST_POLL_MS);
    };

    const connect = async () => {
      if (closed) return;
      let markets: Market[];
      try {
        markets = await this.listMarkets();
      } catch (err) {
        console.error(
          "[HyperliquidAdapter] catalog fetch for feed failed; retrying",
          err,
        );
        reconnectTimer = setTimeout(() => void connect(), WS_RECONNECT_MS);
        return;
      }
      if (closed) return;

      if (markets.length > WS_SUBSCRIPTION_LIMIT) {
        startFallbackPoll();
        return;
      }

      const socket = new WebSocket(WS_URL);
      ws = socket;

      socket.on("open", () => {
        for (const m of markets) {
          socket.send(
            JSON.stringify({
              method: "subscribe",
              subscription: { type: "activeAssetCtx", coin: m.symbol },
            }),
          );
        }
      });

      socket.on("message", (raw: WebSocket.RawData) => {
        let msg: ActiveAssetCtxMsg;
        try {
          msg = JSON.parse(raw.toString()) as ActiveAssetCtxMsg;
        } catch {
          return; // ignore non-JSON / subscription ack noise
        }
        const coin = msg.data?.coin;
        const ctx = msg.data?.ctx;
        if (!coin || !ctx) return; // snapshot ack / unrelated channel
        pending.set(
          coin,
          ctxToMarkTick(`hyperliquid:${coin}`, ctx, Date.now()),
        );
      });

      const scheduleReconnect = () => {
        ws = null;
        if (closed || reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          void connect();
        }, WS_RECONNECT_MS);
      };

      socket.on("close", scheduleReconnect);
      socket.on("error", (err) => {
        console.error("[HyperliquidAdapter] WS error", err);
        try {
          socket.close();
        } catch {
          scheduleReconnect();
        }
      });
    };

    flushTimer = setInterval(flush, MARK_FLUSH_MS);
    void connect();

    return () => {
      closed = true;
      if (flushTimer) clearInterval(flushTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try {
          ws.close();
        } catch {
          // already closing
        }
      }
    };
  }

  /**
   * HL streams funding inline on `activeAssetCtx` (see `subscribeMarks`), so a
   * dedicated funding stream is unused this phase. Phase 4 can derive funding
   * from the mark tick's `fundingRate`; this is a typed no-op for the interface.
   */
  subscribeFunding(_onTick: (ticks: FundingTick[]) => void): () => void {
    return () => {};
  }

  /** HL VIP0 base fees (static, not per-user-tier). */
  fees(_marketId: string): FeeSchedule {
    return { maker: HL_MAKER, taker: HL_TAKER };
  }

  /**
   * HL maintenance margin is half the initial margin at max leverage. Without the
   * per-market `maxLeverage` here we return a conservative isolated default; Phase 4
   * threads the real per-market value. Carried for interface shape only.
   */
  liquidationParams(_marketId: string): LiquidationParams {
    return { maintenanceMarginFraction: 0.0125, marginMode: "isolated" };
  }
}

/**
 * Live marks for the full universe, keyed by BARE symbol (e.g. "BTC"). The
 * frontend maps these onto `hyperliquid:<symbol>` ids. `universe[i]` and
 * `assetCtxs[i]` are index-aligned (ctxs carry no name), so they are zipped by
 * position; delisted markets are dropped so the keys match the served catalog.
 */
export async function fetchAssetCtxs(
  signal?: AbortSignal,
): Promise<Record<string, AssetCtx>> {
  const data = await postInfo<MetaAndAssetCtxs>(
    { type: "metaAndAssetCtxs" },
    signal,
  );
  if (!Array.isArray(data) || !data[0]?.universe || !Array.isArray(data[1])) {
    throw new Error("Hyperliquid metaAndAssetCtxs: unexpected shape");
  }
  const [meta, assetCtxs] = data;
  const out: Record<string, AssetCtx> = {};
  meta.universe.forEach((u, i) => {
    if (u.isDelisted === true) return;
    const ctx = assetCtxs[i];
    if (!ctx) return;
    out[u.name] = {
      markPx: ctx.markPx,
      oraclePx: ctx.oraclePx,
      midPx: ctx.midPx,
      funding: ctx.funding,
      prevDayPx: ctx.prevDayPx,
    };
  });
  return out;
}

/**
 * Most-recent OHLCV history for one market (HL caps at 5000 candles). `coin` is
 * the BARE ticker ("BTC", "kPEPE") — the venue-qualified id prefix is stripped
 * by the caller.
 */
export async function fetchCandles(
  coin: string,
  interval: string,
  startMs: number,
  endMs: number,
  signal?: AbortSignal,
): Promise<Candle[]> {
  const raw = await postInfo<RawCandle[]>(
    {
      type: "candleSnapshot",
      req: { coin, interval, startTime: startMs, endTime: endMs },
    },
    signal,
  );
  return (raw ?? []).map(mapCandle);
}

function mapCandle(c: RawCandle): Candle {
  return {
    t: c.t,
    T: c.T,
    open: Number(c.o),
    high: Number(c.h),
    low: Number(c.l),
    close: Number(c.c),
    volume: Number(c.v),
  };
}
