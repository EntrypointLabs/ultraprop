"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEMO_EQUITY_CURVE,
  DEMO_POSITIONS,
  DEMO_TRADES,
  DEMO_VAULT_ID,
} from "@/lib/mock/fixtures";
import { getMarket } from "@/lib/mock/markets";
import type {
  EquityPoint,
  MarketId,
  Position,
  PriceTick,
  RuleBudget,
  RuleKind,
  Side,
  Tier,
  TradeRecord,
  VaultState,
  VaultStatus,
} from "@/lib/mock/types";
import { applyFees } from "@/lib/slippage-preview";
import {
  accrueFunding,
  applyFill,
  bracketTrigger,
  closeFill,
  computeEquity,
  detectOutcome,
  evaluateRules,
  liquidationPrice,
  maintenanceMargin,
  markPositions,
  realizedOnClose,
  resolveCloseSize,
} from "./engine";

const DAY_MS = 86_400_000;
const MAX_CURVE_POINTS = 192;

/** Authoritative per-attempt simulation state. Source of truth for the UI caches. */
export interface SimVault {
  vaultId: string;
  tier: Tier;
  owner: string;
  status: VaultStatus;
  startingEquity: number;
  equity: number;
  peakEquity: number;
  /** booked realized PnL from closed positions */
  realizedTotal: number;
  positions: Position[];
  trades: TradeRecord[];
  rules: RuleBudget[];
  intentCount: number;
  /** equity at the last 00:00 UTC reset — baseline for the daily-loss rule */
  dailyAnchorEquity: number;
  dailyResetAt: number;
  inactiveAt: number;
  startedAt: number;
  triggerTrade: TradeRecord | null;
  violatedRule: RuleKind | null;
  equityCurve: EquityPoint[];
}

export interface OrderIntent {
  symbol: MarketId;
  side: Side;
  sizeUsd: number;
  marginMode: "isolated" | "cross";
  /** leverage SET for the position; rejected if above the effective cap */
  leverage: number;
  /** optional TP trigger (mark-crossing) to ARM on the new position at open */
  takeProfit?: number | null;
  /** optional SL trigger (mark-crossing) to ARM on the new position at open */
  stopLoss?: number | null;
}

interface SimStore {
  vaults: Record<string, SimVault>;
  hydrated: boolean;
  setHydrated: () => void;
  startEvaluation: (
    vaultId: string,
    tier: Tier,
    owner: string,
    nowMs: number,
  ) => void;
  submitOrder: (
    vaultId: string,
    intent: OrderIntent,
    prices: PriceTick[],
    nowMs: number,
  ) => void;
  closePosition: (
    vaultId: string,
    positionId: string,
    prices: PriceTick[],
    nowMs: number,
    /** USD slice to close; omitted/≥ sizeUsd closes the whole position */
    closeUsd?: number,
  ) => void;
  /**
   * Arm/edit a position's TP/SL bracket. Only the named legs change — an
   * unspecified leg is left as-is; pass `null` to CLEAR a leg. `expiresAt` sets
   * (or clears, with null) the bracket's cancel-not-fire deadline. No-ops on a
   * missing/closed position; never touches any other position.
   */
  setBracket: (
    vaultId: string,
    positionId: string,
    bracket: {
      takeProfit?: number | null;
      stopLoss?: number | null;
      expiresAt?: number | null;
    },
  ) => void;
  /**
   * Cancel a position's bracket. `leg` clears just that leg ("tp" or "sl");
   * omitting it clears both legs and the expiry. No-ops on a missing/closed
   * position; never touches any other position.
   */
  cancelBracket: (
    vaultId: string,
    positionId: string,
    leg?: "tp" | "sl",
  ) => void;
  tick: (vaultId: string, prices: PriceTick[], nowMs: number) => void;
  resetEvaluation: (vaultId: string) => void;
  pauseEvaluation: (vaultId: string, nowMs: number) => void;
  resumeEvaluation: (vaultId: string, nowMs: number) => void;
}

