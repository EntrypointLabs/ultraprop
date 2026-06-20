import { describe, expect, it } from "vitest";
import { drawdownCappedLiquidation } from "@/lib/sim/engine";

/**
 * The effective liquidation never lets a position lose more than the firm's
 * remaining drawdown/daily-loss room: the stop is whichever price is hit first.
 */
describe("drawdownCappedLiquidation", () => {
  const base = { entryPrice: 68_000, sizeUsd: 10_000 } as const;

  it("tightens a long toward entry when the drawdown floor is closer than venue liq", () => {
    // $500 of room over a $10k notional = a 5% adverse move → 64,600.
    const liq = drawdownCappedLiquidation({
      ...base,
      side: "long",
      venueLiquidation: 60_000,
      drawdownBudgetUsd: 500,
      dailyLossBudgetUsd: null,
    });
    expect(liq).toBeCloseTo(64_600, 6);
  });

  it("tightens a short toward entry (price rising)", () => {
    const liq = drawdownCappedLiquidation({
      ...base,
      side: "short",
      venueLiquidation: 72_000,
      drawdownBudgetUsd: 500,
      dailyLossBudgetUsd: null,
    });
    expect(liq).toBeCloseTo(71_400, 6);
  });

  it("picks the tightest of venue / overall-drawdown / daily-loss", () => {
    // daily ($200 → 1.36% → 66,640) is tighter than overall ($500 → 64,600).
    const liq = drawdownCappedLiquidation({
      ...base,
      side: "long",
      venueLiquidation: 60_000,
      drawdownBudgetUsd: 500,
      dailyLossBudgetUsd: 200,
    });
    expect(liq).toBeCloseTo(66_640, 6);
  });

  it("keeps the venue liq when the drawdown room is wide", () => {
    // Budget >= notional would price the stop at/through 0; venue liq still binds.
    const liq = drawdownCappedLiquidation({
      ...base,
      side: "long",
      venueLiquidation: 60_000,
      drawdownBudgetUsd: 10_000,
      dailyLossBudgetUsd: null,
    });
    expect(liq).toBe(60_000);
  });

  it("returns the venue liq unchanged when no budgets apply", () => {
    const liq = drawdownCappedLiquidation({
      ...base,
      side: "long",
      venueLiquidation: 60_000,
      drawdownBudgetUsd: null,
      dailyLossBudgetUsd: null,
    });
    expect(liq).toBe(60_000);
  });
});
