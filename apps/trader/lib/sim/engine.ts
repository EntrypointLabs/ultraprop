import type {
  MarketId,
  Position,
  PriceTick,
  RuleBudget,
  RuleKind,
  Side,
  Tier,
  TradeRecord,
  VaultStatus,
} from "@/lib/mock/types";
import { slippagePreview } from "@/lib/slippage-preview";

/**
 * The notional paper-trading engine: pure, deterministic functions that price
 * fills, mark positions to market, compute equity, evaluate the tier rules, and
 * decide pass/breach. No clocks, no randomness, no I/O — every input is passed
 * in, so the same inputs always produce the same output. The impure boundary
 * (ids, timestamps, persistence) lives in `store.ts`; this module is the math.
 *
 * Drawdown is a STATIC floor off starting equity (not trailing off peak) — the
 * floor never moves, so the trader's allowable loss is fixed at evaluation open.
 */

const round2 = (n: number): number => Number(n.toFixed(2));

const dir = (side: Side): 1 | -1 => (side === "long" ? 1 : -1);

export interface FillResult {
  fill: number;
  slippageBps: number;
  /** venue taker fee in USD for this fill */
  feeUsd: number;
  venue: string;
}

/** Model the fill for an order via the shared slippage model (mid + size impact). */
export function applyFill(
  marketId: MarketId,
  side: Side,
  sizeUsd: number,
  oracleMid: number,
): FillResult {
  const p = slippagePreview({ marketId, side, sizeUsd, oracleMid });
  return {
    fill: p.fill,
    slippageBps: p.slippageBps,
    feeUsd: p.feeUsd,
    venue: p.venue,
  };
}

/**
 * The fill price to close a position. Closing a long means selling (short-side
 * fill, below mid); closing a short means buying (long-side fill, above mid).
 * Either way the trader crosses the spread again, so a round trip pays the
 * taker fee twice — a position can be underwater on fees alone. `closeUsd`
 * defaults to the whole position; a partial close prices slippage off the
 * smaller closed notional.
 */
export function closeFill(
  pos: Position,
  oracleMid: number,
  closeUsd: number = pos.sizeUsd,
): number {
  const exitSide: Side = pos.side === "long" ? "short" : "long";
  return slippagePreview({
    marketId: pos.symbol,
    side: exitSide,
    sizeUsd: closeUsd,
    oracleMid,
  }).fill;
}

/** HL caps funding at 4%/hour; clamp the per-settlement rate to ±0.04 first. */
const HL_FUNDING_RATE_CAP = 0.04;

export interface AccrueFundingArgs {
  sizeUsd: number;
  entryPrice: number;
  oraclePx: number;
  side: Side;
  fundingRate: number;
  /** count of settlement boundaries crossed while the position was open */
  settlementsElapsed: number;
}

/**
 * Signed funding USD over the settlements a position spanned (negative = the
 * trader pays). HL funds on the ORACLE-price notional, not mark, and a positive
 * rate makes longs pay shorts — so a long with a positive rate yields NEGATIVE
 * funding. Both differ on Bybit (mark notional), so the price choice and sign
 * convention are explicit here, not buried in the caller.
 */
export function accrueFunding({
  sizeUsd,
  entryPrice,
  oraclePx,
  side,
  fundingRate,
  settlementsElapsed,
}: AccrueFundingArgs): number {
  const rate = Math.max(
    -HL_FUNDING_RATE_CAP,
    Math.min(HL_FUNDING_RATE_CAP, fundingRate),
  );
  const baseSize = sizeUsd / entryPrice;
  // Longs pay on a positive rate, so the trader's cash flow is the NEGATIVE of
  // the side-signed oracle-notional funding.
  const perSettlement = -dir(side) * baseSize * oraclePx * rate;
  return round2(perSettlement * settlementsElapsed);
}

export interface LiquidationPriceArgs {
  entryPrice: number;
  sizeUsd: number;
  side: Side;
  /** per-market venue max leverage; sets the maintenance fraction */
  maxLeverage: number;
  marginMode: "isolated" | "cross";
  /** isolated margin allocated to THIS position (initial margin) */
  isolatedMargin: number;
  /** account-wide collateral value (cross margin availability) */
  accountValue: number;
  /** maintenance margin required, USD */
  maintMarginRequired: number;
}

/**
 * Liquidation price off MARK, verbatim from HL:
 *   liq = entry − side · marginAvailable / positionSize / (1 − l · side)
 * with l = mmFraction = 1/(2·maxLeverage) (MM is half the initial margin at max
 * leverage — NOT 1/leverage). Cross margin availability is account-wide, so the
 * cross liq price is INDEPENDENT of the leverage SET; isolated margin equals the
 * initial margin allocated, so the isolated liq price DEPENDS on leverage set.
 */
