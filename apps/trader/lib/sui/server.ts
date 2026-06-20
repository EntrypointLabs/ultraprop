import "server-only";

import {
  expectExecuted,
  loadAdminKeypair,
  PropfirmExecutor,
} from "@shared/sui-propfirm";
import { getGraphQLClient, getGrpcClient } from "./client";
import { serverSuiConfig, type TierName } from "./config";
import { mirrorAccount } from "./ledger";
import {
  buildOpenAccountTransaction,
  fetchEvalFee,
  getTradingAccountId,
  parseAccountCreatedId,
} from "./propfirm";

/**
 * The firm's server-side Sui signer. The on-chain WRITE path (keypair loading,
 * result unwrapping, and the executor-gated `log_trade` / `pass` / `fail` /
 * `register_dd_breach` / `reactivate` calls) lives in `@shared/sui-propfirm` so
 * the standalone executor service signs through the exact same code. This module
 * is the app's adapter: it supplies the server config + gRPC client and keeps the
 * onboarding path (`open_account`), which reads the trader's wallet state.
 */

/** A signer bound to the firm config + gRPC client for the executor-gated calls. */
function propfirmExecutor(): PropfirmExecutor {
  return new PropfirmExecutor(getGrpcClient(), serverSuiConfig());
}

export interface OpenAccountResult {
  accountId: string;
  created: boolean;
  digest?: string;
}

/**
 * The firm-signed `open_account` core: the firm funds the exact tier eval fee
 * from its own USDC, signs the AdminCap-gated call, and transfers the resulting
 * `AccountCap` to `owner`. Shared by the legacy firm-sponsored path
 * (`openTradingAccount`) and the new fee-first/invite onboarding, which gate WHO
 * is allowed to reach it but mint the account identically.
 */
export async function adminOpenAccount(
  owner: string,
  tier: TierName,
): Promise<OpenAccountResult> {
  const config = serverSuiConfig();
  const reader = getGraphQLClient();

  const existing = await getTradingAccountId(reader, owner, config.packageId);
  if (existing) {
    await mirrorAccount(existing, owner, tier);
    return { accountId: existing, created: false };
  }

  const keypair = loadAdminKeypair(config.adminSecretKey);
  const adminAddress = keypair.toSuiAddress();

  const evalFee = await fetchEvalFee(reader, adminAddress, tier, config);

  const { objects: coins } = await reader.listCoins({
    owner: adminAddress,
    coinType: config.usdcType,
  });
  if (coins.length === 0) {
    throw new Error(
      "Onboarding is temporarily unavailable: the firm wallet holds no USDC to cover the evaluation fee.",
    );
  }
  const total = coins.reduce((sum, c) => sum + BigInt(c.balance), 0n);
  if (total < evalFee) {
    throw new Error(
      "Onboarding is temporarily unavailable: the firm wallet has insufficient USDC for the evaluation fee.",
    );
  }

  const tx = buildOpenAccountTransaction({
    config,
    owner,
    tier,
    evalFee,
    usdcCoinIds: coins.map((c) => c.objectId),
  });
  tx.setSender(adminAddress);

  const result = await getGrpcClient().signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    include: { effects: true, events: true },
  });

  const executed = expectExecuted(result, "On-chain account creation failed");

  const accountId =
    parseAccountCreatedId(
      (executed.events ?? []).map((e) => ({
        type: e.eventType,
        parsedJson: e.json ?? undefined,
      })),
      owner,
      config.packageId,
    ) ?? (await getTradingAccountId(reader, owner, config.packageId));
  if (!accountId) {
    throw new Error(
      "Account was created on-chain but its id could not be resolved.",
    );
  }

  await mirrorAccount(accountId, owner, tier);
  return { accountId, created: true, digest: executed.digest };
}

/**
 * Onboards a trader on-chain (legacy firm-sponsored path, used by the
 * "I'll do this later" surface and `/api/account`). Defaults to the configured
 * tier and firm-funds the fee. Idempotent.
 */
export async function openTradingAccount(
  owner: string,
  tier?: TierName,
): Promise<OpenAccountResult> {
  return adminOpenAccount(owner, tier ?? serverSuiConfig().defaultTier);
}

export interface ExecutorResult {
  digest: string;
}

/**
 * Records a closed trade on-chain. `pnl` is the absolute realized PnL in USDC
 * base units (6 dp); the sign is carried by `isWin`. The chain applies it to
 * equity and enforces the realized risk gates.
 */
export function logTrade(params: {
  accountId: string;
  isWin: boolean;
  pnl: bigint;
  venue: string;
  market: string;
}): Promise<ExecutorResult> {
  return propfirmExecutor().logTrade(params);
}

/** Marks the account's evaluation passed on-chain. */
export function passEvaluation(accountId: string): Promise<ExecutorResult> {
  return propfirmExecutor().passEvaluation(accountId);
}

/** Marks the account's evaluation failed on-chain. */
export function failEvaluation(accountId: string): Promise<ExecutorResult> {
  return propfirmExecutor().failEvaluation(accountId);
}

/** Suspends the account for an off-chain (unrealized) drawdown breach. */
export function registerBreach(accountId: string): Promise<ExecutorResult> {
  return propfirmExecutor().registerBreach(accountId);
}

/**
 * Firm-sponsored re-entry: signs the AdminCap-gated `reactivate`, putting a
 * Failed/Suspended account back into evaluation on its existing tier (reputation
 * and history preserved).
 */
export function reactivate(params: {
  accountId: string;
}): Promise<ExecutorResult> {
  return propfirmExecutor().reactivate(params.accountId);
}
