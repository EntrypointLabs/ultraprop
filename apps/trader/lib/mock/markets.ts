/**
 * The market catalog. Identity is a venue-qualified string `MarketId`
 * ("hyperliquid:BTC"); every former per-symbol map (book depth, leverage cap)
 * is a field on `Market`, read via `getMarket`.
 *
 * The catalog is LIVE but indexer-fronted: the full Hyperliquid perp universe is
 * served by our own `/api/catalog` route (which calls Hyperliquid server-side),
 * fetched client-side via `useMarketCatalog`, and pushed in via `setLiveCatalog`.
 * The browser never touches Hyperliquid directly. A small static `SEED_CATALOG`
 * (BTC/ETH/SOL) backs SSR and first client paint so server and first render stay
 * identical — the live universe only replaces it post-hydration, via the catalog
 * query, so there is no hydration mismatch. The many synchronous `getMarket(id)`
 * / `decimalsFor` call sites keep working because they resolve against
 * `liveCatalog ?? SEED_CATALOG`.
 *
 * This is the ONE canonical FE `Market` shape. Venue-derived fields (id, venue,
 * symbol, base, displayName, szDecimals, tickSize, maxLeverage, maker, taker,
 * fundingIntervalMs, isDelisted) come from the live `@shared/venues` catalog;
 * sim-only fields (name, depthUsd, volFactor, volume24h) keep their snapshot
 * defaults. `useMarketCatalog` merges live onto snapshot to produce this type.
 */

import type { Market as VenueMarket, VenueId } from "@shared/venues";

/** Market identity — venue-qualified, e.g. "hyperliquid:BTC". */
export type MarketId = string;

/**
 * The single FE market record. Extends the `@shared/venues` venue DTO with the
 * sim-only fields the venue does not supply (name, depthUsd, volFactor,
 * volume24h), so the live DTO merges onto a snapshot to produce this shape.
 */
export interface Market extends VenueMarket {
  /** human name; HL exposes only the ticker, so this mirrors it (sim-only) */
  name: string;
  /** book depth in USD used by slippagePreview (HL gives none; sim-only) */
  depthUsd: number;
  /** sim volatility multiplier (sim-only) */
  volFactor: number;
  /** 24h notional volume in USD shown in tables (sim-only) */
  volume24h: number;
}

/** Sim-only defaults for a live market that has no snapshot match. */
export const DEFAULT_SIM_FIELDS: {
  depthUsd: number;
  volFactor: number;
  volume24h: number;
} = {
  depthUsd: 1_000_000,
  volFactor: 1,
  volume24h: 0,
};

/**
 * Static seed: BTC/ETH/SOL with their real HL `maxLeverage` (40/25/20) and
 * `szDecimals`. Backs SSR and the first client render until the live HL
 * universe arrives. No clocks, no `Math.random` at module scope, so server and
 * first client render are identical. Ids are venue-qualified.
 */
export const SEED_CATALOG: Market[] = [
  {
    id: "hyperliquid:BTC",
    venue: "hyperliquid",
    symbol: "BTC",
    base: "BTC",
    displayName: "BTC-PERP",
    name: "BTC",
    szDecimals: 5,
    tickSize: 10 ** -(6 - 5),
    maxLeverage: 40,
    maker: 0.00015,
    taker: 0.00045,
    fundingIntervalMs: 3_600_000,
    isDelisted: false,
    depthUsd: 4_000_000,
    volFactor: 1,
    volume24h: 0,
  },
  {
    id: "hyperliquid:ETH",
    venue: "hyperliquid",
    symbol: "ETH",
    base: "ETH",
    displayName: "ETH-PERP",
    name: "ETH",
    szDecimals: 4,
    tickSize: 10 ** -(6 - 4),
    maxLeverage: 25,
    maker: 0.00015,
    taker: 0.00045,
    fundingIntervalMs: 3_600_000,
    isDelisted: false,
    depthUsd: 2_000_000,
    volFactor: 1,
    volume24h: 0,
  },
  {
    id: "hyperliquid:SOL",
    venue: "hyperliquid",
    symbol: "SOL",
    base: "SOL",
    displayName: "SOL-PERP",
    name: "SOL",
    szDecimals: 2,
    tickSize: 10 ** -(6 - 2),
    maxLeverage: 20,
    maker: 0.00015,
    taker: 0.00045,
    fundingIntervalMs: 3_600_000,
    isDelisted: false,
    depthUsd: 750_000,
    volFactor: 1,
    volume24h: 0,
  },
];

/**
 * The live HL universe once fetched. Null on the server and before the catalog
 * query resolves; `getMarket`/the catalog readers fall back to `SEED_CATALOG`
 * until it lands. Set CLIENT-SIDE by the catalog query on success.
 */
let liveCatalog: Market[] | null = null;

/** Publish the live HL universe. Called by `useMarketCatalog` on success. */
export function setLiveCatalog(markets: Market[]): void {
  liveCatalog = markets.length > 0 ? markets : null;
}

/** The active catalog: the live HL universe if present, else the static seed. */
export function getCatalog(): Market[] {
  return liveCatalog ?? SEED_CATALOG;
}

/** Every market id in the active catalog. */
export const MARKET_IDS: MarketId[] = SEED_CATALOG.map((m) => m.id);

/** The default market the cockpit/trade form open on. */
export const DEFAULT_MARKET_ID: MarketId = "hyperliquid:BTC";

/** Resolve a market by its id against the live catalog (or the seed). */
export function getMarket(id: MarketId): Market | undefined {
  return getCatalog().find((m) => m.id === id);
}

/** The bare venue ticker for a market id, e.g. "hyperliquid:BTC" → "BTC". */
export function coinOf(id: MarketId): string {
  return id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
}

/**
 * Display decimals for a market, derived from `szDecimals` (HL has no tick
 * size). Start from HL's price-precision rule `6 - szDecimals`, then clamp so a
 * formatted price never shows more than 5 significant figures.
 */
export function decimalsFor(market: Market | undefined, price?: number): number {
  if (!market) return 2;
  const base = Math.max(0, 6 - market.szDecimals);
  if (price == null || !Number.isFinite(price) || price <= 0) return base;
  const intDigits = Math.max(1, Math.floor(Math.log10(price)) + 1);
  const maxFractionForFiveSig = Math.max(0, 5 - intDigits);
  return Math.min(base, maxFractionForFiveSig);
}

export type { VenueId };
