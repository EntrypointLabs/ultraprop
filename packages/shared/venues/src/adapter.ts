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
 * One live tick for a single market. `fundingRate` rides along so a position can
 * read mark and funding off ONE tick (it is display/data-only — no accrual math
 * lives here). `midPx` drives fill pricing; `markPx` drives PnL/equity/liq.
 */
export interface MarkTick {
  /** venue-qualified id, e.g. "hyperliquid:BTC" */
  marketId: string;
  /** venue mark price — PnL / equity / liquidation. Never the fill price. */
  markPx: number;
  /** venue spot oracle price — funding notional basis. */
  oraclePx: number;
  /** venue mid — fill pricing (entry/exit); otherwise display-only. */
  midPx: number;
  /** current per-interval funding rate, carried through; no accrual here. */
  fundingRate: number;
  /** epoch ms of the next funding settlement, or 0 when unknown. */
  nextFundingTime: number;
  /** epoch ms this tick was stamped at the adapter edge (staleness clock). */
  ts: number;
}

/** Funding-only tick, for venues/phases that stream funding separately. */
export interface FundingTick {
  marketId: string;
  fundingRate: number;
  nextFundingTime: number;
  ts: number;
}

/** Base fee schedule for a market, as fractions (not bps). */
export interface FeeSchedule {
  maker: number;
  taker: number;
}

/** Pure data the sim needs to price a liquidation; no I/O. */
export interface LiquidationParams {
  /** maintenance margin as a fraction of notional. */
  maintenanceMarginFraction: number;
  marginMode: "cross" | "isolated";
}

/**
 * One interface every venue implements. Adding a venue is a server-side
 * `new XAdapter()` swap — the dialect never reaches the frontend. `listMarkets`
 * (catalog) and `subscribeMarks` (live feed) are implemented now; `subscribeFunding`
 * / `fees` / `liquidationParams` carry the ARCHITECTURE §(a) shape so Phase 4's
 * funding/fee/liquidation math is a server-side drop-in with no FE or DTO change.
 */
export interface VenueAdapter {
  readonly venue: VenueId;

  /** Catalog (Path A). The full perp universe, normalized, with delisted dropped. */
  listMarkets(): Promise<Market[]>;

  /**
   * Live marks (Path B). Pushes batched `MarkTick[]` to `onTick`; returns an
   * unsubscribe fn that tears down the underlying connection/poll.
   */
  subscribeMarks(onTick: (ticks: MarkTick[]) => void): () => void;

  /** Funding stream/poll (Path B/A hybrid). Returns an unsubscribe fn. */
  subscribeFunding(onTick: (ticks: FundingTick[]) => void): () => void;

  /** Base (VIP0) fee schedule for a market. The FE never sees user volume tiers. */
  fees(marketId: string): FeeSchedule;

  /** Liquidation params for the pure sim. */
  liquidationParams(marketId: string): LiquidationParams;
}
