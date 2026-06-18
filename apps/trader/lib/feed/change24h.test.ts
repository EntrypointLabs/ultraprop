import { ctxToMarkTick } from "@shared/venues";
import { describe, expect, it } from "vitest";

/**
 * MAJ-5: the HL adapter must derive a live 24h change from `prevDayPx`. Before
 * this, `prevDayPx` was discarded and `change24h` stayed null, so the cockpit
 * and markets table showed "—" or a stale seed %.
 */
describe("ctxToMarkTick change24h", () => {
  it("derives a positive 24h change from prevDayPx", () => {
    const tick = ctxToMarkTick(
      "hyperliquid:BTC",
      { markPx: "110", oraclePx: "110", midPx: "110", prevDayPx: "100" },
      1_000,
    );
    expect(tick.change24h).toBeCloseTo(10, 6);
  });

  it("derives a negative 24h change", () => {
    const tick = ctxToMarkTick(
      "hyperliquid:ETH",
      { markPx: "90", oraclePx: "90", midPx: "90", prevDayPx: "100" },
      1_000,
    );
    expect(tick.change24h).toBeCloseTo(-10, 6);
  });

  it("is null when prevDayPx is absent (no 24h reference)", () => {
    const tick = ctxToMarkTick(
      "hyperliquid:FOO",
      { markPx: "5", oraclePx: "5", midPx: "5" },
      1_000,
    );
    expect(tick.change24h).toBeNull();
  });

  it("is null when prevDayPx is zero (avoids divide-by-zero / Infinity)", () => {
    const tick = ctxToMarkTick(
      "hyperliquid:BAR",
      { markPx: "5", oraclePx: "5", midPx: "5", prevDayPx: "0" },
      1_000,
    );
    expect(tick.change24h).toBeNull();
  });

  it("carries mark/oracle/mid through unchanged alongside change24h", () => {
    const tick = ctxToMarkTick(
      "hyperliquid:SOL",
      {
        markPx: "150",
        oraclePx: "149.5",
        midPx: "150.1",
        funding: "0.0001",
        prevDayPx: "120",
      },
      42,
    );
    expect(tick.markPx).toBe(150);
    expect(tick.oraclePx).toBe(149.5);
    expect(tick.midPx).toBe(150.1);
    expect(tick.fundingRate).toBeCloseTo(0.0001, 8);
    expect(tick.ts).toBe(42);
    expect(tick.change24h).toBeCloseTo(25, 6);
  });
});