export function liquidationPrice({
  entryPrice,
  sizeUsd,
  side,
  maxLeverage,
  marginMode,
  isolatedMargin,
  accountValue,
  maintMarginRequired,
}: LiquidationPriceArgs): number {
  const l = 1 / (2 * maxLeverage);
  const sideSign = dir(side);
  const positionSize = sizeUsd / entryPrice;
  const marginAvailable =
    marginMode === "cross"
      ? accountValue - maintMarginRequired
      : isolatedMargin - maintMarginRequired;
  return (
    entryPrice -
    (sideSign * marginAvailable) / positionSize / (1 - l * sideSign)
  );
}

/** Maintenance margin in USD for a position: notional · mmFraction. */
export function maintenanceMargin(
  sizeUsd: number,
  maxLeverage: number,
): number {
  return sizeUsd * (1 / (2 * maxLeverage));
}

/** Unrealized PnL in USD for a position marked at `markPrice`. */
export function positionPnl(
  entryPrice: number,
  markPrice: number,
  sizeUsd: number,
  side: Side,
): number {
  const pnlPct = ((markPrice - entryPrice) / entryPrice) * dir(side);
  return round2(sizeUsd * pnlPct);
}

/** Re-mark every open position against the latest prices. Mirrors the original mock math. */
export function markPositions(
  positions: Position[],
  prices: PriceTick[],
): Position[] {
  return positions.map((pos) => {
    const tick = prices.find((p) => p.symbol === pos.symbol);
    // No live mark for this market -> leave the position as-is.
    if (!tick) return pos;
    const markPrice = tick.markPx;
    const pnlPct =
      ((markPrice - pos.entryPrice) / pos.entryPrice) * dir(pos.side);
    return {
      ...pos,
      markPrice,
      unrealizedPnl: round2(pos.sizeUsd * pnlPct),
      unrealizedPnlPct: round2(pnlPct * 100),
    };
  });
}

/**
 * Realized PnL in USD when a `closeUsd` slice of a position is closed at
 * `exitFill`. Defaults to the position's full `sizeUsd` (a whole close); pass a
 * smaller slice for a partial close. PnL is proportional to the closed notional,
 * so closing half realizes half the PnL.
 */
export function realizedOnClose(
  pos: Position,
  exitFill: number,
  closeUsd: number = pos.sizeUsd,
): number {
  const pnlPct = ((exitFill - pos.entryPrice) / pos.entryPrice) * dir(pos.side);
  return round2(closeUsd * pnlPct);
}

/**
 * Resolve how much of a position to close from a requested close amount, and
 * the size that remains. The request is clamped to (0, sizeUsd]; a request at
 * or above the full size closes the whole position (remainder 0). Positions are
 * INDEPENDENT — this only ever shrinks ONE position's `sizeUsd`; it never nets
 * or merges across positions.
 */
export function resolveCloseSize(
  pos: Position,
  closeUsd: number,
): { closeUsd: number; remainderUsd: number } {
  const requested = Math.min(Math.max(closeUsd, 0), pos.sizeUsd);
  const remainder = round2(pos.sizeUsd - requested);
  return { closeUsd: round2(requested), remainderUsd: remainder };
}

/** A bracket leg is armed only when its trigger is a finite, positive number. */
const isArmed = (price: number | null | undefined): price is number =>
  typeof price === "number" && Number.isFinite(price) && price > 0;

/**
 * Detect whether a position's take-profit or stop-loss has crossed on MARK
 * (never mid/last — consistent with PnL and liquidation). Long: TP when
 * `markPx >= takeProfit`, SL when `markPx <= stopLoss`; short is the inverse.
 * Only armed legs (finite, positive) are considered. If BOTH would trigger in
 * one call (a wide gap), the WORSE-for-trader leg (`sl`) wins so a gap-through
 * is never booked as a profitable exit. Pure: no clocks, no IO — expiry and the
 * close live in `store.recompute`.
 */
export function bracketTrigger(
  pos: Position,
  markPx: number,
): "tp" | "sl" | null {
  const tpArmed = isArmed(pos.takeProfit);
  const slArmed = isArmed(pos.stopLoss);
  const tpHit =
    tpArmed &&
    (pos.side === "long"
      ? markPx >= (pos.takeProfit as number)
      : markPx <= (pos.takeProfit as number));
  const slHit =
    slArmed &&
    (pos.side === "long"
      ? markPx <= (pos.stopLoss as number)
      : markPx >= (pos.stopLoss as number));
  if (slHit) return "sl";
  if (tpHit) return "tp";
  return null;
}

/** Notional equity = starting + booked realized + open unrealized. */
export function computeEquity(
  startingEquity: number,
  realizedTotal: number,
  openPositions: Position[],
): number {
  const unrealized = openPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  return round2(startingEquity + realizedTotal + unrealized);
}

