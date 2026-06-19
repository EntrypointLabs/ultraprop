import { beforeEach, describe, expect, it } from "vitest";
import { TIERS } from "@/lib/mock/fixtures";
import type { Position, PriceTick } from "@/lib/mock/types";
import { applyFees } from "@/lib/slippage-preview";
import { bracketTrigger, realizedOnClose } from "./engine";
import { useSimStore } from "./store";

/**
 * Per-position TP/SL brackets. `bracketTrigger` is the PURE detector (mark-cross,
 * SL wins a same-call double-trigger); `store.recompute`'s `fireBrackets` is the
 * impure boundary that force-closes the WHOLE position at the trigger price + a
 * taker fee, books it, emits a TradeRecord with `closedBy: tp|sl`, applies OCO
 * (close removes both legs), cancels (never fires) an expired bracket, and keeps
 * the liquidation > SL > TP precedence. Positions stay INDEPENDENT — only the
 * position that crossed is ever touched.
 *
 * Vector: SOL (maxLeverage 20), entry 100, sizeUsd 1000, leverage 1 so the liq
 * price sits near 0 and never interferes with the bracket levels under test.
 */
const STARTER = TIERS[0];
const NOW = 1_749_312_000_000;
const SOL = "hyperliquid:SOL";
const ENTRY = 100;
const SIZE = 1000;

function makePosition(over: Partial<Position> = {}): Position {
  return {
    id: "pos_brk_test",
    symbol: SOL,
    side: "long",
    sizeUsd: SIZE,
    entryPrice: ENTRY,
    markPrice: ENTRY,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    openedAt: NOW,
    marginMode: "isolated",
    leverage: 1,
    entryFeeUsd: 0,
    lastFundedAt: NOW,
    fundingPaid: 0,
    liquidationPrice: null,
    marginRatio: null,
    ...over,
  };
}

