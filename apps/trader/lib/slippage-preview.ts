import type { Side, SlippagePreview, Symbol } from "@/lib/mock/types";

/** The house tilt, in basis points, ALWAYS applied against the trader. */
export const TILT_BPS = 2;

/**
 * Shadow-quote venue. On Sui, fills are modeled against the 7K Protocol
 * aggregator, which routes across these DEXes for the best execution a real
 * trader would get. (Solana/Jupiter lands in the Phase 4 port.)
 */
export const VENUE = "7K";
export const VENUE_ROUTE = ["Cetus", "Aftermath", "Turbos", "Kriya"];

/**
 * Per-symbol base liquidity depth in USD. Larger depth => less size-driven
 * slippage. These are fixed so the preview is fully deterministic and stable.
 */
const DEPTH_USD: Record<Symbol, number> = {
  BTC: 4_000_000,
  ETH: 2_000_000,
  SOL: 750_000,
};

export interface SlippagePreviewArgs {
  symbol: Symbol;
  side: Side;
  /** order notional in USD */
  sizeUsd: number;
  /** oracle mid price in USD */
  oracleMid: number;
}

/**
 * Deterministic slippage model. Size-driven slippage scales linearly with the
 * fraction of book depth consumed, capped, then the +2 bps house tilt is added.
 * The combined adjustment always worsens the trader's fill:
 *   - long  fills ABOVE mid (pays more)
 *   - short fills BELOW mid (receives less)
 *
 * Pure: same inputs always produce the same output. No clocks, no randomness.
 */
export function slippagePreview({
  symbol,
  side,
  sizeUsd,
  oracleMid,
}: SlippagePreviewArgs): SlippagePreview {
  const depth = DEPTH_USD[symbol];
  const size = Math.max(0, sizeUsd);

  // size-driven slippage: up to ~50 bps as size approaches book depth.
  const rawSlippageBps = (size / depth) * 5000;
  const slippageBps = Math.min(rawSlippageBps, 250);

  const tiltBps = TILT_BPS;
  const totalAdjBps = slippageBps + tiltBps;
  const adj = totalAdjBps / 10_000;

  const fill = side === "long" ? oracleMid * (1 + adj) : oracleMid * (1 - adj);

  const totalCost = (size / oracleMid) * fill;

  return {
    oracleMid,
    slippageBps,
    tiltBps,
    fill,
    totalCost,
    venue: VENUE,
    route: VENUE_ROUTE,
  };
}