export interface RuleInputs {
  startingEquity: number;
  equity: number;
  /** equity at the last 00:00 UTC reset — the baseline for the daily-loss rule */
  dailyAnchorEquity: number;
  tier: Tier;
  intentCount: number;
}

const zoneOf = (used: number): RuleBudget["zone"] =>
  used >= 0.9 ? "danger" : used >= 0.7 ? "warn" : "safe";

/**
 * The four tier rules as live budgets. Drawdown and daily-loss are STATIC off
 * starting equity; profit target and intent count unchanged. This is the single
 * canonical rule computation — `buildRuleBudgets` in the mock layer delegates
 * here so the engine and the UI never disagree.
 */
export function evaluateRules({
  startingEquity,
  equity,
  dailyAnchorEquity,
  tier,
  intentCount,
}: RuleInputs): RuleBudget[] {
  const ddFloor = startingEquity * (1 - tier.maxDrawdown);
  const ddLimit = startingEquity * tier.maxDrawdown;
  const ddUsed = Math.max(0, startingEquity - equity);
  const ddFrac = ddLimit > 0 ? Math.min(1, ddUsed / ddLimit) : 0;

  const dailyLimit = startingEquity * tier.dailyLoss;
  const dailyUsed = Math.max(0, dailyAnchorEquity - equity);
  const dailyFrac = dailyLimit > 0 ? Math.min(1, dailyUsed / dailyLimit) : 0;

  const targetEquity = startingEquity * (1 + tier.profitTarget);
  const targetGain = targetEquity - startingEquity;
  const gainSoFar = Math.max(0, equity - startingEquity);
  const targetFrac = targetGain > 0 ? Math.min(1, gainSoFar / targetGain) : 0;

  const intentFrac = Math.min(1, intentCount / tier.intentCap);

  return [
    {
      kind: "drawdown",
      label: "Max drawdown",
      current: round2(ddUsed),
      limit: round2(ddLimit),
      used: ddFrac,
      remaining: 1 - ddFrac,
      zone: zoneOf(ddFrac),
      unit: "usd",
      description: `Equity may not fall more than ${(tier.maxDrawdown * 100).toFixed(0)}% below starting equity. Floor is $${ddFloor.toFixed(0)}.`,
    },
    {
      kind: "dailyLoss",
      label: "Daily loss",
      current: round2(dailyUsed),
      limit: round2(dailyLimit),
      used: dailyFrac,
      remaining: 1 - dailyFrac,
      zone: zoneOf(dailyFrac),
      unit: "usd",
      description: `Daily loss may not exceed ${(tier.dailyLoss * 100).toFixed(0)}% of starting equity. Resets 00:00 UTC.`,
    },
    {
      kind: "profitTarget",
      label: "Profit target",
      current: round2(gainSoFar),
      limit: round2(targetGain),
      used: targetFrac,
      remaining: 1 - targetFrac,
      zone: targetFrac >= 1 ? "safe" : targetFrac >= 0.5 ? "warn" : "danger",
      unit: "usd",
      description: `Reach +${(tier.profitTarget * 100).toFixed(0)}% on starting equity to pass. Target equity is $${targetEquity.toFixed(0)}.`,
    },
    {
      kind: "intentCount",
      label: "Trades",
      current: intentCount,
      limit: tier.intentCap,
      used: intentFrac,
      remaining: 1 - intentFrac,
      zone: zoneOf(intentFrac),
      unit: "count",
      description: `Up to ${tier.intentCap} trades per evaluation.`,
    },
  ];
}

export interface Outcome {
  status: VaultStatus;
  violatedRule: RuleKind | null;
  triggerTrade: TradeRecord | null;
}

/**
 * Decide the evaluation outcome from the current rules. A drawdown or daily-loss
 * breach (`used >= 1`) fails the account and names the trade that tipped it over;
 * reaching the profit target passes it. Terminal accounts never re-transition —
 * once failed/passed, the loop is frozen.
 */
export function detectOutcome(
  status: VaultStatus,
  rules: RuleBudget[],
  lastTrade: TradeRecord | null,
): Outcome {
  if (status !== "active") {
    return { status, violatedRule: null, triggerTrade: null };
  }
  const used = (kind: RuleKind) =>
    rules.find((r) => r.kind === kind)?.used ?? 0;

  if (used("drawdown") >= 1) {
    return {
      status: "failed",
      violatedRule: "drawdown",
      triggerTrade: lastTrade,
    };
  }
  if (used("dailyLoss") >= 1) {
    return {
      status: "failed",
      violatedRule: "dailyLoss",
      triggerTrade: lastTrade,
    };
  }
  if (used("profitTarget") >= 1) {
    return { status: "passed", violatedRule: null, triggerTrade: null };
  }
  return { status: "active", violatedRule: null, triggerTrade: null };
}
