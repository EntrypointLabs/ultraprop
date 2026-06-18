import { beforeEach, describe, expect, it } from "vitest";
import { TIERS } from "@/lib/mock/fixtures";
import { useSimStore } from "./store";

/**
 * BLK-3 regression: the equity curve must never carry two points in the same
 * whole second. The chart maps timestamps to seconds, so same-second points
 * collide into a duplicate `UTCTimestamp` and lightweight-charts refuses to
 * render (blank chart). `recompute` coalesces sub-second ticks by replacing the
 * last point instead of appending.
 */
const STARTER = TIERS[0];
const NOW = 1_749_312_000_000; // whole second boundary
const VAULT = "vault_equity_curve_test";

describe("equity curve — second-level coalescing (BLK-3)", () => {
  beforeEach(() => {
    useSimStore.setState({ vaults: {} });
  });

  it("coalesces ticks within the same second to one point", () => {
    const { startEvaluation, tick } = useSimStore.getState();
    startEvaluation(VAULT, STARTER, "0xowner", NOW); // curve: [{ts: NOW}]
    tick(VAULT, [], NOW + 200); // same second → replace
    tick(VAULT, [], NOW + 1_200); // next second → append
    tick(VAULT, [], NOW + 1_700); // same second → replace

    const curve = useSimStore.getState().vaults[VAULT].equityCurve;
    expect(curve).toHaveLength(2);
  });

  it("never emits duplicate second-timestamps the chart would reject", () => {
    const { startEvaluation, tick } = useSimStore.getState();
    startEvaluation(VAULT, STARTER, "0xowner", NOW);
    // hammer many sub-second ticks (like the live SSE feed)
    for (let i = 0; i < 50; i++) tick(VAULT, [], NOW + i * 100);

    const curve = useSimStore.getState().vaults[VAULT].equityCurve;
    const seconds = curve.map((p) => Math.floor(p.ts / 1000));
    expect(new Set(seconds).size).toBe(seconds.length); // all unique
    // strictly ascending, as lightweight-charts requires
    for (let i = 1; i < seconds.length; i++) {
      expect(seconds[i]).toBeGreaterThan(seconds[i - 1]);
    }
  });
});
