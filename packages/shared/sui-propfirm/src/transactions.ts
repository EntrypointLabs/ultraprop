import { Transaction } from "@mysten/sui/transactions";
import { CLOCK_OBJECT_ID, type WriteConfig } from "./config.js";

/**
 * The executor-gated and admin-gated write transactions for the propfirm
 * package. Pure builders: given the shared-object coordinates they assemble the
 * `moveCall`, with no env, no signing, no IO. This is the single source of the
 * on-chain write ABI — the trader app re-exports these so it and the executor
 * service can never drift on argument order.
 */

/** Firm-sponsored re-entry: puts a Failed/Suspended account back into evaluation. */
export function buildReactivateTransaction(
  config: WriteConfig,
  accountId: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::user_account::reactivate`,
    arguments: [
      tx.object(config.adminCapId),
      tx.object(config.accessRegistryId),
      tx.object(config.accountRegistryId),
      tx.pure.id(accountId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/**
 * Records a closed trade's realized PnL on-chain. `pnl` is the trade's absolute
 * realized PnL in USDC base units (6 dp), with the sign carried by `isWin`, so a
 * loss is `{ isWin: false, pnl: |loss| }`. The chain applies it to equity,
 * enforces the realized daily-loss and max-drawdown gates, and journals the
 * entry with its `venue`/`market` attribution.
 */
export function buildLogTradeTransaction(params: {
  config: WriteConfig;
  accountId: string;
  isWin: boolean;
  pnl: bigint;
  venue: string;
  market: string;
}): Transaction {
  const { config, accountId, isWin, pnl, venue, market } = params;
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::user_account::log_trade`,
    arguments: [
      tx.object(config.executorCapId),
      tx.object(config.accessRegistryId),
      tx.object(config.accountRegistryId),
      tx.pure.id(accountId),
      tx.pure.bool(isWin),
      tx.pure.u64(pnl),
      tx.pure.string(venue),
      tx.pure.string(market),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/**
 * Records a closed trade on-chain AND emits the full-detail `TradeSettled` event
 * so a trader's realized history can be reconstructed off-chain from events
 * alone. Identical equity/gate effects as `buildLogTradeTransaction`; the extra
 * args (side, size, leverage, entry/exit price, fees, funding, close reason)
 * ride only in the event. All USD/price/leverage values are u64 fixed-point at
 * 1e6; `pnl` and `fundingPaid` are magnitudes with their signs in `isWin` and
 * `fundingIsCredit`. `side`: 0 long / 1 short. `closeReason`: 0 manual / 1 tp /
 * 2 sl / 3 liquidation.
 */
export function buildLogTradeDetailedTransaction(params: {
  config: WriteConfig;
  accountId: string;
  isWin: boolean;
  pnl: bigint;
  venue: string;
  market: string;
  side: number;
  sizeUsd: bigint;
  leverage: bigint;
  entryPrice: bigint;
  exitPrice: bigint;
  entryFee: bigint;
  fundingPaid: bigint;
  fundingIsCredit: boolean;
  closeReason: number;
}): Transaction {
  const tx = new Transaction();
  // `log_trade_detailed` was introduced by the upgrade, so it lives at the latest
  // package version; the original `packageId` doesn't have it.
  const packageId = params.config.packageIdLatest ?? params.config.packageId;
  tx.moveCall({
    target: `${packageId}::user_account::log_trade_detailed`,
    arguments: [
      tx.object(params.config.executorCapId),
      tx.object(params.config.accessRegistryId),
      tx.object(params.config.accountRegistryId),
      tx.pure.id(params.accountId),
      tx.pure.bool(params.isWin),
      tx.pure.u64(params.pnl),
      tx.pure.string(params.venue),
      tx.pure.string(params.market),
      tx.pure.u8(params.side),
      tx.pure.u64(params.sizeUsd),
      tx.pure.u64(params.leverage),
      tx.pure.u64(params.entryPrice),
      tx.pure.u64(params.exitPrice),
      tx.pure.u64(params.entryFee),
      tx.pure.u64(params.fundingPaid),
      tx.pure.bool(params.fundingIsCredit),
      tx.pure.u8(params.closeReason),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/**
 * Assembles an executor-gated lifecycle call that takes only the account id
 * (`pass_evaluation`, `fail_evaluation`, `register_dd_breach`). The contract arg
 * order is identical across the three: cap, access registry, account registry,
 * account id, clock.
 */
function buildLifecycleTransaction(
  config: WriteConfig,
  fn: "pass_evaluation" | "fail_evaluation" | "register_dd_breach",
  accountId: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::user_account::${fn}`,
    arguments: [
      tx.object(config.executorCapId),
      tx.object(config.accessRegistryId),
      tx.object(config.accountRegistryId),
      tx.pure.id(accountId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/** Marks the account's evaluation passed (equity must already meet the target). */
export function buildPassEvaluationTransaction(
  config: WriteConfig,
  accountId: string,
): Transaction {
  return buildLifecycleTransaction(config, "pass_evaluation", accountId);
}

/** Marks the account's evaluation failed. */
export function buildFailEvaluationTransaction(
  config: WriteConfig,
  accountId: string,
): Transaction {
  return buildLifecycleTransaction(config, "fail_evaluation", accountId);
}

/**
 * Suspends the account for an off-chain risk event the engine caught outside the
 * realized per-trade gates — e.g. an unrealized-equity drawdown breach that
 * on-chain `log_trade` (realized PnL only) would never see.
 */
export function buildRegisterBreachTransaction(
  config: WriteConfig,
  accountId: string,
): Transaction {
  return buildLifecycleTransaction(config, "register_dd_breach", accountId);
}
