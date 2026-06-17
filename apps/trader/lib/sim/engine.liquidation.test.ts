import { describe, expect, it } from "vitest";
import { liquidationPrice, maintenanceMargin } from "./engine";

/**
 * Liquidation parity against the verbatim HL formula (research/FEATURES.md
 * Ground Truth, research/STACK.md §3):
 *   liq = entry − side · marginAvailable / positionSize / (1 − l · side)
 *   l = mmFraction = 1/(2·maxLeverage)
 * Both margin modes are covered so a regression in either branch fails. Hand-
 * computed vectors below; money asserted with toBeCloseTo.
 *
 * Vector base: entry 100_000, sizeUsd 10_000, BTC maxLeverage 40 ⇒
 *   positionSize = 0.1, l = 0.0125, maint = 10_000·0.0125 = 125.
 */
const ENTRY = 100_000;
const SIZE = 10_000;
const MAX_LEV = 40;
const MAINT = 125; // 10_000 * 1/(2*40)

describe("liquidationPrice — isolated", () => {
  it("isolated long liquidates BELOW entry", () => {
    // leverage 10 ⇒ isolatedMargin = 1000; marginAvailable = 875;
    // liq = 100000 − 875/0.1/(1−0.0125) = 100000 − 8750/0.9875 = 91139.2405...
    const liq = liquidationPrice({
      entryPrice: ENTRY,
      sizeUsd: SIZE,
      side: "long",
      maxLeverage: MAX_LEV,
      marginMode: "isolated",
      isolatedMargin: 1000,
      accountValue: 50_000,
      maintMarginRequired: MAINT,
    });
    expect(liq).toBeLessThan(ENTRY);
    expect(liq).toBeCloseTo(91139.240506, 4);
  });

  it("isolated short liquidates ABOVE entry", () => {
    // liq = 100000 + 875/0.1/(1+0.0125) = 100000 + 8750/1.0125 = 108641.9753...
    const liq = liquidationPrice({
      entryPrice: ENTRY,
      sizeUsd: SIZE,
      side: "short",
      maxLeverage: MAX_LEV,
      marginMode: "isolated",
      isolatedMargin: 1000,
      accountValue: 50_000,
      maintMarginRequired: MAINT,
    });
    expect(liq).toBeGreaterThan(ENTRY);
    expect(liq).toBeCloseTo(108641.975309, 4);
  });
});

describe("liquidationPrice — cross vs isolated", () => {
  it("cross differs from isolated for the SAME position", () => {
    const common = {
      entryPrice: ENTRY,
      sizeUsd: SIZE,
      side: "long" as const,
      maxLeverage: MAX_LEV,
      isolatedMargin: 1000,
      maintMarginRequired: MAINT,
    };
    const isolated = liquidationPrice({
      ...common,
      marginMode: "isolated",
      accountValue: 1500,
    });
    const cross = liquidationPrice({
      ...common,
      marginMode: "cross",
      accountValue: 1500,
    });
    // cross uses accountValue 1500 (not isolatedMargin 1000) ⇒ different liq.
    // cross: 100000 − (1500−125)/0.1/0.9875 = 100000 − 13924.0506 = 86075.949
    expect(cross).toBeCloseTo(86075.949367, 4);
    expect(isolated).toBeCloseTo(91139.240506, 4);
    expect(cross).not.toBeCloseTo(isolated, 2);
  });

  it("cross liq is INDEPENDENT of the leverage set; isolated DEPENDS on it", () => {
    const common = {
      entryPrice: ENTRY,
      sizeUsd: SIZE,
      side: "long" as const,
      maxLeverage: MAX_LEV,
      accountValue: 5_000,
      maintMarginRequired: MAINT,
    };
    // Cross ignores isolatedMargin → same liq for 5x (margin 2000) and 20x (margin 500).
    const cross5x = liquidationPrice({
      ...common,
      marginMode: "cross",
      isolatedMargin: 2000,
    });
    const cross20x = liquidationPrice({
      ...common,
      marginMode: "cross",
      isolatedMargin: 500,
    });
    expect(cross5x).toBeCloseTo(cross20x, 6);

    // Isolated keys off isolatedMargin → the two leverages give different liq.
    const iso5x = liquidationPrice({
      ...common,
      marginMode: "isolated",
      isolatedMargin: 2000,
    });
    const iso20x = liquidationPrice({
      ...common,
      marginMode: "isolated",
      isolatedMargin: 500,
    });
    expect(iso5x).not.toBeCloseTo(iso20x, 2);
  });
});

describe("maintenance fraction sanity (mmFraction = 1/(2·maxLeverage))", () => {
  it("40x ⇒ 1.25%", () => {
    expect(maintenanceMargin(10_000, 40) / 10_000).toBeCloseTo(0.0125, 6);
  });

  it("3x ⇒ 16.7%", () => {
    expect(maintenanceMargin(10_000, 3) / 10_000).toBeCloseTo(0.166667, 5);
  });
});
