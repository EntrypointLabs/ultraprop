import { beforeEach, describe, expect, it } from "vitest";
import { TIERS } from "@/lib/mock/fixtures";
import type { Position, PriceTick } from "@/lib/mock/types";
import { applyFees } from "@/lib/slippage-preview";
import { closeFill, realizedOnClose } from "./engine";
import { useSimStore } from "./store";

/**
 * MAJ-3: a position can be closed PARTIALLY. A partial close realizes PnL + a
 * taker fee proportional to the closed slice, folds it into realizedTotal, and
 * shrinks the SAME position's sizeUsd while preserving its id/side/leverage/
 * entry/marginMode. Positions are INDEPENDENT — a partial close never nets,
 * averages, or merges with any other position (incl. a same-symbol opposite).
 * A full/over close removes only that one position.
 *
 * Vector: SOL, entry 100, sizeUsd 1000, isolated, leverage 5.
 */
const STARTER = TIERS[0];
const NOW = 1_749_312_000_000;
const SOL = "hyperliquid:SOL";
const ENTRY = 100;
const SIZE = 1000;

function makePosition(over: Partial<Position> = {}): Position {
  return {
    id: "pos_pc_test",
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
    lastFundedAt: NOW,
    fundingPaid: 0,
    liquidationPrice: null,
    marginRatio: null,
    ...over,
  };
}

/** A flat tick (funding rate 0) so only the mark/mid drive the close math. */
function tickAt(px: number): PriceTick {
  return {
    symbol: SOL,
    markPx: px,
    oraclePx: px,
    midPx: px,
    fundingRate: 0,
    change24h: null,
    spark: [],
    high24h: null,
    low24h: null,
    ts: NOW,
  };
}

/** Seed a fresh non-demo vault with the given open positions. */
function seedVaultWith(positions: Position[]): string {
  const vaultId = `vault_pc_${Math.random().toString(36).slice(2)}`;
  useSimStore.getState().startEvaluation(vaultId, STARTER, "0xowner", NOW);
  useSimStore.setState((s) => ({
    vaults: {
      ...s.vaults,
      [vaultId]: { ...s.vaults[vaultId], positions },
    },
  }));
  return vaultId;
}

describe("closePosition — partial close (MAJ-3)", () => {
  beforeEach(() => {
    useSimStore.setState({ vaults: {} });
  });

  it("realizes proportional PnL + fee on the closed slice and reduces sizeUsd, keeping the same position", () => {
    const pos = makePosition();
    const vaultId = seedVaultWith([pos]);
    const mid = 110; // long in profit
    const closeUsd = SIZE * 0.25;

    const realizedBefore = useSimStore.getState().vaults[vaultId].realizedTotal;
    useSimStore
      .getState()
      .closePosition(vaultId, pos.id, [tickAt(mid)], NOW + 2000, closeUsd);
    const v = useSimStore.getState().vaults[vaultId];

    // The position survives, same identity, reduced size, untouched leverage.
    expect(v.positions).toHaveLength(1);
    const survivor = v.positions[0];
    expect(survivor.id).toBe(pos.id);
    expect(survivor.side).toBe("long");
    expect(survivor.leverage).toBe(5);
    expect(survivor.entryPrice).toBe(ENTRY);
    expect(survivor.marginMode).toBe("isolated");
    expect(survivor.sizeUsd).toBeCloseTo(SIZE - closeUsd, 2);

    // The booked realized = proportional PnL on the slice − a taker fee on the
    // closed exit notional. realizedTotal moves by exactly the close trade's
    // realizedPnl (no double counting; flat funding).
    const exitFill = closeFill(pos, mid, closeUsd);
    const expectedRealized = realizedOnClose(pos, exitFill, closeUsd);
    const expectedFee = applyFees((closeUsd / mid) * exitFill, "taker");
    const trade = v.trades[0];
    expect(trade.sizeUsd).toBeCloseTo(closeUsd, 2);
    expect(trade.realizedPnl).toBeCloseTo(expectedRealized - expectedFee, 2);
    expect(v.realizedTotal).toBeCloseTo(realizedBefore + trade.realizedPnl, 2);

    // Closing a quarter realizes ~a quarter of the full-size PnL (profit here).
    expect(trade.realizedPnl).toBeGreaterThan(0);
    const fullPnl = realizedOnClose(pos, closeFill(pos, mid), SIZE);
    expect(trade.realizedPnl).toBeLessThan(fullPnl);

    // recompute re-derives liq/margin on the remainder.
    expect(survivor.liquidationPrice).not.toBeNull();
  });

  it("leaves OTHER positions — including a same-symbol opposite-direction one — untouched", () => {
    const target = makePosition({ id: "pos_target", side: "long" });
    const sameSymbolShort = makePosition({
      id: "pos_other_short",
      side: "short",
      sizeUsd: 700,
      leverage: 3,
    });
    const vaultId = seedVaultWith([target, sameSymbolShort]);

    useSimStore
      .getState()
      .closePosition(vaultId, target.id, [tickAt(110)], NOW + 2000, SIZE * 0.5);
    const v = useSimStore.getState().vaults[vaultId];

    // Both positions still exist — the opposite-direction same-symbol position
    // was never netted, averaged, or merged.
    expect(v.positions).toHaveLength(2);
    const survivorTarget = v.positions.find((p) => p.id === "pos_target");
    const other = v.positions.find((p) => p.id === "pos_other_short");

    expect(survivorTarget?.sizeUsd).toBeCloseTo(SIZE * 0.5, 2);
    expect(survivorTarget?.side).toBe("long");

    // The untouched short keeps its size, side, and leverage exactly.
    expect(other?.sizeUsd).toBe(700);
    expect(other?.side).toBe("short");
    expect(other?.leverage).toBe(3);
  });

  it("a full close (no amount) removes only that position", () => {
    const a = makePosition({ id: "pos_a" });
    const b = makePosition({ id: "pos_b", side: "short", sizeUsd: 500 });
    const vaultId = seedVaultWith([a, b]);

    useSimStore
      .getState()
      .closePosition(vaultId, "pos_a", [tickAt(105)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(1);
    expect(v.positions[0].id).toBe("pos_b");
  });

  it("an over-close (amount ≥ sizeUsd) removes the position, like a full close", () => {
    const pos = makePosition();
    const vaultId = seedVaultWith([pos]);

    useSimStore
      .getState()
      .closePosition(vaultId, pos.id, [tickAt(105)], NOW + 2000, SIZE * 10);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(0);
    expect(v.trades[0].sizeUsd).toBeCloseTo(SIZE, 2);
  });

  it("each partial close consumes one intent (it is a trade)", () => {
    const pos = makePosition();
    const vaultId = seedVaultWith([pos]);
    const before = useSimStore.getState().vaults[vaultId].intentCount;

    useSimStore
      .getState()
      .closePosition(vaultId, pos.id, [tickAt(108)], NOW + 2000, SIZE * 0.25);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.intentCount).toBe(before + 1);
  });
});
