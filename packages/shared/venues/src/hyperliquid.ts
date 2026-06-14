import type { Market, VenueAdapter, VenueId } from "./adapter.js";

/**
 * The Hyperliquid adapter — the ONLY place that speaks HL's `/info` dialect.
 * Runs server-side (route handlers / indexer) so the browser never touches
 * `api.hyperliquid.xyz`. Validation is manual narrowing (repo convention: no
 * Zod). HL encodes numbers as strings, so values are parsed to `number` at this
 * edge. The default `info` call returns crypto perps only — the equity-index dex
 * needs an explicit `dex` param, so equities are excluded by construction.
 */

const INFO_URL = "https://api.hyperliquid.xyz/info";

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
    return meta.universe
      .map(buildMarket)
      .filter((m) => !m.isDelisted);
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