/** A price tick that holds funding flat (rate 0) so only mark drives the test. */
function tickAt(markPx: number, midPx: number = markPx): PriceTick {
  return {
    symbol: SOL,
    markPx,
    oraclePx: markPx,
    midPx,
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
  const vaultId = `vault_brk_${Math.random().toString(36).slice(2)}`;
  useSimStore.getState().startEvaluation(vaultId, STARTER, "0xowner", NOW);
  useSimStore.setState((s) => ({
    vaults: {
      ...s.vaults,
      [vaultId]: { ...s.vaults[vaultId], positions },
    },
  }));
  return vaultId;
}

/** Realized PnL net of taker fee for a full close at `triggerPrice`. */
function expectedNetRealized(pos: Position, triggerPrice: number): number {
  const realized = realizedOnClose(pos, triggerPrice);
  const exitNotional = (pos.sizeUsd / pos.entryPrice) * triggerPrice;
  const exitFee = applyFees(exitNotional, "taker");
  return Number((realized - exitFee).toFixed(2));
}

describe("engine.bracketTrigger — pure mark-cross detection", () => {
  it("long TP fires when markPx >= takeProfit", () => {
    const pos = makePosition({ takeProfit: 110 });
    expect(bracketTrigger(pos, 109.99)).toBeNull();
    expect(bracketTrigger(pos, 110)).toBe("tp");
    expect(bracketTrigger(pos, 120)).toBe("tp");
  });

  it("long SL fires when markPx <= stopLoss", () => {
    const pos = makePosition({ stopLoss: 90 });
    expect(bracketTrigger(pos, 90.01)).toBeNull();
    expect(bracketTrigger(pos, 90)).toBe("sl");
    expect(bracketTrigger(pos, 80)).toBe("sl");
  });

  it("short TP/SL are the inverse of long", () => {
    const tpShort = makePosition({ side: "short", takeProfit: 90 });
    expect(bracketTrigger(tpShort, 90.01)).toBeNull();
    expect(bracketTrigger(tpShort, 90)).toBe("tp");

    const slShort = makePosition({ side: "short", stopLoss: 110 });
    expect(bracketTrigger(slShort, 109.99)).toBeNull();
    expect(bracketTrigger(slShort, 110)).toBe("sl");
  });

  it("only finite, positive legs are armed (null/0/NaN ignored)", () => {
    expect(bracketTrigger(makePosition({ takeProfit: null }), 999)).toBeNull();
    expect(bracketTrigger(makePosition({ stopLoss: 0 }), 0)).toBeNull();
    expect(
      bracketTrigger(makePosition({ takeProfit: Number.NaN }), 999),
    ).toBeNull();
  });

  it("SL wins a same-call double-trigger (worse-for-trader on a gap)", () => {
    // A wide downward gap on a long with both legs: TP (110) is technically not
    // crossed at a low mark, but to prove precedence set TP below SL so both
    // would cross at mark 50 — SL must win.
    const pos = makePosition({ takeProfit: 40, stopLoss: 90 });
    expect(bracketTrigger(pos, 50)).toBe("sl");
  });
});

describe("recompute — fireBrackets force-close (TP/SL)", () => {
  beforeEach(() => {
    useSimStore.setState({ vaults: {} });
  });

  it("(a) long TP fires at markPx>=tp, full close at trigger + taker fee", () => {
    const pos = makePosition({ takeProfit: 110 });
    const vaultId = seedVaultWith([pos]);
    useSimStore.getState().tick(vaultId, [tickAt(110)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(0);
    const trade = v.trades[0];
    expect(trade.closedBy).toBe("tp");
    expect(trade.fill).toBeCloseTo(110, 2);
    expect(trade.sizeUsd).toBe(SIZE);
    const net = expectedNetRealized(pos, 110);
    expect(trade.realizedPnl).toBeCloseTo(net, 2);
    expect(trade.realizedPnl).toBeGreaterThan(0);
    expect(v.realizedTotal).toBeCloseTo(net, 2);
    expect(v.equity).toBeCloseTo(STARTER.shadowAllocation + net, 2);
    // A bracket fire is NOT a submitted intent.
    expect(v.intentCount).toBe(0);
  });

  it("(b) long SL fires at markPx<=sl with the loss booked", () => {
    const pos = makePosition({ stopLoss: 90 });
    const vaultId = seedVaultWith([pos]);
    useSimStore.getState().tick(vaultId, [tickAt(90)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(0);
    expect(v.trades[0].closedBy).toBe("sl");
    expect(v.trades[0].fill).toBeCloseTo(90, 2);
    expect(v.trades[0].realizedPnl).toBeCloseTo(
      expectedNetRealized(pos, 90),
      2,
    );
    expect(v.trades[0].realizedPnl).toBeLessThan(0);
  });

  it("(c) short TP (mark down) and short SL (mark up) fire inverse", () => {
    const tpPos = makePosition({ side: "short", takeProfit: 90 });
    const tpVault = seedVaultWith([tpPos]);
    useSimStore.getState().tick(tpVault, [tickAt(90)], NOW + 2000);
    const tpV = useSimStore.getState().vaults[tpVault];
    expect(tpV.positions).toHaveLength(0);
    expect(tpV.trades[0].closedBy).toBe("tp");
    expect(tpV.trades[0].realizedPnl).toBeGreaterThan(0);

    const slPos = makePosition({ side: "short", stopLoss: 110 });
    const slVault = seedVaultWith([slPos]);
    useSimStore.getState().tick(slVault, [tickAt(110)], NOW + 2000);
    const slV = useSimStore.getState().vaults[slVault];
    expect(slV.positions).toHaveLength(0);
    expect(slV.trades[0].closedBy).toBe("sl");
    expect(slV.trades[0].realizedPnl).toBeLessThan(0);
  });

  it("(d) an un-crossed position is left untouched", () => {
    const pos = makePosition({ takeProfit: 110, stopLoss: 90 });
    const vaultId = seedVaultWith([pos]);
    useSimStore.getState().tick(vaultId, [tickAt(100)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(1);
    expect(v.positions[0].takeProfit).toBe(110);
    expect(v.positions[0].stopLoss).toBe(90);
    expect(
      v.trades.some((t) => t.closedBy === "tp" || t.closedBy === "sl"),
    ).toBe(false);
  });

  it("(e) OCO: a position with both legs closes once, no orphan bracket", () => {
    const pos = makePosition({ takeProfit: 110, stopLoss: 90 });
    const vaultId = seedVaultWith([pos]);
    // TP crosses; SL does not — closing on TP must drop the position entirely.
    useSimStore.getState().tick(vaultId, [tickAt(112)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(0);
    const fires = v.trades.filter(
      (t) => t.closedBy === "tp" || t.closedBy === "sl",
    );
    expect(fires).toHaveLength(1);
    expect(fires[0].closedBy).toBe("tp");
  });

  it("(f) INDEPENDENCE: firing one position leaves a same-symbol opposite untouched", () => {
    const long = makePosition({ id: "pos_long", side: "long", stopLoss: 90 });
    const short = makePosition({
      id: "pos_short",
      side: "short",
      takeProfit: 80,
      stopLoss: 130,
    });
    const vaultId = seedVaultWith([long, short]);
    // Mark 90: the long's SL fires; the short (TP 80 / SL 130) is uncrossed.
    useSimStore.getState().tick(vaultId, [tickAt(90)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(1);
    const survivor = v.positions[0];
    expect(survivor.id).toBe("pos_short");
    expect(survivor.side).toBe("short");
    expect(survivor.sizeUsd).toBe(SIZE); // not netted/merged
    expect(survivor.takeProfit).toBe(80);
    expect(survivor.stopLoss).toBe(130);
    const fires = v.trades.filter(
      (t) => t.closedBy === "tp" || t.closedBy === "sl",
    );
    expect(fires).toHaveLength(1);
    expect(fires[0].closedBy).toBe("sl");
  });

  it("(g) an expired bracket is cancelled, not fired", () => {
    const pos = makePosition({
      takeProfit: 110,
      stopLoss: 90,
      bracketExpiresAt: NOW + 1000,
    });
    const vaultId = seedVaultWith([pos]);
    // nowMs (NOW+2000) is past expiry (NOW+1000): the SL would cross at 90, but
    // the bracket is cancelled instead — the position survives with legs cleared.
    useSimStore.getState().tick(vaultId, [tickAt(90)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(1);
    expect(v.positions[0].takeProfit).toBeNull();
    expect(v.positions[0].stopLoss).toBeNull();
    expect(v.positions[0].bracketExpiresAt).toBeNull();
    expect(
      v.trades.some((t) => t.closedBy === "tp" || t.closedBy === "sl"),
    ).toBe(false);
  });

  it("(h) bracketTrigger keys on MARK only — mid never triggers", () => {
    const pos = makePosition({ takeProfit: 110 });
    const vaultId = seedVaultWith([pos]);
    // Mark below TP, mid above it: a mid-driven trigger would fire, mark must not.
    useSimStore.getState().tick(vaultId, [tickAt(105, 120)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(1);
    expect(v.trades.some((t) => t.closedBy === "tp")).toBe(false);
    // Purity sanity: the same position read at mid vs mark only crosses on mark.
    expect(bracketTrigger(pos, 120)).toBe("tp"); // mark at 120 would cross
    expect(bracketTrigger(pos, 105)).toBeNull(); // mark at 105 does not
  });
});

describe("store — setBracket / cancelBracket actions", () => {
  beforeEach(() => {
    useSimStore.setState({ vaults: {} });
  });

  it("setBracket arms only the target position", () => {
    const a = makePosition({ id: "pos_a" });
    const b = makePosition({ id: "pos_b" });
    const vaultId = seedVaultWith([a, b]);
    useSimStore
      .getState()
      .setBracket(vaultId, "pos_a", { takeProfit: 110, stopLoss: 90 });
    const v = useSimStore.getState().vaults[vaultId];

    const posA = v.positions.find((p) => p.id === "pos_a");
    const posB = v.positions.find((p) => p.id === "pos_b");
    expect(posA?.takeProfit).toBe(110);
    expect(posA?.stopLoss).toBe(90);
    // The sibling is untouched (no legs leaked across positions).
    expect(posB?.takeProfit ?? null).toBeNull();
    expect(posB?.stopLoss ?? null).toBeNull();
  });

  it("setBracket leaves an unspecified leg as-is and clears a leg with null", () => {
    const pos = makePosition({ takeProfit: 110, stopLoss: 90 });
    const vaultId = seedVaultWith([pos]);
    // Only touch SL → TP must survive unchanged.
    useSimStore.getState().setBracket(vaultId, pos.id, { stopLoss: 85 });
    let v = useSimStore.getState().vaults[vaultId];
    expect(v.positions[0].takeProfit).toBe(110);
    expect(v.positions[0].stopLoss).toBe(85);

    // Clearing TP with null leaves SL intact.
    useSimStore.getState().setBracket(vaultId, pos.id, { takeProfit: null });
    v = useSimStore.getState().vaults[vaultId];
    expect(v.positions[0].takeProfit).toBeNull();
    expect(v.positions[0].stopLoss).toBe(85);
  });

  it("setBracket sets and clears the expiry", () => {
    const pos = makePosition();
    const vaultId = seedVaultWith([pos]);
    useSimStore
      .getState()
      .setBracket(vaultId, pos.id, { stopLoss: 90, expiresAt: NOW + 5000 });
    expect(
      useSimStore.getState().vaults[vaultId].positions[0].bracketExpiresAt,
    ).toBe(NOW + 5000);

    useSimStore.getState().setBracket(vaultId, pos.id, { expiresAt: null });
    expect(
      useSimStore.getState().vaults[vaultId].positions[0].bracketExpiresAt,
    ).toBeNull();
  });

  it("cancelBracket clears one leg, or both when no leg is given", () => {
    const pos = makePosition({ takeProfit: 110, stopLoss: 90 });
    const vaultId = seedVaultWith([pos]);
    useSimStore.getState().cancelBracket(vaultId, pos.id, "tp");
    let v = useSimStore.getState().vaults[vaultId];
    expect(v.positions[0].takeProfit).toBeNull();
    expect(v.positions[0].stopLoss).toBe(90);

    useSimStore.getState().cancelBracket(vaultId, pos.id);
    v = useSimStore.getState().vaults[vaultId];
    expect(v.positions[0].takeProfit).toBeNull();
    expect(v.positions[0].stopLoss).toBeNull();
  });

  it("cancelBracket never touches another position", () => {
    const a = makePosition({ id: "pos_a", takeProfit: 110 });
    const b = makePosition({ id: "pos_b", takeProfit: 120, stopLoss: 80 });
    const vaultId = seedVaultWith([a, b]);
    useSimStore.getState().cancelBracket(vaultId, "pos_a");
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions.find((p) => p.id === "pos_a")?.takeProfit).toBeNull();
    const posB = v.positions.find((p) => p.id === "pos_b");
    expect(posB?.takeProfit).toBe(120);
    expect(posB?.stopLoss).toBe(80);
  });

  it("set + cancel are no-ops on a missing position", () => {
    const pos = makePosition();
    const vaultId = seedVaultWith([pos]);
    useSimStore.getState().setBracket(vaultId, "pos_missing", { stopLoss: 90 });
    useSimStore.getState().cancelBracket(vaultId, "pos_missing");
    const v = useSimStore.getState().vaults[vaultId];
    expect(v.positions).toHaveLength(1);
    expect(v.positions[0].stopLoss ?? null).toBeNull();
  });

  it("a bracket armed via setBracket fires (OCO) on the next crossing tick", () => {
    const pos = makePosition();
    const vaultId = seedVaultWith([pos]);
    useSimStore
      .getState()
      .setBracket(vaultId, pos.id, { takeProfit: 110, stopLoss: 90 });
    // setBracket alone does not fire; the next tick crosses TP and closes once.
    expect(useSimStore.getState().vaults[vaultId].positions).toHaveLength(1);

    useSimStore.getState().tick(vaultId, [tickAt(115)], NOW + 3000);
    const v = useSimStore.getState().vaults[vaultId];
    expect(v.positions).toHaveLength(0);
    const fires = v.trades.filter(
      (t) => t.closedBy === "tp" || t.closedBy === "sl",
    );
    expect(fires).toHaveLength(1);
    expect(fires[0].closedBy).toBe("tp");
  });
});

describe("submitOrder — arm TP/SL bracket at open", () => {
  beforeEach(() => {
    useSimStore.setState({ vaults: {} });
  });

  // leverage 1 keeps the liq price near 0 so the bracket levels under test
  // dominate, mirroring the makePosition vector above.
  const baseIntent = {
    symbol: SOL,
    side: "long" as const,
    sizeUsd: SIZE,
    marginMode: "isolated" as const,
    leverage: 1,
  };

  /** Fresh non-demo vault with an opening mark at ENTRY (no seeded positions). */
  function freshVault(): string {
    const vaultId = `vault_open_${Math.random().toString(36).slice(2)}`;
    useSimStore.getState().startEvaluation(vaultId, STARTER, "0xowner", NOW);
    return vaultId;
  }

  it("arms the new position's bracket from the intent at open", () => {
    const vaultId = freshVault();
    useSimStore
      .getState()
      .submitOrder(
        vaultId,
        { ...baseIntent, takeProfit: 110, stopLoss: 90 },
        [tickAt(ENTRY)],
        NOW,
      );
    const v = useSimStore.getState().vaults[vaultId];
    expect(v.positions).toHaveLength(1);
    expect(v.positions[0].takeProfit).toBe(110);
    expect(v.positions[0].stopLoss).toBe(90);
    // Arming at open is a normal submit — it does NOT fire on the opening tick.
    expect(
      v.trades.some((t) => t.closedBy === "tp" || t.closedBy === "sl"),
    ).toBe(false);
  });

  it("a subsequent crossing tick fires the close via fireBrackets", () => {
    const vaultId = freshVault();
    useSimStore
      .getState()
      .submitOrder(
        vaultId,
        { ...baseIntent, takeProfit: 110 },
        [tickAt(ENTRY)],
        NOW,
      );
    // Next tick crosses TP → the same fireBrackets path closes the position once.
    useSimStore.getState().tick(vaultId, [tickAt(110)], NOW + 2000);
    const v = useSimStore.getState().vaults[vaultId];
    expect(v.positions).toHaveLength(0);
    const fires = v.trades.filter(
      (t) => t.closedBy === "tp" || t.closedBy === "sl",
    );
    expect(fires).toHaveLength(1);
    expect(fires[0].closedBy).toBe("tp");
    expect(fires[0].fill).toBeCloseTo(110, 2);
    expect(fires[0].realizedPnl).toBeGreaterThan(0);
  });

  it("submitting WITHOUT TP/SL leaves both legs disarmed (unchanged behavior)", () => {
    const vaultId = freshVault();
    useSimStore.getState().submitOrder(vaultId, baseIntent, [tickAt(ENTRY)], NOW);
    const v = useSimStore.getState().vaults[vaultId];
    expect(v.positions).toHaveLength(1);
    expect(v.positions[0].takeProfit ?? null).toBeNull();
    expect(v.positions[0].stopLoss ?? null).toBeNull();
    // A crossing tick must NOT close it — there is no armed leg to fire.
    useSimStore.getState().tick(vaultId, [tickAt(200)], NOW + 2000);
    const after = useSimStore.getState().vaults[vaultId];
    expect(after.positions).toHaveLength(1);
    expect(
      after.trades.some((t) => t.closedBy === "tp" || t.closedBy === "sl"),
    ).toBe(false);
  });

  it("arming at open never touches another open position", () => {
    const vaultId = freshVault();
    // First position: no bracket.
    useSimStore.getState().submitOrder(vaultId, baseIntent, [tickAt(ENTRY)], NOW);
    // Second submit arms its own bracket; the first must stay disarmed.
    useSimStore
      .getState()
      .submitOrder(
        vaultId,
        { ...baseIntent, takeProfit: 110, stopLoss: 90 },
        [tickAt(ENTRY)],
        NOW + 1000,
      );
    const v = useSimStore.getState().vaults[vaultId];
    expect(v.positions).toHaveLength(2);
    const armed = v.positions.filter(
      (p) => p.takeProfit === 110 && p.stopLoss === 90,
    );
    expect(armed).toHaveLength(1);
    const bare = v.positions.filter(
      (p) => (p.takeProfit ?? null) === null && (p.stopLoss ?? null) === null,
    );
    expect(bare).toHaveLength(1);
  });
});