/** Next 00:00 UTC strictly after `nowMs`. */
function nextUtcMidnight(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS) * DAY_MS + DAY_MS;
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** A plausible Sui-style digest for the trade record's "View on Sui Explorer". */
function mockDigest(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += BASE58[b % BASE58.length];
  return out;
}

const oracleMidFor = (prices: PriceTick[], symbol: MarketId): number | null =>
  prices.find((p) => p.symbol === symbol)?.midPx ?? null;

/**
 * Settle discrete funding for one open position. Funding is charged only on the
 * settlement boundaries CROSSED while the position was open — a position opened
 * and closed inside one interval pays zero, and an hour-long hold across N
 * boundaries pays N times. Returns the position with `lastFundedAt`/`fundingPaid`
 * advanced and the signed funding cash flow booked this recompute.
 */
function settleFunding(
  pos: Position,
  prices: PriceTick[],
  nowMs: number,
): { pos: Position; funding: number } {
  const tick = prices.find((p) => p.symbol === pos.symbol);
  const market = getMarket(pos.symbol);
  const interval = market?.fundingIntervalMs ?? 0;
  if (!tick || interval <= 0) return { pos, funding: 0 };

  // Boundaries are interval multiples; count those strictly after lastFundedAt
  // and at or before now.
  const lastBoundary = Math.floor(nowMs / interval) * interval;
  const fundedThrough = Math.floor(pos.lastFundedAt / interval) * interval;
  const settlementsElapsed = Math.max(
    0,
    Math.round((lastBoundary - fundedThrough) / interval),
  );
  if (settlementsElapsed === 0) return { pos, funding: 0 };

  const funding = accrueFunding({
    sizeUsd: pos.sizeUsd,
    entryPrice: pos.entryPrice,
    oraclePx: tick.oraclePx,
    side: pos.side,
    fundingRate: tick.fundingRate,
    settlementsElapsed,
  });
  return {
    pos: {
      ...pos,
      lastFundedAt: lastBoundary,
      fundingPaid: Number((pos.fundingPaid + funding).toFixed(2)),
    },
    funding,
  };
}

/**
 * Attach the estimated liquidation price + margin ratio off mark to each open
 * position. Cross availability is account-wide equity less the summed
 * maintenance margin; isolated is the position's own allocated initial margin.
 */
function attachLiquidation(
  positions: Position[],
  equity: number,
  summedMaint: number,
): Position[] {
  return positions.map((pos) => {
    const market = getMarket(pos.symbol);
    if (!market) return pos;
    const maint = maintenanceMargin(pos.sizeUsd, market.maxLeverage);
    const isolatedMargin = pos.leverage > 0 ? pos.sizeUsd / pos.leverage : 0;
    const liq = liquidationPrice({
      entryPrice: pos.entryPrice,
      sizeUsd: pos.sizeUsd,
      side: pos.side,
      maxLeverage: market.maxLeverage,
      marginMode: pos.marginMode,
      isolatedMargin,
      accountValue: equity,
      maintMarginRequired: pos.marginMode === "cross" ? summedMaint : maint,
    });
    const collateral = pos.marginMode === "cross" ? equity : isolatedMargin;
    return {
      ...pos,
      liquidationPrice: Number(liq.toFixed(2)),
      marginRatio:
        collateral > 0 ? Number((maint / collateral).toFixed(4)) : null,
    };
  });
}

/** A position is liquidated when its MARK crosses its (finite, positive) liq. */
function isLiquidated(pos: Position): boolean {
  const liq = pos.liquidationPrice;
  if (liq == null || !Number.isFinite(liq) || liq <= 0) return false;
  return pos.side === "long" ? pos.markPrice <= liq : pos.markPrice >= liq;
}

interface LiquidationResult {
  survivors: Position[];
  trades: TradeRecord[];
  realizedTotal: number;
}

/**
 * Force-close every position whose mark has crossed its liquidation price. The
 * close is booked AT the liq price through the same realized path as a manual
 * close (realizedOnClose + a taker fee on the liq-price notional); the realized
 * loss folds into realizedTotal so equity and the rules see it. Each close emits
 * a TradeRecord flagged `liquidated`. Survivors are returned untouched.
 */
