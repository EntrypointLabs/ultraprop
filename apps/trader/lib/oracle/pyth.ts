import type { Symbol } from "@/lib/mock/types";

/**
 * Pyth price-feed IDs for the spot pairs the evaluation trades. These are the
 * canonical mainnet Crypto.<SYM>/USD feeds — the same oracle Sui settlement
 * reads, so the prices shown here are the prices a fill is marked against.
 */
export const PYTH_FEED_IDS: Record<Symbol, string> = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

/** TradingView symbol for each pair, served off the Pyth data source. */
export const PYTH_TV_SYMBOL: Record<Symbol, string> = {
  BTC: "PYTH:BTCUSD",
  ETH: "PYTH:ETHUSD",
  SOL: "PYTH:SOLUSD",
};

/** Pyth Benchmarks symbol used by the TradingView UDF history shim. */
const PYTH_BENCHMARK_SYMBOL: Record<Symbol, string> = {
  BTC: "Crypto.BTC/USD",
  ETH: "Crypto.ETH/USD",
  SOL: "Crypto.SOL/USD",
};

const HERMES = "https://hermes.pyth.network";
const BENCHMARKS = "https://benchmarks.pyth.network";

const ID_TO_SYMBOL = new Map<string, Symbol>(
  Object.entries(PYTH_FEED_IDS).map(([sym, id]) => [
    id.replace(/^0x/, "").toLowerCase(),
    sym as Symbol,
  ]),
);

export interface OraclePrice {
  symbol: Symbol;
  /** spot price in USD */
  price: number;
  /** epoch ms of the oracle publish time */
  publishTime: number;
}

export interface OracleHistory {
  symbol: Symbol;
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

/** Latest oracle spot for each requested symbol, in one Hermes request. */
export async function fetchLatestPrices(
  symbols: Symbol[],
  signal?: AbortSignal,
): Promise<OraclePrice[]> {
  const query = symbols
    .map((s) => `ids[]=${encodeURIComponent(PYTH_FEED_IDS[s])}`)
    .join("&");
  const res = await fetch(`${HERMES}/v2/updates/price/latest?${query}`, {
    signal,
  });
  if (!res.ok) throw new Error(`Hermes ${res.status}`);
  const json = (await res.json()) as { parsed: HermesParsed[] };
  const out: OraclePrice[] = [];
  for (const p of json.parsed ?? []) {
    const symbol = ID_TO_SYMBOL.get(p.id.toLowerCase());
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
  symbol: Symbol,
  nowSec: number,
  signal?: AbortSignal,
): Promise<OracleHistory | null> {
  const from = nowSec - 24 * 60 * 60;
  const url =
    `${BENCHMARKS}/v1/shims/tradingview/history` +
    `?symbol=${encodeURIComponent(PYTH_BENCHMARK_SYMBOL[symbol])}` +
    `&resolution=60&from=${from}&to=${nowSec}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Benchmarks ${res.status}`);
  const json = (await res.json()) as UdfHistory;
  if (json.s !== "ok" || !json.c || json.c.length === 0) return null;
  const closes = json.c;
  const highs = json.h ?? closes;
  const lows = json.l ?? closes;
  return {
    symbol,
    closes,
    price24hAgo: json.o?.[0] ?? closes[0],
    high24h: Math.max(...highs),
    low24h: Math.min(...lows),
  };
}
