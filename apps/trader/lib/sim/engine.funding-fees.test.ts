import { describe, expect, it } from "vitest";
import { applyFees, HL_MAKER_BPS, HL_TAKER_BPS } from "@/lib/slippage-preview";
import { accrueFunding } from "./engine";

/**
 * Parity vectors against the Hyperliquid fidelity contract (research/STACK.md §3,
 * research/FEATURES.md Ground Truth). Money asserted at USDC 6-dp scale
 * (`toBeCloseTo(ref, 6)`), per PITFALLS C5.
 *
 * Fees: taker 4.5 bps (0.045%), maker 1.5 bps (0.015%), market orders pay taker.
 * Funding: oracle-price notional, signed (long + positive rate ⇒ pays), capped
 * at ±4%/hr, charged only on settlement boundaries crossed while open.
 */
describe("applyFees — HL maker/taker", () => {
  it("charges the taker rate on a known notional", () => {
    // 10_000 USD * 0.045% = 4.5 USD
    expect(applyFees(10_000, "taker")).toBeCloseTo(4.5, 6);
    expect(HL_TAKER_BPS).toBe(4.5);
  });

  it("defaults to taker for market orders", () => {
    expect(applyFees(10_000)).toBeCloseTo(applyFees(10_000, "taker"), 6);
  });

  it("charges the maker rate when resting", () => {
    // 10_000 USD * 0.015% = 1.5 USD
    expect(applyFees(10_000, "maker")).toBeCloseTo(1.5, 6);
    expect(HL_MAKER_BPS).toBe(1.5);
  });

  it("a round trip pays taker twice", () => {
    const open = applyFees(10_000, "taker");
    const close = applyFees(10_000, "taker");
    expect(open + close).toBeCloseTo(9.0, 6);
  });
});

describe("accrueFunding — sign, oracle notional, cap, discreteness", () => {
  const base = {
    sizeUsd: 10_000,
    entryPrice: 100,
    oraclePx: 100,
    settlementsElapsed: 1,
  } as const;

  it("long + positive rate ⇒ trader PAYS (negative funding)", () => {
    // baseSize = 100, perSettlement = -(+1)*100*100*0.0001 = -1.0
    const f = accrueFunding({ ...base, side: "long", fundingRate: 0.0001 });
    expect(f).toBeLessThan(0);
    expect(f).toBeCloseTo(-1.0, 6);
  });

  it("long + negative rate ⇒ trader EARNS (positive funding)", () => {
    const f = accrueFunding({ ...base, side: "long", fundingRate: -0.0001 });
    expect(f).toBeGreaterThan(0);
    expect(f).toBeCloseTo(1.0, 6);
  });

  it("short + positive rate ⇒ trader EARNS (mirror of long)", () => {
    const f = accrueFunding({ ...base, side: "short", fundingRate: 0.0001 });
    expect(f).toBeCloseTo(1.0, 6);
  });

  it("uses the ORACLE price for notional, not entry/mark", () => {
    // oraclePx 120 vs entry 100: perSettlement = -(1)*100*120*0.0001 = -1.2
    const f = accrueFunding({
      ...base,
      oraclePx: 120,
      side: "long",
      fundingRate: 0.0001,
    });
    expect(f).toBeCloseTo(-1.2, 6);
    // and differs from the entry-notional value (-1.0) it would have on mark==entry
    expect(f).not.toBeCloseTo(-1.0, 6);
  });

  it("clamps an extreme rate to the ±4%/hr cap", () => {
    // rate 0.5 clamps to 0.04: -(1)*100*100*0.04 = -400
    const f = accrueFunding({ ...base, side: "long", fundingRate: 0.5 });
    expect(f).toBeCloseTo(-400, 6);
    const fNeg = accrueFunding({ ...base, side: "long", fundingRate: -0.5 });
    expect(fNeg).toBeCloseTo(400, 6);
  });

  it("charges N settlements linearly", () => {
    const f = accrueFunding({
      ...base,
      side: "long",
      fundingRate: 0.0001,
      settlementsElapsed: 7,
    });
    expect(f).toBeCloseTo(-7.0, 6);
  });

  it("charges zero when no settlement boundary was crossed", () => {
    const f = accrueFunding({
      ...base,
      side: "long",
      fundingRate: 0.0001,
      settlementsElapsed: 0,
    });
    expect(f).toBeCloseTo(0, 6);
  });
});