function closeLiquidations(
  positions: Position[],
  realizedTotal: number,
  nowMs: number,
): LiquidationResult {
  const survivors: Position[] = [];
  const trades: TradeRecord[] = [];
  let running = realizedTotal;

  for (const pos of positions) {
    if (!isLiquidated(pos)) {
      survivors.push(pos);
      continue;
    }
    const liqPrice = pos.liquidationPrice as number;
    // Close AT the liq price, but never on a fill better than the current mark:
    // if mark already gapped past liq, the forced sell/buy fills at mark, not
    // back at the favorable liq price — a liquidation must never book a profit.
    const exitFill =
      pos.side === "long"
        ? Math.min(liqPrice, pos.markPrice)
        : Math.max(liqPrice, pos.markPrice);
    const realized = realizedOnClose(pos, exitFill);
    // Taker fee on the exit notional at the fill — a round trip pays taker
    // twice, and a forced close is still a taker fill.
    const exitNotional = (pos.sizeUsd / pos.entryPrice) * exitFill;
    const exitFee = applyFees(exitNotional, "taker");
    running = Number((running + realized - exitFee).toFixed(2));
    trades.push({
      id: `trd_${crypto.randomUUID()}`,
      symbol: pos.symbol,
      side: pos.side,
      sizeUsd: pos.sizeUsd,
      oracleMid: pos.markPrice,
      fill: exitFill,
      slippageBps: 0,
      feeUsd: exitFee,
      venue: "hyperliquid",
      realizedPnl: Number((realized - exitFee).toFixed(2)),
      ts: nowMs,
      txDigest: mockDigest(),
      liquidated: true,
      closedBy: "liquidation",
    });
  }

  return { survivors, trades, realizedTotal: running };
}

interface BracketResult {
  survivors: Position[];
  trades: TradeRecord[];
  realizedTotal: number;
}

/**
 * Per-tick take-profit / stop-loss firing — the user-set sibling of
 * `closeLiquidations`. For each open position: an armed bracket past its
 * `bracketExpiresAt` is CANCELLED (legs cleared, position kept) and never fired;
 * otherwise if its MARK has crossed a leg (`engine.bracketTrigger`) the WHOLE
 * position is force-closed AT the trigger price through the same realized path as
 * a manual close (`realizedOnClose` + a taker fee on the trigger notional), the
 * net folds into `realizedTotal`, and a `TradeRecord` flagged `closedBy: tp|sl`
 * is emitted. OCO is implicit — closing the position drops both legs at once, so
 * there is never a double-close or an orphan leg. Positions stay INDEPENDENT:
 * only the position that crossed is touched; every survivor (including a
 * same-symbol opposite-direction position) is returned untouched, with any
 * expiry-cleared bracket reflected.
 */
function fireBrackets(
  positions: Position[],
  realizedTotal: number,
  nowMs: number,
): BracketResult {
  const survivors: Position[] = [];
  const trades: TradeRecord[] = [];
  let running = realizedTotal;

  for (const pos of positions) {
    // Expiry is checked BEFORE firing: a bracket past its expiry is cancelled,
    // not fired, even if the mark has crossed it this tick.
    const expired =
      pos.bracketExpiresAt != null &&
      Number.isFinite(pos.bracketExpiresAt) &&
      nowMs > pos.bracketExpiresAt;
    if (expired) {
      survivors.push({
        ...pos,
        takeProfit: null,
        stopLoss: null,
        bracketExpiresAt: null,
      });
      continue;
    }

    const leg = bracketTrigger(pos, pos.markPrice);
    if (leg === null) {
      survivors.push(pos);
      continue;
    }

    // Close AT the trigger price (the resting bracket fills at its set level).
    const triggerPrice = (
      leg === "tp" ? pos.takeProfit : pos.stopLoss
    ) as number;
    const realized = realizedOnClose(pos, triggerPrice);
    // Taker fee on the exit notional at the trigger — a round trip pays taker
    // twice, and a bracket fill is still a taker fill.
    const exitNotional = (pos.sizeUsd / pos.entryPrice) * triggerPrice;
    const exitFee = applyFees(exitNotional, "taker");
    running = Number((running + realized - exitFee).toFixed(2));
    trades.push({
      id: `trd_${crypto.randomUUID()}`,
      symbol: pos.symbol,
      side: pos.side,
      sizeUsd: pos.sizeUsd,
      oracleMid: pos.markPrice,
      fill: triggerPrice,
      slippageBps: 0,
      feeUsd: exitFee,
      venue: "hyperliquid",
      realizedPnl: Number((realized - exitFee).toFixed(2)),
      ts: nowMs,
      txDigest: mockDigest(),
      closedBy: leg,
    });
  }

  return { survivors, trades, realizedTotal: running };
}

