export type VenueId = "hyperliquid" | "bybit";

/**
 * Normalized, venue-qualified market identity. Carries ONLY fields a venue can
 * supply; sim-only fields (name, depthUsd, volFactor, volume24h) live on the
 * frontend's snapshot and are merged on there, never here. Every field below
 * also exists on the frontend's canonical `Market`, so the catalog reader merges
 * this DTO onto the snapshot without introducing a second competing shape.
 */
export interface Market {
  /** canonical venue-qualified id, e.g. "hyperliquid:BTC" */
  id: string;
  venue: VenueId;
  /** venue-native ticker, e.g. "BTC" */
  symbol: string;
  /** underlying base asset, e.g. "BTC" */
  base: string;
  /** UI pair label, e.g. "BTC-PERP" */
  displayName: string;
  /** size precision in coins; also drives display decimals */
  szDecimals: number;
  /** price increment; derives display decimals */
  tickSize: number;
  /** venue max leverage cap; effective = min(maxLeverage, tier cap) */
  maxLeverage: number;
  /** maker fee as a fraction */
  maker: number;
  /** taker fee as a fraction */
  taker: number;
  /** funding accrual interval in ms (HL 3_600_000; data only this phase) */
  fundingIntervalMs: number;
  isDelisted: boolean;
}

/**
 * One interface every venue implements. Adding a venue is a server-side
 * `new XAdapter()` swap — the dialect never reaches the frontend. Only
 * `listMarkets()` is implemented this phase; the live mark/funding stream
 * (`subscribeMarks`/`subscribeFunding`) lands in a later phase, so the interface
 * is intentionally minimal here.
 */
export interface VenueAdapter {
  readonly venue: VenueId;

  /** Catalog (Path A). The full perp universe, normalized, with delisted dropped. */
  listMarkets(): Promise<Market[]>;
}
