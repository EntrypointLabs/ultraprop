import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_POSITIONS,
  DEMO_TRADES,
  DEMO_VAULT_ID,
  TIERS,
} from "@/lib/mock/fixtures";
import { useSimStore } from "./store";

/**
 * BLK-3 regression: the demo vault must open PRE-SEEDED from the fixtures
 * (positions, trades, equity curve) rather than empty, while non-demo vaults
 * stay fresh. `startEvaluation` is idempotent, so a second call never wipes a
 * vault that already exists.
 */
const STARTER = TIERS[0];
const NOW = 1_749_312_000_000;

describe("startEvaluation — demo vault seeding (BLK-3)", () => {
  beforeEach(() => {
    useSimStore.setState({ vaults: {} });
  });

  it("seeds the demo vault from fixtures on first creation", () => {
    useSimStore
      .getState()
      .startEvaluation(DEMO_VAULT_ID, STARTER, "0xowner", NOW);
    const v = useSimStore.getState().vaults[DEMO_VAULT_ID];

    expect(v).toBeDefined();
    expect(v.positions).toHaveLength(DEMO_POSITIONS.length);
    expect(v.trades).toHaveLength(DEMO_TRADES.length);
    expect(v.equityCurve.length).toBeGreaterThan(1);
    expect(v.intentCount).toBe(DEMO_TRADES.length);
  });

  it("booked realized total reconciles with the seed trades (pnl − fees)", () => {
    useSimStore
      .getState()
      .startEvaluation(DEMO_VAULT_ID, STARTER, "0xowner", NOW);
    const v = useSimStore.getState().vaults[DEMO_VAULT_ID];

    const expected = Number(
      DEMO_TRADES.reduce((s, t) => s + t.realizedPnl - t.feeUsd, 0).toFixed(2),
    );
    expect(v.realizedTotal).toBeCloseTo(expected, 2);
    expect(v.status).toBe("active");
  });

  it("leaves a non-demo (per-user) vault fresh and empty", () => {
    useSimStore
      .getState()
      .startEvaluation("vault_0xabc123", STARTER, "0xabc123", NOW);
    const v = useSimStore.getState().vaults.vault_0xabc123;

    expect(v.positions).toHaveLength(0);
    expect(v.trades).toHaveLength(0);
    expect(v.realizedTotal).toBe(0);
    expect(v.equity).toBe(STARTER.shadowAllocation);
  });

  it("never re-seeds an already-open demo vault (idempotent)", () => {
    const store = useSimStore.getState();
    store.startEvaluation(DEMO_VAULT_ID, STARTER, "0xowner", NOW);
    useSimStore.setState((s) => ({
      vaults: {
        ...s.vaults,
        [DEMO_VAULT_ID]: { ...s.vaults[DEMO_VAULT_ID], trades: [] },
      },
    }));
    store.startEvaluation(DEMO_VAULT_ID, STARTER, "0xowner", NOW);

    expect(useSimStore.getState().vaults[DEMO_VAULT_ID].trades).toHaveLength(0);
  });
});
