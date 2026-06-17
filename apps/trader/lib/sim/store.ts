"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
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
  closeFill,
  computeEquity,
  detectOutcome,
  evaluateRules,
  liquidationPrice,
  maintenanceMargin,
  markPositions,
  realizedOnClose,
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
  ) => void;
  tick: (vaultId: string, prices: PriceTick[], nowMs: number) => void;
  resetEvaluation: (vaultId: string) => void;
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
  const positions = marked.map((pos) => {
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
  const rules = evaluateRules({
    startingEquity: v.startingEquity,
    equity,
    dailyAnchorEquity,
    tier: v.tier,
    intentCount: v.intentCount,
  });
  const lastTrade = v.trades.length ? v.trades[v.trades.length - 1] : null;
  const outcome = detectOutcome(v.status, rules, lastTrade);

  const lastPoint = v.equityCurve[v.equityCurve.length - 1];
  const equityCurve =
    lastPoint && lastPoint.ts === nowMs
      ? v.equityCurve
      : [
          ...v.equityCurve.slice(-(MAX_CURVE_POINTS - 1)),
          { ts: nowMs, equity },
        ];

  return {
    ...v,
    positions,
    realizedTotal,
    equity,
    peakEquity,
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
            [vaultId]: freshVault(vaultId, tier, owner, nowMs),
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

      closePosition: (vaultId, positionId, prices, nowMs) =>
        set((s) => {
          const v = s.vaults[vaultId];
          if (!v || v.status !== "active") return s;
          const pos = v.positions.find((p) => p.id === positionId);
          if (!pos) return s;
          const oracleMid = oracleMidFor(prices, pos.symbol);
          if (oracleMid == null) return s;

          const exitFill = closeFill(pos, oracleMid);
          const realized = realizedOnClose(pos, exitFill);
          // Taker fee on the exit notional — a round trip pays taker twice.
          const exitNotional = (pos.sizeUsd / oracleMid) * exitFill;
          const exitFee = applyFees(exitNotional, "taker");
          const trade: TradeRecord = {
            id: `trd_${crypto.randomUUID()}`,
            symbol: pos.symbol,
            side: pos.side,
            sizeUsd: pos.sizeUsd,
            oracleMid,
            fill: exitFill,
            slippageBps: 0,
            feeUsd: exitFee,
            venue: "hyperliquid",
            realizedPnl: Number((realized - exitFee).toFixed(2)),
            ts: nowMs,
            txDigest: mockDigest(),
          };
          const next = recompute(
            {
              ...v,
              positions: v.positions.filter((p) => p.id !== positionId),
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
