import { getMarket, MARKET_CATALOG } from "@/lib/mock/markets";
import type { MarketId } from "@/lib/mock/types";

const HERMES = "https://hermes.pyth.network";
const BENCHMARKS = "https://benchmarks.pyth.network";

/**
 * Map a Pyth feed id (lowercased, no 0x) back to its market id. Built from the
 * catalog so adding a market with a feed id is the only place a new pair is
 * declared — there is no parallel id->symbol table to keep in sync.
 */
const ID_TO_MARKET = new Map<string, MarketId>(
  MARKET_CATALOG.map((m) => [m.pythFeedId.replace(/^0x/, "").toLowerCase(), m.id]),
);

export interface OraclePrice {
  symbol: MarketId;
  /** spot price in USD */
  price: number;
  /** epoch ms of the oracle publish time */
  publishTime: number;
}

export interface OracleHistory {
  symbol: MarketId;
  /** hourly closes over the trailing 24h, oldest -> newest, USD */
  closes: number[];
  /** spot price ~24h ago, used to derive the 24h change */
  price24hAgo: number;
  /** highest trade over the trailing 24h, USD */
  high24h: number;
  /** lowest trade over the trailing 24h, USD */
  low24h: number;
}

interface HermesParsed {
  id: string;
  price: { price: string; expo: number; publish_time: number };
}

function scale(price: string, expo: number): number {
  return Number(price) * 10 ** expo;
}

/** Latest oracle spot for each requested market, in one Hermes request. */
export async function fetchLatestPrices(
  ids: MarketId[],
  signal?: AbortSignal,
): Promise<OraclePrice[]> {
  const query = ids
    .map((id) => getMarket(id)?.pythFeedId)
    .filter((feed): feed is string => Boolean(feed))
    .map((feed) => `ids[]=${encodeURIComponent(feed)}`)
    .join("&");
  const res = await fetch(`${HERMES}/v2/updates/price/latest?${query}`, {
    signal,
  });
  if (!res.ok) throw new Error(`Hermes ${res.status}`);
  const json = (await res.json()) as { parsed: HermesParsed[] };
  const out: OraclePrice[] = [];
  for (const p of json.parsed ?? []) {
    const symbol = ID_TO_MARKET.get(p.id.toLowerCase());
    if (!symbol) continue;
    out.push({
      symbol,
      price: scale(p.price.price, p.price.expo),
      publishTime: p.price.publish_time * 1000,
    });
  }
  return out;
}

interface UdfHistory {
  s: string;
  t?: number[];
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
}

/**
 * Trailing 24h of hourly closes from Pyth Benchmarks, used to draw the
 * sparkline and derive the 24h change against the live spot.
 */
export async function fetchDailyHistory(
  id: MarketId,
  nowSec: number,
  signal?: AbortSignal,
): Promise<OracleHistory | null> {
  const benchmarkSymbol = getMarket(id)?.pythBenchmarkSymbol;
  if (!benchmarkSymbol) return null;
  const from = nowSec - 24 * 60 * 60;
  const url =
    `${BENCHMARKS}/v1/shims/tradingview/history` +
    `?symbol=${encodeURIComponent(benchmarkSymbol)}` +
    `&resolution=60&from=${from}&to=${nowSec}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Benchmarks ${res.status}`);
  const json = (await res.json()) as UdfHistory;
  if (json.s !== "ok" || !json.c || json.c.length === 0) return null;
  const closes = json.c;
  const highs = json.h ?? closes;
  const lows = json.l ?? closes;
  return {
    symbol: id,
    closes,
    price24hAgo: json.o?.[0] ?? closes[0],
    high24h: Math.max(...highs),
    low24h: Math.min(...lows),
  };
}