/**
 * Re-mark, re-price equity, re-evaluate the rules, and decide the outcome.
 * `lastTrade` is the trade blamed if this recompute trips a breach.
 */
function recompute(v: SimVault, prices: PriceTick[], nowMs: number): SimVault {
  let dailyAnchorEquity = v.dailyAnchorEquity;
  let dailyResetAt = v.dailyResetAt;
  if (nowMs >= dailyResetAt) {
    dailyAnchorEquity = v.equity;
    dailyResetAt = nextUtcMidnight(nowMs);
  }

  // Discrete funding settles into booked realized PnL before marking.
  let fundingBooked = 0;
  const fundedPositions = v.positions.map((pos) => {
    const { pos: next, funding } = settleFunding(pos, prices, nowMs);
    fundingBooked += funding;
    return next;
  });
  const realizedTotal = Number((v.realizedTotal + fundingBooked).toFixed(2));

  const marked = markPositions(fundedPositions, prices);
  const equity = computeEquity(v.startingEquity, realizedTotal, marked);
  const peakEquity = Math.max(v.peakEquity, equity);

  // Attach liquidation price + margin ratio off mark per open position. Cross
  // availability is account-wide equity less the summed maintenance margin;
  // isolated is the position's own allocated margin.
  const summedMaint = marked.reduce(
    (sum, p) =>
      sum + maintenanceMargin(p.sizeUsd, getMarket(p.symbol)?.maxLeverage ?? 1),
    0,
  );
  const withLiq = attachLiquidation(marked, equity, summedMaint);

  // Force-close any position whose MARK has crossed its liquidation price (long:
  // mark ≤ liq; short: mark ≥ liq). The close goes through the same realized
  // path as a manual close (realizedOnClose + taker fee), AT the liq price, and
  // is booked into realizedTotal so equity/rules see the loss. detectOutcome is
  // unchanged — the rules-based eval stays the pass/fail authority.
  const liqClose = closeLiquidations(withLiq, realizedTotal, nowMs);
  const positions = liqClose.survivors;
  const trades = liqClose.trades.length
    ? [...liqClose.trades, ...v.trades]
    : v.trades;

  // Liquidations changed booked realized + open notional, so re-price equity
  // from the survivors and re-attach their liq prices off the new account value.
  const finalRealizedTotal = liqClose.realizedTotal;
  const finalEquity = liqClose.trades.length
    ? computeEquity(v.startingEquity, finalRealizedTotal, positions)
    : equity;
  const finalPeak = Math.max(peakEquity, finalEquity);
  const finalSummedMaint = positions.reduce(
    (sum, p) =>
      sum + maintenanceMargin(p.sizeUsd, getMarket(p.symbol)?.maxLeverage ?? 1),
    0,
  );
  const finalPositions = liqClose.trades.length
    ? attachLiquidation(positions, finalEquity, finalSummedMaint)
    : positions;

  // Fire take-profit / stop-loss on the liquidation SURVIVORS. PRECEDENCE is
  // liquidation > SL > TP: a liquidated position is already closed above (so it
  // can never also fire a bracket — no double-close), and within a single tick
  // bracketTrigger returns the worse-for-trader leg (`sl`) over `tp`. The close
  // is booked AT the trigger price (+ taker fee), folded into realizedTotal, and
  // OCO is implicit — closing the position removes both legs. Expired brackets
  // are cancelled here (not fired); survivors keep their (possibly cleared)
  // brackets. detectOutcome is unchanged — the rules-based eval stays authority.
  const brkClose = fireBrackets(finalPositions, finalRealizedTotal, nowMs);
  const closedPositions = brkClose.survivors;
  const allTrades = brkClose.trades.length
    ? [...brkClose.trades, ...trades]
    : trades;
  const closedRealizedTotal = brkClose.realizedTotal;
  const closedEquity = brkClose.trades.length
    ? computeEquity(v.startingEquity, closedRealizedTotal, closedPositions)
    : finalEquity;
  const closedPeak = Math.max(finalPeak, closedEquity);
  const closedSummedMaint = closedPositions.reduce(
    (sum, p) =>
      sum + maintenanceMargin(p.sizeUsd, getMarket(p.symbol)?.maxLeverage ?? 1),
    0,
  );
  const settledPositions = brkClose.trades.length
    ? attachLiquidation(closedPositions, closedEquity, closedSummedMaint)
    : closedPositions;

  const rules = evaluateRules({
    startingEquity: v.startingEquity,
    equity: closedEquity,
    dailyAnchorEquity,
    tier: v.tier,
    intentCount: v.intentCount,
  });
  // The trade blamed for a breach is the most recent — a forced close (bracket
  // or liquidation) booked this recompute, else the last existing trade.
  const lastTrade = allTrades.length ? allTrades[0] : null;
  const outcome = detectOutcome(v.status, rules, lastTrade);

  // The equity chart maps timestamps to whole seconds, so two ticks within the
  // same second must COALESCE to one point (replace the last) — otherwise the
  // curve carries duplicate second-timestamps and lightweight-charts refuses to
  // render the series (asc-ordered-unique-time assertion → blank chart).
  const lastPoint = v.equityCurve[v.equityCurve.length - 1];
  const sameSecond =
    lastPoint && Math.floor(lastPoint.ts / 1000) === Math.floor(nowMs / 1000);
  const equityCurve = sameSecond
    ? [...v.equityCurve.slice(0, -1), { ts: nowMs, equity: closedEquity }]
    : [
        ...v.equityCurve.slice(-(MAX_CURVE_POINTS - 1)),
        { ts: nowMs, equity: closedEquity },
      ];

  return {
    ...v,
    positions: settledPositions,
    trades: allTrades,
    realizedTotal: closedRealizedTotal,
    equity: closedEquity,
    peakEquity: closedPeak,
    dailyAnchorEquity,
    dailyResetAt,
    rules,
    status: outcome.status,
    violatedRule: outcome.violatedRule,
    triggerTrade: outcome.triggerTrade,
    equityCurve,
  };
}

