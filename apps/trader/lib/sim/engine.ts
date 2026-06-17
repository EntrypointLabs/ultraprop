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
  tiltBps: number;
  venue: string;
}

/** Model the fill for an order via the shared slippage model (mid + size slippage + house tilt). */
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
    tiltBps: p.tiltBps,
    venue: p.venue,
  };
}

/**
 * The fill price to close a position. Closing a long means selling (short-side
 * fill, below mid); closing a short means buying (long-side fill, above mid).
 * Either way the trader crosses the spread again, so a round trip pays the tilt
 * twice — a position can be underwater on fees alone.
 */
export function closeFill(pos: Position, oracleMid: number): number {
  const exitSide: Side = pos.side === "long" ? "short" : "long";
  return slippagePreview({
    marketId: pos.symbol,
    side: exitSide,
    sizeUsd: pos.sizeUsd,
    oracleMid,
  }).fill;
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
    // No live mark (missing or null oracle price) -> leave the position as-is.
    if (!tick || tick.price == null) return pos;
    const markPrice = tick.price;
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

/** Realized PnL in USD when a position is closed at `exitFill`. */
export function realizedOnClose(pos: Position, exitFill: number): number {
  const pnlPct = ((exitFill - pos.entryPrice) / pos.entryPrice) * dir(pos.side);
  return round2(pos.sizeUsd * pnlPct);
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
