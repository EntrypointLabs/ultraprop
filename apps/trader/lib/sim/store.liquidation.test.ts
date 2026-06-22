import { beforeEach, describe, expect, it } from "vitest";
import { TIERS } from "@/lib/mock/fixtures";
import { getMarket } from "@/lib/mock/markets";
import type { Position, PriceTick } from "@/lib/mock/types";
import { liquidationPrice, maintenanceMargin, realizedOnClose } from "./engine";
import { useSimStore } from "./store";

/**
 * MAJ-1 regression: a position whose MARK crosses its liquidation price is
 * force-closed in `store.recompute` (the impure boundary — `engine.ts` stays
 * pure). The close books the realized loss + a taker fee into realizedTotal so
 * equity and the rules-based eval see it, emits a TradeRecord flagged
 * `liquidated`, and removes the position. detectOutcome is unchanged.
 *
 * Vector: SOL (maxLeverage 20 ⇒ l = 1/40 = 0.025), entry 100, sizeUsd 1000.
 */
const STARTER = TIERS[0];
const NOW = 1_749_312_000_000;
const SOL = "hyperliquid:SOL";
const ENTRY = 100;
const SIZE = 1000;

function makePosition(over: Partial<Position> = {}): Position {
  return {
    id: "pos_liq_test",
    symbol: SOL,
    side: "long",
    sizeUsd: SIZE,
    entryPrice: ENTRY,
    markPrice: ENTRY,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    openedAt: NOW,
    marginMode: "isolated",
    leverage: 5,
    entryFeeUsd: 0,
    lastFundedAt: NOW,
    fundingPaid: 0,
    liquidationPrice: null,
    marginRatio: null,
    ...over,
  };
}

/** A price tick that holds funding flat (rate 0) so only mark drives the test. */
function tickAt(markPx: number): PriceTick {
  return {
    symbol: SOL,
    markPx,
    oraclePx: markPx,
    midPx: markPx,
    fundingRate: 0,
    change24h: null,
    spark: [],
    high24h: null,
    low24h: null,
    ts: NOW,
  };
}

/** Seed a fresh non-demo vault with a single open position. */
function seedVaultWith(pos: Position): string {
  const vaultId = `vault_liq_${Math.random().toString(36).slice(2)}`;
  useSimStore.getState().startEvaluation(vaultId, STARTER, "0xowner", NOW);
  useSimStore.setState((s) => ({
    vaults: {
      ...s.vaults,
      [vaultId]: { ...s.vaults[vaultId], positions: [pos] },
    },
  }));
  return vaultId;
}

const maxLev = getMarket(SOL)?.maxLeverage ?? 20;
const maint = maintenanceMargin(SIZE, maxLev);