function freshVault(
  vaultId: string,
  tier: Tier,
  owner: string,
  nowMs: number,
): SimVault {
  const startingEquity = tier.shadowAllocation;
  const base: SimVault = {
    vaultId,
    tier,
    owner,
    status: "active",
    startingEquity,
    equity: startingEquity,
    peakEquity: startingEquity,
    realizedTotal: 0,
    positions: [],
    trades: [],
    rules: [],
    intentCount: 0,
    dailyAnchorEquity: startingEquity,
    dailyResetAt: nextUtcMidnight(nowMs),
    inactiveAt: nowMs + 7 * DAY_MS,
    startedAt: nowMs,
    triggerTrade: null,
    violatedRule: null,
    equityCurve: [{ ts: nowMs, equity: startingEquity }],
  };
  return recompute(base, [], nowMs);
}

/**
 * The first-load demo vault — pre-populated from the seeded fixtures so a guest
 * lands on a populated cockpit (open positions, trade history, equity curve)
 * rather than an empty one. `realizedTotal` is the sum of each seed trade's
 * booked realized PnL minus its fee, so equity = starting + realized + open
 * unrealized stays internally consistent once `recompute` re-marks to market.
 * Only created when the demo vault does not already exist in the persisted
 * store — a returning visitor keeps the vault they actually traded.
 */
