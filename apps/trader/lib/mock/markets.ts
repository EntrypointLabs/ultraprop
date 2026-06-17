/**
 * The static market catalog: the open, data-driven replacement for the old
 * closed three-symbol union. Market identity is a string `MarketId` resolved
 * through `MARKET_CATALOG`, and every former per-symbol exhaustive map
 * (book depth, Pyth feed id, TradingView/benchmark symbols) is now a field on
 * `Market`, read via `getMarket`.
 *
 * `MarketId` is the venue ticker ("BTC"/"ETH"/"SOL") so the live Pyth lookups
 * keyed on ticker stay stable. The catalog holds only the markets that have a
 * real Pyth feed; prices themselves are live and nullable (see `PriceTick`), so
 * there are no seeded prices or volatility factors here. The list is a hand-
 * seeded snapshot — no clocks, no `Math.random` at module scope — so server and
 * first client render stay identical.
 */

/** Market identity — the venue ticker, e.g. "BTC". */
export type MarketId = string;

export interface Market {
  /** canonical id (the ticker), e.g. "BTC" */
  id: MarketId;
  /** venue-native ticker, e.g. "BTC" */
  symbol: string;
  /** underlying base asset, e.g. "BTC" */
  base: string;
  /** UI pair label, e.g. "BTC-PERP" */
  displayName: string;
  /** human name, e.g. "Bitcoin" */
  name: string;
  /** size precision in coins */
  szDecimals: number;
  /** price increment; drives display decimals (replaces the price>100 heuristic) */
  tickSize: number;
  /** venue max leverage cap (real per-market cap, carried as data) */
  maxLeverage: number;
  /** book depth in USD used by slippagePreview (replaces DEPTH_USD) */
  depthUsd: number;
  /** Pyth Hermes price-feed id for the Crypto.<SYM>/USD mainnet feed */
  pythFeedId: string;
  /** TradingView symbol served off the Pyth data source, e.g. "PYTH:BTCUSD" */
  pythTvSymbol: string;
  /** Pyth Benchmarks symbol for the TradingView UDF history shim */
  pythBenchmarkSymbol: string;
}

/**
 * Static market snapshot. Only the markets that have a real Pyth oracle feed
 * (BTC/ETH/SOL). The depth, feed id, TV symbol and benchmark symbol are the
 * exact values the codebase used before, folded out of their per-symbol maps.
 * `maxLeverage` uses real per-market venue caps (not the legacy flat 10).
 */
export const MARKET_CATALOG: Market[] = [
  {
    id: "BTC",
    symbol: "BTC",
    base: "BTC",
    displayName: "BTC-PERP",
    name: "Bitcoin",
    szDecimals: 5,
    tickSize: 0.5,
    maxLeverage: 40,
    depthUsd: 4_000_000,
    pythFeedId:
      "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    pythTvSymbol: "PYTH:BTCUSD",
    pythBenchmarkSymbol: "Crypto.BTC/USD",
  },
  {
    id: "ETH",
    symbol: "ETH",
    base: "ETH",
    displayName: "ETH-PERP",
    name: "Ethereum",
    szDecimals: 4,
    tickSize: 0.01,
    maxLeverage: 25,
    depthUsd: 2_000_000,
    pythFeedId:
      "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    pythTvSymbol: "PYTH:ETHUSD",
    pythBenchmarkSymbol: "Crypto.ETH/USD",
  },
  {
    id: "SOL",
    symbol: "SOL",
    base: "SOL",
    displayName: "SOL-PERP",
    name: "Solana",
    szDecimals: 2,
    tickSize: 0.001,
    maxLeverage: 20,
    depthUsd: 750_000,
    pythFeedId:
      "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    pythTvSymbol: "PYTH:SOLUSD",
    pythBenchmarkSymbol: "Crypto.SOL/USD",
  },
];

/** Every market id, in catalog order. For code that needs the ticker list. */
export const MARKET_IDS: MarketId[] = MARKET_CATALOG.map((m) => m.id);

/** The default market the cockpit/trade form open on. */
export const DEFAULT_MARKET_ID: MarketId = MARKET_CATALOG[0].id;

/** Resolve a market by its id. Returns undefined for unknown ids. */
export function getMarket(id: MarketId): Market | undefined {
  return MARKET_CATALOG.find((m) => m.id === id);
}

/**
 * Display decimals for a market, derived from its `tickSize`. Replaces every
 * `price > 100 ? … : …` magnitude heuristic so low-priced perps format
 * correctly. A 0.5 tick resolves to 1 decimal; exact powers of ten
 * (0.01 -> 2, 0.001 -> 3) are unaffected.
 */
export function decimalsFor(market: Market | undefined): number {
  if (!market || market.tickSize <= 0) return 2;
  return Math.max(0, Math.ceil(-Math.log10(market.tickSize)));
}