describe("recompute — liquidation force-close (MAJ-1)", () => {
  beforeEach(() => {
    useSimStore.setState({ vaults: {} });
  });

  it("(a) isolated long: mark at/below liq closes the position at ~liq with the loss booked", () => {
    const isolatedMargin = SIZE / 5;
    const liq = liquidationPrice({
      entryPrice: ENTRY,
      sizeUsd: SIZE,
      side: "long",
      maxLeverage: maxLev,
      marginMode: "isolated",
      isolatedMargin,
      accountValue: STARTER.shadowAllocation,
      maintMarginRequired: maint,
    });
    const liqRounded = Number(liq.toFixed(2));

    const vaultId = seedVaultWith(makePosition({ marginMode: "isolated" }));
    // Drive mark to exactly the liq price — the long liquidates and the fill is
    // the liq price (isolated liq is leverage-driven, unaffected by equity).
    useSimStore.getState().tick(vaultId, [tickAt(liqRounded)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(0);
    const liqTrade = v.trades[0];
    expect(liqTrade.liquidated).toBe(true);
    expect(liqTrade.fill).toBeCloseTo(liqRounded, 2);

    // Realized = close at liq − taker fee on the liq-price notional; equity
    // drops by that booked loss (the loss is large and negative).
    const expectedRealized = realizedOnClose(
      makePosition({ marginMode: "isolated" }),
      liqRounded,
    );
    expect(liqTrade.realizedPnl).toBeLessThan(0);
    expect(liqTrade.realizedPnl).toBeCloseTo(expectedRealized, 0);
    expect(v.realizedTotal).toBeCloseTo(liqTrade.realizedPnl, 2);
    expect(v.equity).toBeCloseTo(
      STARTER.shadowAllocation + liqTrade.realizedPnl,
      2,
    );
    // intentCount is NOT consumed by a forced liquidation.
    expect(v.intentCount).toBe(0);
  });

  it("(b) a position comfortably above liq is left untouched", () => {
    const vaultId = seedVaultWith(makePosition({ marginMode: "isolated" }));
    // Mark slightly below entry but well above the liq price → no liquidation.
    useSimStore.getState().tick(vaultId, [tickAt(ENTRY - 1)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(1);
    expect(v.trades.some((t) => t.liquidated)).toBe(false);
    expect(v.positions[0].liquidationPrice).not.toBeNull();
  });

  it("(c-iso) isolated short: mark at/above liq liquidates", () => {
    const isolatedMargin = SIZE / 5;
    const liq = liquidationPrice({
      entryPrice: ENTRY,
      sizeUsd: SIZE,
      side: "short",
      maxLeverage: maxLev,
      marginMode: "isolated",
      isolatedMargin,
      accountValue: STARTER.shadowAllocation,
      maintMarginRequired: maint,
    });
    const liqRounded = Number(liq.toFixed(2));

    const vaultId = seedVaultWith(
      makePosition({ side: "short", marginMode: "isolated" }),
    );
    useSimStore.getState().tick(vaultId, [tickAt(liqRounded + 1)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(0);
    expect(v.trades[0].liquidated).toBe(true);
    expect(v.trades[0].realizedPnl).toBeLessThan(0);
  });

  it("(c-cross) cross long: mark crossing the account-value liq liquidates", () => {
    // Cross liq is driven by account value, not set leverage. A position whose
    // notional dwarfs the account (here 100_000 vs 10_000 equity) has a
    // reachable, positive cross liq; compute it the way recompute does.
    const crossSize = 100_000;
    const crossMaint = maintenanceMargin(crossSize, maxLev);
    const liq = liquidationPrice({
      entryPrice: ENTRY,
      sizeUsd: crossSize,
      side: "long",
      maxLeverage: maxLev,
      marginMode: "cross",
      isolatedMargin: crossSize / 5,
      accountValue: STARTER.shadowAllocation,
      maintMarginRequired: crossMaint,
    });
    const liqRounded = Number(liq.toFixed(2));
    expect(liqRounded).toBeGreaterThan(0);

    const vaultId = seedVaultWith(
      makePosition({ marginMode: "cross", sizeUsd: crossSize }),
    );
    useSimStore.getState().tick(vaultId, [tickAt(liqRounded - 1)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(0);
    expect(v.trades[0].liquidated).toBe(true);
    expect(v.trades[0].realizedPnl).toBeLessThan(0);
    expect(v.realizedTotal).toBeCloseTo(v.trades[0].realizedPnl, 2);
  });

  it("(d) caps a runaway liquidation at the binding loss floor — never books more than the remaining budget", () => {
    // A 5x short whose mark gaps far past its liq would otherwise book a
    // catastrophic loss (entry 100 → mark 300 ≈ -$2000 on a $1000 position).
    // The firm force-settles at the binding floor instead: for a fresh starter
    // day that's the daily-loss floor (max(drawdown 9000, daily 9500) = 9500).
    const vaultId = seedVaultWith(
      makePosition({ side: "short", marginMode: "isolated" }),
    );
    useSimStore.getState().tick(vaultId, [tickAt(ENTRY * 3)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    const drawdownFloor =
      STARTER.shadowAllocation * (1 - STARTER.maxDrawdown);
    const dailyFloor =
      STARTER.shadowAllocation - STARTER.shadowAllocation * STARTER.dailyLoss;
    const lossFloor = Math.max(drawdownFloor, dailyFloor);

    expect(v.positions).toHaveLength(0);
    expect(v.trades[0].liquidated).toBe(true);
    // Equity floors at the binding floor — not the ~$8000 runaway.
    expect(v.equity).toBeCloseTo(lossFloor, 2);
    // realizedTotal and the trade's PnL reflect the capped loss, not the gap.
    expect(v.realizedTotal).toBeCloseTo(v.equity - STARTER.shadowAllocation, 2);
    expect(v.trades[0].realizedPnl).toBeGreaterThan(-600);
    // The capped loss still breaches a floor, so the eval fails.
    expect(v.status).toBe("failed");
  });

  it("does not double-count: realizedTotal moves by exactly the liq trade's realizedPnl", () => {
    const vaultId = seedVaultWith(makePosition({ marginMode: "isolated" }));
    const before = useSimStore.getState().vaults[vaultId].realizedTotal;
    useSimStore.getState().tick(vaultId, [tickAt(1)], NOW + 2000); // mark crashes
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.trades[0].liquidated).toBe(true);
    expect(v.realizedTotal).toBeCloseTo(before + v.trades[0].realizedPnl, 2);
  });
});
