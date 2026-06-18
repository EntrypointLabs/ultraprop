import { beforeEach, describe, expect, it } from "vitest";
import { TIERS } from "@/lib/mock/fixtures";
import type { PriceTick } from "@/lib/mock/types";
import { useSimStore } from "./store";

/**
 * MAJ-2 regression: `submitOrder` rejects an order whose required initial
 * margin exceeds free margin (equity − margin already committed to open
 * positions), mirroring the existing `sizeUsd <= 0` early-return guard. Orders
 * that fit inside free margin still open.
 *
 * Fresh starter vault: equity 10_000, no open positions ⇒ freeMargin 10_000.
 */
const STARTER = TIERS[0]; // shadowAllocation 10_000, leverage cap 10
const NOW = 1_749_312_000_000;
const SOL = "hyperliquid:SOL";

const PRICES: PriceTick[] = [
  {
    symbol: SOL,
    markPx: 100,
    oraclePx: 100,
    midPx: 100,
    fundingRate: 0,
    change24h: null,
    spark: [],
    high24h: null,
    low24h: null,
    ts: NOW,
  },
];

function freshVault(): string {
  const vaultId = `vault_margin_${Math.random().toString(36).slice(2)}`;
  useSimStore.getState().startEvaluation(vaultId, STARTER, "0xowner", NOW);
  return vaultId;
}

describe("submitOrder — free-margin gate (MAJ-2)", () => {
  beforeEach(() => {
    useSimStore.setState({ vaults: {} });
  });

  it("rejects an order whose required margin exceeds free margin", () => {
    const vaultId = freshVault();
    // sizeUsd 60_000 at 5x ⇒ requiredMargin 12_000 > freeMargin 10_000.
    useSimStore.getState().submitOrder(
      vaultId,
      {
        symbol: SOL,
        side: "long",
        sizeUsd: 60_000,
        marginMode: "cross",
        leverage: 5,
      },
      PRICES,
      NOW,
    );
    const v = useSimStore.getState().vaults[vaultId];
    expect(v.positions).toHaveLength(0);
    expect(v.trades).toHaveLength(0);
    expect(v.intentCount).toBe(0);
  });

  it("opens an order that fits inside free margin", () => {
    const vaultId = freshVault();
    // sizeUsd 40_000 at 5x ⇒ requiredMargin 8_000 ≤ freeMargin 10_000.
    useSimStore.getState().submitOrder(
      vaultId,
      {
        symbol: SOL,
        side: "long",
        sizeUsd: 40_000,
        marginMode: "cross",
        leverage: 5,
      },
      PRICES,
      NOW,
    );
    const v = useSimStore.getState().vaults[vaultId];
    expect(v.positions).toHaveLength(1);
    expect(v.intentCount).toBe(1);
  });

  it("accounts for margin already committed to open positions", () => {
    const vaultId = freshVault();
    // First order: 40_000 @ 5x ⇒ uses 8_000 margin, leaving 2_000 free
    // (minus the taker fee booked at fill).
    useSimStore.getState().submitOrder(
      vaultId,
      {
        symbol: SOL,
        side: "long",
        sizeUsd: 40_000,
        marginMode: "cross",
        leverage: 5,
      },
      PRICES,
      NOW,
    );
    expect(useSimStore.getState().vaults[vaultId].positions).toHaveLength(1);

    // Second order needs 4_000 margin (20_000 @ 5x) > ~2_000 free ⇒ rejected.
    useSimStore.getState().submitOrder(
      vaultId,
      {
        symbol: SOL,
        side: "long",
        sizeUsd: 20_000,
        marginMode: "cross",
        leverage: 5,
      },
      PRICES,
      NOW,
    );
    const v = useSimStore.getState().vaults[vaultId];
    expect(v.positions).toHaveLength(1);
    expect(v.intentCount).toBe(1);
  });
});