function seededDemoVault(
  vaultId: string,
  tier: Tier,
  owner: string,
  nowMs: number,
): SimVault {
  const realizedTotal = Number(
    DEMO_TRADES.reduce((sum, t) => sum + t.realizedPnl - t.feeUsd, 0).toFixed(
      2,
    ),
  );
  const startingEquity = tier.shadowAllocation;
  const base: SimVault = {
    vaultId,
    tier,
    owner,
    status: "active",
    startingEquity,
    equity: startingEquity,
    peakEquity: startingEquity,
    realizedTotal,
    positions: DEMO_POSITIONS,
    trades: DEMO_TRADES,
    rules: [],
    intentCount: DEMO_TRADES.length,
    dailyAnchorEquity: startingEquity,
    dailyResetAt: nextUtcMidnight(nowMs),
    inactiveAt: nowMs + 7 * DAY_MS,
    startedAt: nowMs,
    triggerTrade: null,
    violatedRule: null,
    equityCurve: DEMO_EQUITY_CURVE,
  };
  return recompute(base, [], nowMs);
}

/** The demo vault is the one seeded, guest-tradeable evaluation. */
function buildVault(
  vaultId: string,
  tier: Tier,
  owner: string,
  nowMs: number,
): SimVault {
  return vaultId === DEMO_VAULT_ID
    ? seededDemoVault(vaultId, tier, owner, nowMs)
    : freshVault(vaultId, tier, owner, nowMs);
}

