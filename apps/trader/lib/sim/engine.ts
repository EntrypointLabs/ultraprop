import { getMarket } from "@/lib/mock/markets";
import type { MarketId, Position, Side } from "@/lib/mock/types";
import {
  applyFill as applyFillCore,
  closeFill as closeFillCore,
  type FillResult,
} from "@shared/sim-core";

/**
 * The paper-trading engine math lives in `@shared/sim-core` — pure, deterministic,
 * and shared verbatim with the executor service so the live overlay and the
 * authoritative on-chain settlement never disagree on a number. This module is
 * the app's thin adapter: it re-exports the pure functions and overrides the two
 * fill helpers to inject THIS app's per-market catalog book depth, so every call
 * site keeps the same signature it had before the extraction.
 */

export {
  accrueFunding,
  bracketTrigger,
  computeEquity,
  detectOutcome,
  evaluateRules,
  liquidationPrice,
  maintenanceMargin,
  markPositions,
  positionPnl,
  realizedOnClose,
  resolveCloseSize,
} from "@shared/sim-core";
export type {
  AccrueFundingArgs,
  FillResult,
  LiquidationPriceArgs,
  Outcome,
  RuleInputs,
} from "@shared/sim-core";

/** Model a fill via the shared slippage model with this market's catalog depth. */
export function applyFill(
  marketId: MarketId,
  side: Side,
  sizeUsd: number,
  oracleMid: number,
): FillResult {
  return applyFillCore(
    marketId,
    side,
    sizeUsd,
    oracleMid,
    getMarket(marketId)?.depthUsd,
  );
}

/** The fill price to close a position, with this market's catalog depth injected. */
export function closeFill(
  pos: Position,
  oracleMid: number,
  closeUsd: number = pos.sizeUsd,
): number {
  return closeFillCore(pos, oracleMid, closeUsd, getMarket(pos.symbol)?.depthUsd);
}
