import { getMarket } from "@/lib/mock/markets";
import type { MarketId, Side, SlippagePreview } from "@/lib/mock/types";

/**
 * Hyperliquid base (VIP0) fee schedule, in basis points. Market orders pay
 * taker; resting limit orders pay maker. Base rates only — live VIP/volume tiers
 * are not modeled. TODO: confirm against the live HL fee endpoint.
 */
export const HL_TAKER_BPS = 4.5;
export const HL_MAKER_BPS = 1.5;

/** Fallback book depth for any market without a catalog `depthUsd`. */
const DEFAULT_DEPTH_USD = 1_000_000;

/**
 * Venue fee in USD for a fill of `notionalUsd`. Compute on the VENUE notional
 * recomputed from the rounded fill size, not the raw requested USD. A round trip
 * (open + close) pays taker twice.
 */
export function applyFees(
  notionalUsd: number,
  kind: "taker" | "maker" = "taker",
): number {
  const bps = kind === "taker" ? HL_TAKER_BPS : HL_MAKER_BPS;
  return notionalUsd * (bps / 10_000);
}

export interface SlippagePreviewArgs {
  marketId: MarketId;
  side: Side;
  /** order notional in USD */
  sizeUsd: number;
  /** oracle mid price in USD */
  oracleMid: number;
}

/**
 * Deterministic slippage model. Size-driven slippage scales linearly with the
 * fraction of book depth consumed, then capped. The adjustment always worsens
 * the trader's fill:
 *   - long  fills ABOVE mid (pays more)
 *   - short fills BELOW mid (receives less)
 *
 * Pure: same inputs always produce the same output. No clocks, no randomness.
 * The size-driven impact stands in for the venue's `impactPxs`; the venue's
 * taker fee is reported separately as `feeUsd` (see `applyFees`).
 */
export function slippagePreview({
  marketId,
  side,
  sizeUsd,
  oracleMid,
}: SlippagePreviewArgs): SlippagePreview {
  const depth = getMarket(marketId)?.depthUsd ?? DEFAULT_DEPTH_USD;
  const size = Math.max(0, sizeUsd);

  // size-driven slippage: up to ~50 bps as size approaches book depth.
  const rawSlippageBps = (size / depth) * 5000;
  const slippageBps = Math.min(rawSlippageBps, 250);

  const adj = slippageBps / 10_000;

  const fill = side === "long" ? oracleMid * (1 + adj) : oracleMid * (1 - adj);

  // Notional recomputed from the executed size at the worse fill (PITFALLS C5).
  const totalCost = (size / oracleMid) * fill;
  const feeUsd = applyFees(totalCost, "taker");

  return {
    oracleMid,
    slippageBps,
    fill,
    totalCost,
    feeUsd,
    venue: "hyperliquid",
  };
}