export const useSimStore = create<SimStore>()(
  persist(
    (set, get) => ({
      vaults: {},
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),

      startEvaluation: (vaultId, tier, owner, nowMs) => {
        if (get().vaults[vaultId]) return; // idempotent — never reset a live eval
        set((s) => ({
          vaults: {
            ...s.vaults,
            [vaultId]: buildVault(vaultId, tier, owner, nowMs),
          },
        }));
      },

      resetEvaluation: (vaultId) =>
        set((s) => {
          const v = s.vaults[vaultId];
          if (!v) return s;
          // Date is read at the impure boundary only.
          const fresh = freshVault(vaultId, v.tier, v.owner, Date.now());
          return { vaults: { ...s.vaults, [vaultId]: fresh } };
        }),

      // Manual pause: only an active eval can be paused. Flips status to
      // "inactive" and stamps inactiveAt; the cockpit routes to /inactive on
      // this status change. detectOutcome never produces "inactive", so this is
      // the sole path that reaches the idle terminal screen.
      pauseEvaluation: (vaultId, nowMs) =>
        set((s) => {
          const v = s.vaults[vaultId];
          if (!v || v.status !== "active") return s;
          return {
            vaults: {
              ...s.vaults,
              [vaultId]: { ...v, status: "inactive", inactiveAt: nowMs },
            },
          };
        }),

      // Resume reactivates a paused eval — status back to "active", the idle
      // window pushed out 7 days, and the rules re-evaluated off current state.
      // Only an inactive vault resumes; a passed/failed vault stays terminal.
      resumeEvaluation: (vaultId, nowMs) =>
        set((s) => {
          const v = s.vaults[vaultId];
          if (!v || v.status !== "inactive") return s;
          const reactivated = recompute(
            { ...v, status: "active", inactiveAt: nowMs + 7 * DAY_MS },
            [],
            nowMs,
          );
          return { vaults: { ...s.vaults, [vaultId]: reactivated } };
        }),

      submitOrder: (vaultId, intent, prices, nowMs) =>
        set((s) => {
          const v = s.vaults[vaultId];
          if (!v || v.status !== "active") return s;
          const oracleMid = oracleMidFor(prices, intent.symbol);
          if (oracleMid == null || intent.sizeUsd <= 0) return s;
          // Reject leverage above the effective cap (market max clamped to tier).
          const market = getMarket(intent.symbol);
          const effectiveCap = Math.min(
            market?.maxLeverage ?? v.tier.leverage,
            v.tier.leverage,
          );
          if (intent.leverage > effectiveCap || intent.leverage <= 0) return s;
          // Free-margin gate: the order's initial margin can't exceed the
          // collateral not already committed to open positions. usedMargin is
          // the summed initial margin of open positions; freeMargin is equity
          // less that; reject when this order needs more than is free.
          const usedMargin = v.positions.reduce(
            (sum, p) => sum + (p.leverage > 0 ? p.sizeUsd / p.leverage : 0),
            0,
          );
          const freeMargin = v.equity - usedMargin;
          const requiredMargin = intent.sizeUsd / intent.leverage;
          if (requiredMargin > freeMargin) return s;
          // onlyIsolated markets force isolated regardless of the request.
          const marginMode = market?.onlyIsolated
            ? "isolated"
            : intent.marginMode;

          const f = applyFill(
            intent.symbol,
            intent.side,
            intent.sizeUsd,
            oracleMid,
          );
          const position: Position = {
            id: `pos_${crypto.randomUUID()}`,
            symbol: intent.symbol,
            side: intent.side,
            sizeUsd: intent.sizeUsd,
            entryPrice: f.fill,
            markPrice: oracleMid,
            unrealizedPnl: 0,
            unrealizedPnlPct: 0,
            openedAt: nowMs,
            marginMode,
            leverage: intent.leverage,
            // No funding charged for the interval the position opened in until a
            // boundary is crossed; seed the watermark at the open.
            lastFundedAt: nowMs,
            fundingPaid: 0,
            liquidationPrice: null,
            marginRatio: null,
            // Arm the bracket AT open from the intent (omit ⇒ no leg). The next
            // recompute's fireBrackets owns firing/OCO/precedence — no trigger
            // logic is duplicated here.
            takeProfit: intent.takeProfit ?? null,
            stopLoss: intent.stopLoss ?? null,
          };
          const trade: TradeRecord = {
            id: `trd_${crypto.randomUUID()}`,
            symbol: intent.symbol,
            side: intent.side,
            sizeUsd: intent.sizeUsd,
            oracleMid,
            fill: f.fill,
            slippageBps: f.slippageBps,
            feeUsd: f.feeUsd,
            venue: f.venue,
            realizedPnl: 0,
            ts: nowMs,
            txDigest: mockDigest(),
          };
          // The taker fee is a realized cost booked at fill.
          const next = recompute(
            {
              ...v,
              positions: [position, ...v.positions],
              trades: [trade, ...v.trades],
              realizedTotal: Number((v.realizedTotal - f.feeUsd).toFixed(2)),
              intentCount: v.intentCount + 1,
              inactiveAt: nowMs + 7 * DAY_MS,
            },
            prices,
            nowMs,
          );
          return { vaults: { ...s.vaults, [vaultId]: next } };
        }),

      // Close a position, fully or PARTIALLY. A partial close realizes PnL + a
      // taker fee proportional to the CLOSED slice, folds it into realizedTotal,
      // and shrinks the SAME position's sizeUsd — its id/side/leverage/entry/
      // marginMode are preserved and recompute re-derives liq/margin on the
      // remainder. A close ≥ the full size removes the position. Positions stay
      // INDEPENDENT: only the targeted position is ever touched.
      closePosition: (vaultId, positionId, prices, nowMs, closeUsd) =>
        set((s) => {
          const v = s.vaults[vaultId];
          if (!v || v.status !== "active") return s;
          const pos = v.positions.find((p) => p.id === positionId);
          if (!pos) return s;
          const oracleMid = oracleMidFor(prices, pos.symbol);
          if (oracleMid == null) return s;

          const { closeUsd: closedUsd, remainderUsd } = resolveCloseSize(
            pos,
            closeUsd ?? pos.sizeUsd,
          );
          if (closedUsd <= 0) return s;

          const exitFill = closeFill(pos, oracleMid, closedUsd);
          const realized = realizedOnClose(pos, exitFill, closedUsd);
          // Taker fee on the CLOSED exit notional — a round trip pays taker twice.
          const exitNotional = (closedUsd / oracleMid) * exitFill;
          const exitFee = applyFees(exitNotional, "taker");
          const trade: TradeRecord = {
            id: `trd_${crypto.randomUUID()}`,
            symbol: pos.symbol,
            side: pos.side,
            sizeUsd: closedUsd,
            oracleMid,
            fill: exitFill,
            slippageBps: 0,
            feeUsd: exitFee,
            venue: "hyperliquid",
            realizedPnl: Number((realized - exitFee).toFixed(2)),
            ts: nowMs,
            txDigest: mockDigest(),
          };
          // Full close removes the position; partial shrinks the same position's
          // sizeUsd, keeping every other field (id/side/leverage/entry/mode).
          const positions =
            remainderUsd <= 0
              ? v.positions.filter((p) => p.id !== positionId)
              : v.positions.map((p) =>
                  p.id === positionId ? { ...p, sizeUsd: remainderUsd } : p,
                );
          const next = recompute(
            {
              ...v,
              positions,
              trades: [trade, ...v.trades],
              realizedTotal: Number(
                (v.realizedTotal + realized - exitFee).toFixed(2),
              ),
              intentCount: v.intentCount + 1,
              inactiveAt: nowMs + 7 * DAY_MS,
            },
            prices,
            nowMs,
          );
          return { vaults: { ...s.vaults, [vaultId]: next } };
        }),

      // Arm/edit one position's bracket. A bracket is a resting trigger, so this
      // is a pure state edit — it does NOT carry prices/nowMs and does NOT fire
      // here even if the position is already crossed; the next tick (which the
      // engine drives on every price update) evaluates and fires it through
      // recompute. Only the named legs change; `undefined` leaves a leg as-is,
      // `null` clears it. Positions stay INDEPENDENT — only the target is touched.
      setBracket: (vaultId, positionId, bracket) =>
        set((s) => {
          const v = s.vaults[vaultId];
          if (!v || v.status !== "active") return s;
          if (!v.positions.some((p) => p.id === positionId)) return s;
          const positions = v.positions.map((p) =>
            p.id === positionId
              ? {
                  ...p,
                  ...("takeProfit" in bracket
                    ? { takeProfit: bracket.takeProfit }
                    : {}),
                  ...("stopLoss" in bracket
                    ? { stopLoss: bracket.stopLoss }
                    : {}),
                  ...("expiresAt" in bracket
                    ? { bracketExpiresAt: bracket.expiresAt }
                    : {}),
                }
              : p,
          );
          return {
            vaults: { ...s.vaults, [vaultId]: { ...v, positions } },
          };
        }),

      // Cancel one position's bracket — a single leg ("tp"/"sl") or, when no leg
      // is given, both legs and the expiry. No-ops on a missing/closed position;
      // never touches any other position.
      cancelBracket: (vaultId, positionId, leg) =>
        set((s) => {
          const v = s.vaults[vaultId];
          if (!v || v.status !== "active") return s;
          if (!v.positions.some((p) => p.id === positionId)) return s;
          const positions = v.positions.map((p) => {
            if (p.id !== positionId) return p;
            if (leg === "tp") return { ...p, takeProfit: null };
            if (leg === "sl") return { ...p, stopLoss: null };
            return {
              ...p,
              takeProfit: null,
              stopLoss: null,
              bracketExpiresAt: null,
            };
          });
          return {
            vaults: { ...s.vaults, [vaultId]: { ...v, positions } },
          };
        }),

      tick: (vaultId, prices, nowMs) =>
        set((s) => {
          const v = s.vaults[vaultId];
          if (!v || v.status !== "active") return s; // freeze when terminal
          return {
            vaults: { ...s.vaults, [vaultId]: recompute(v, prices, nowMs) },
          };
        }),
    }),
    {
      name: "trader-sim-store",
      partialize: (s) => ({ vaults: s.vaults }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

/** Project the sim record into the `VaultState` shape the UI hooks expect. */
export function toVaultState(v: SimVault): VaultState {
  return {
    vaultId: v.vaultId,
    tier: v.tier,
    status: v.status,
    owner: v.owner,
    startingEquity: v.startingEquity,
    equity: v.equity,
    peakEquity: v.peakEquity,
    positions: v.positions,
    rules: v.rules,
    dailyResetAt: v.dailyResetAt,
    inactiveAt: v.inactiveAt,
    startedAt: v.startedAt,
    triggerTrade: v.triggerTrade,
    violatedRule: v.violatedRule,
    intentCount: v.intentCount,
  };
}
