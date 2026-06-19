import { beforeEach, describe, expect, it } from "vitest";
import { TIERS } from "@/lib/mock/fixtures";
import type { PriceTick } from "@/lib/mock/types";
import { isRealizedClose } from "@/lib/sui/bridge";
import { useSimStore } from "./store";

/**
 * On-chain reconciliation invariant (task #4): the realized PnL the bridge sends
 * to `log_trade` (each close TradeRecord's `realizedPnl`) must INCLUDE that
 * trade's realized fees + funding, so on-chain equity (funded_size + Σ sent pnl)
 * matches the engine's realized equity (startingEquity + realizedTotal). Concretely:
 * when the book is FLAT, `realizedTotal` == Σ of every realized close trade's
 * `realizedPnl`, and each close folds in entry fee + exit fee + funding.
 *
 * Vector: SOL, entry 100, sizeUsd 1000.
 */
const STARTER = TIERS[0];
const NOW = 1_749_312_000_000;
const SOL = "hyperliquid:SOL";
const FUNDING_INTERVAL = 60 * 60 * 1000; // HL SOL funds hourly

function tick(markPx: number, fundingRate = 0, ts = NOW): PriceTick {
  return {
    symbol: SOL,
    markPx,
    oraclePx: markPx,
    midPx: markPx,
    fundingRate,
    change24h: null,
    spark: [],
    high24h: null,
    low24h: null,
    ts,
  };
}

function freshVault(): string {
  const vaultId = `vault_reconcile_${Math.random().toString(36).slice(2)}`;
  useSimStore.getState().startEvaluation(vaultId, STARTER, "0xowner", NOW);
  return vaultId;
}

describe("on-chain reconciliation — close pnl includes fees + funding", () => {
  beforeEach(() => {
    useSimStore.setState({ vaults: {} });
  });

  it("a full close's realizedPnl carries entry fee + exit fee + funding, and realizedTotal == that pnl when flat", () => {
    const vaultId = freshVault();
    const store = useSimStore.getState();

    // Open at 100 (taker fee carried on the position, not in realizedTotal yet).
    store.submitOrder(
      vaultId,
      { symbol: SOL, side: "long", sizeUsd: 1000, marginMode: "cross", leverage: 5 },
      [tick(100)],
      NOW,
    );
    const opened = useSimStore.getState().vaults[vaultId];
    expect(opened.positions).toHaveLength(1);
    const entryFee = opened.positions[0].entryFeeUsd;
    expect(entryFee).toBeGreaterThan(0);
    // Opening alone never moves realizedTotal under the new model.
    expect(opened.realizedTotal).toBe(0);
    // Equity reflects the entry fee AND the position's opening unrealized (the
    // fill carries slippage), exactly as computeEquity folds them in.
    expect(opened.equity).toBeCloseTo(
      STARTER.shadowAllocation + opened.positions[0].unrealizedPnl - entryFee,
      2,
    );

    // Cross a funding boundary while the trader PAYS (long + positive rate).
    store.tick(vaultId, [tick(100, 0.0001, NOW + FUNDING_INTERVAL)], NOW + FUNDING_INTERVAL);
    const funded = useSimStore.getState().vaults[vaultId];
    const fundingPaid = funded.positions[0].fundingPaid;
    expect(fundingPaid).toBeLessThan(0); // trader paid funding
    // Funding still hasn't hit realizedTotal — it's carried on the position.
    expect(funded.realizedTotal).toBe(0);
    expect(funded.equity).toBeCloseTo(
      STARTER.shadowAllocation +
        funded.positions[0].unrealizedPnl -
        entryFee +
        fundingPaid,
      2,
    );

    // Fully close at 100 (flat price): the only realized cash flows are the two
    // taker fees and the paid funding.
    store.closePosition(vaultId, funded.positions[0].id, [tick(100)], NOW + FUNDING_INTERVAL + 1000);
    const closed = useSimStore.getState().vaults[vaultId];
    expect(closed.positions).toHaveLength(0);

    const closeTrades = closed.trades.filter(isRealizedClose);
    expect(closeTrades).toHaveLength(1);
    const sent = closeTrades[0].realizedPnl;

    // The close trade's realizedPnl == realizedTotal when flat (the bridge sends
    // exactly this, so on-chain equity reconciles).
    expect(closed.realizedTotal).toBeCloseTo(sent, 2);

    // The close folds the realized fees + funding into its pnl on top of the
    // (slightly negative, from round-trip slippage) price pnl — so it lands
    // strictly more negative than the funding paid alone.
    const exitFee = closeTrades[0].feeUsd;
    expect(exitFee).toBeGreaterThan(0);
    expect(sent).toBeLessThan(fundingPaid);
  });

  it("partial closes sum back to realizedTotal once flat (Σ sent pnl reconciles)", () => {
    const vaultId = freshVault();
    const store = useSimStore.getState();
    store.submitOrder(
      vaultId,
      { symbol: SOL, side: "long", sizeUsd: 1000, marginMode: "cross", leverage: 5 },
      [tick(100)],
      NOW,
    );
    const id = useSimStore.getState().vaults[vaultId].positions[0].id;

    // Two partial closes that together flatten the position, in profit.
    store.closePosition(vaultId, id, [tick(110)], NOW + 1000, 400);
    store.closePosition(vaultId, id, [tick(110)], NOW + 2000); // remainder
    const v = useSimStore.getState().vaults[vaultId];

    expect(v.positions).toHaveLength(0);
    const sentTotal = v.trades
      .filter(isRealizedClose)
      .reduce((s, t) => s + t.realizedPnl, 0);
    expect(v.realizedTotal).toBeCloseTo(Number(sentTotal.toFixed(2)), 2);
    // No carried cost remains; equity is purely starting + realizedTotal.
    expect(v.equity).toBeCloseTo(STARTER.shadowAllocation + v.realizedTotal, 2);
  });
});
