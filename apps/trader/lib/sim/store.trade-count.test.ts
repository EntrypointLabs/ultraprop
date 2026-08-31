import { beforeEach, describe, expect, it } from "vitest";
import { countTrades, DEMO_TRADES, TIERS } from "@/lib/mock/fixtures";
import type { PriceTick } from "@/lib/mock/types";
import { toVaultState, useSimStore } from "./store";

/**
 * `tradeCount` is what a trader thinks of as "trades used": one per position
 * opened. A round trip (open + close) is a SINGLE trade even though it consumes
 * two intents — so the eval card and terminal screens read `tradeCount` while
 * the cockpit's order-activity tally keeps reading `intentCount`.
 */
const STARTER = TIERS[0];
const NOW = 1_749_312_000_000;
const SOL = "hyperliquid:SOL";
const ENTRY = 100;
const SIZE = 1000;

const baseIntent = {
  symbol: SOL,
  side: "long" as const,
  sizeUsd: SIZE,
  marginMode: "isolated" as const,
  leverage: 1,
};

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

function freshVault(): string {
  const vaultId = `vault_tc_${Math.random().toString(36).slice(2)}`;
  useSimStore.getState().startEvaluation(vaultId, STARTER, "0xowner", NOW);
  return vaultId;
}

describe("tradeCount — one per opened position", () => {
  beforeEach(() => {
    useSimStore.setState({ vaults: {} });
  });

  it("an open + close is two intents but a single trade", () => {
    const vaultId = freshVault();
    useSimStore
      .getState()
      .submitOrder(vaultId, baseIntent, [tickAt(ENTRY)], NOW);
    const opened = useSimStore.getState().vaults[vaultId];
    const positionId = opened.positions[0].id;

    useSimStore
      .getState()
      .closePosition(vaultId, positionId, [tickAt(108)], NOW + 2000);

    const v = useSimStore.getState().vaults[vaultId];
    expect(v.intentCount).toBe(2);
    expect(toVaultState(v).tradeCount).toBe(1);
  });

  it("an open with no close already counts as a trade", () => {
    const vaultId = freshVault();
    useSimStore
      .getState()
      .submitOrder(vaultId, baseIntent, [tickAt(ENTRY)], NOW);

    const v = useSimStore.getState().vaults[vaultId];
    expect(v.intentCount).toBe(1);
    expect(toVaultState(v).tradeCount).toBe(1);
  });

  it("multiple partial closes of one position stay a single trade", () => {
    const vaultId = freshVault();
    useSimStore
      .getState()
      .submitOrder(vaultId, baseIntent, [tickAt(ENTRY)], NOW);
    const positionId = useSimStore.getState().vaults[vaultId].positions[0].id;

    useSimStore
      .getState()
      .closePosition(
        vaultId,
        positionId,
        [tickAt(105)],
        NOW + 1000,
        SIZE * 0.25,
      );
    useSimStore
      .getState()
      .closePosition(
        vaultId,
        positionId,
        [tickAt(106)],
        NOW + 2000,
        SIZE * 0.25,
      );

    const v = useSimStore.getState().vaults[vaultId];
    expect(v.intentCount).toBe(3);
    expect(toVaultState(v).tradeCount).toBe(1);
  });

  it("two opened positions are two trades", () => {
    const vaultId = freshVault();
    useSimStore
      .getState()
      .submitOrder(vaultId, baseIntent, [tickAt(ENTRY)], NOW);
    useSimStore
      .getState()
      .submitOrder(vaultId, baseIntent, [tickAt(ENTRY)], NOW + 1000);

    const v = useSimStore.getState().vaults[vaultId];
    expect(toVaultState(v).tradeCount).toBe(2);
  });

  it("counts seed-style completed trades, which carry no separate open record", () => {
    expect(countTrades(DEMO_TRADES)).toBe(DEMO_TRADES.length);
  });
});
