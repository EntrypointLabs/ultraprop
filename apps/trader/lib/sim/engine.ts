import {
  applyFill as applyFillCore,
  closeFill as closeFillCore,
  type FillResult,
} from "@shared/sim-core";
import { getMarket } from "@/lib/mock/markets";
import type { MarketId, Position, Side } from "@/lib/mock/types";

/**
 * The paper-trading engine math lives in `@shared/sim-core` — pure, deterministic,
 * and shared verbatim with the executor service so the live overlay and the
 * authoritative on-chain settlement never disagree on a number. This module is
 * the app's thin adapter: it re-exports the pure functions and overrides the two
 * fill helpers to inject THIS app's per-market catalog book depth, so every call
 * site keeps the same signature it had before the extraction.
 */

export type {
  AccrueFundingArgs,
  FillResult,
  LiquidationPriceArgs,
  Outcome,
  RuleInputs,
} from "@shared/sim-core";
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
  return closeFillCore(
    pos,
    oracleMid,
    closeUsd,
    getMarket(pos.symbol)?.depthUsd,
  );
}

/**
 * Tighten a venue liquidation price by the firm's remaining drawdown budget. The
 * evaluation fails (and the position is settled) the instant cumulative loss hits
 * the max-drawdown or daily-loss floor, so a position can never actually run all
 * the way to the venue liquidation when that sits beyond the floor — the firm
 * would lose more than the rules allow. The effective stop is whichever price is
 * reached FIRST as the market moves against the position: the highest candidate
 * for a long (price falling), the lowest for a short (price rising).
 *
 * `drawdownBudgetUsd` / `dailyLossBudgetUsd` are the USD still losable before each
 * floor (rule `limit - current`); pass `null` for a floor that doesn't apply.
 */
export function drawdownCappedLiquidation({
  venueLiquidation,
  entryPrice,
  sizeUsd,
  side,
  drawdownBudgetUsd,
  dailyLossBudgetUsd,
}: {
  venueLiquidation: number;
  entryPrice: number;
  sizeUsd: number;
  side: Side;
  drawdownBudgetUsd: number | null;
  dailyLossBudgetUsd: number | null;
}): number {
  if (!(entryPrice > 0) || !(sizeUsd > 0)) return venueLiquidation;
  // Price at which this position's loss exhausts `budget`: loss = (notional /
  // entry) × |Δ|, so Δ = budget × entry / notional.
  const priceForBudget = (budget: number): number => {
    const move = (Math.max(0, budget) / sizeUsd) * entryPrice;
    return side === "long" ? entryPrice - move : entryPrice + move;
  };
  const candidates = [venueLiquidation];
  if (drawdownBudgetUsd != null)
    candidates.push(priceForBudget(drawdownBudgetUsd));
  if (dailyLossBudgetUsd != null)
    candidates.push(priceForBudget(dailyLossBudgetUsd));
  const valid = candidates.filter((p) => Number.isFinite(p) && p > 0);
  if (valid.length === 0) return venueLiquidation;
  return side === "long" ? Math.max(...valid) : Math.min(...valid);
}
