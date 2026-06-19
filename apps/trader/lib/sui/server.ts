import "server-only";

import type { SuiClientTypes } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import { getGraphQLClient, getGrpcClient } from "./client";
import {
  type ServerSuiConfig,
  serverSuiConfig,
  type TierName,
} from "./config";
import {
  buildFailEvaluationTransaction,
  buildLogTradeTransaction,
  buildOpenAccountTransaction,
  buildPassEvaluationTransaction,
  buildRegisterBreachTransaction,
  fetchEvalFee,
  getTradingAccountId,
  parseAccountCreatedId,
} from "./propfirm";

/**
 * Loads the firm's admin keypair from `SUI_ADMIN_SECRET_KEY`. Accepts the
 * bech32 form `sui keytool` exports (`suiprivkey1...`) or a base64 secret with
 * an optional leading scheme-flag byte.
 */
function loadAdminKeypair(secret: string): Ed25519Keypair {
  const value = secret.trim();
  if (value.startsWith("suiprivkey")) {
    return Ed25519Keypair.fromSecretKey(value);
  }
  const bytes = fromBase64(value);
  const raw = bytes.length === 33 ? bytes.slice(1) : bytes;
  return Ed25519Keypair.fromSecretKey(raw);
}

/**
 * Unwraps the unified `executeTransaction` result, throwing the on-chain abort
 * message on failure. The result is a `$kind`-discriminated union: a
 * `FailedTransaction`, or a `Transaction` that may still carry a non-success
 * effects status — both are surfaced as the same error so callers see one shape.
 */
function expectExecuted<Include extends SuiClientTypes.TransactionInclude>(
  result: SuiClientTypes.TransactionResult<Include>,
  context: string,
): SuiClientTypes.Transaction<Include> {
  const tx =
    result.$kind === "Transaction"
      ? result.Transaction
      : result.FailedTransaction;
  if (result.$kind !== "Transaction" || !tx.status.success) {
    const error = tx.status.error?.message ?? "unknown error";
    throw new Error(`${context}: ${error}`);
  }
  return tx;
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
 * (`openTradingAccount`) and the new fee-first/invite onboarding
 * (`onboardWithPayment`/`onboardWithInvite`), which gate WHO is allowed to reach
 * it but mint the account identically.
 */
export async function adminOpenAccount(
  owner: string,
  tier: TierName,
): Promise<OpenAccountResult> {
  const config = serverSuiConfig();
  const reader = getGraphQLClient();

  const existing = await getTradingAccountId(reader, owner, config.packageId);
  if (existing) return { accountId: existing, created: false };

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

/** True for a syntactically valid Sui object id: `0x` + up to 64 hex digits. */
function isAccountId(value: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(value.trim());
}

/**
 * Signs and executes an executor-gated transaction with the firm's keypair (the
 * deployer holds both the admin and executor caps). Returns the digest, throwing
 * the on-chain abort message on failure so the route can surface it.
 */
async function executeAsExecutor(
  config: ServerSuiConfig,
  build: (cfg: ServerSuiConfig) => Transaction,
): Promise<string> {
  const keypair = loadAdminKeypair(config.adminSecretKey);
  const tx = build(config);
  tx.setSender(keypair.toSuiAddress());

  const result = await getGrpcClient().signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    include: { effects: true },
  });
  return expectExecuted(result, "On-chain call failed").digest;
}

export interface ExecutorResult {
  digest: string;
}

/**
 * Records a closed trade on-chain. `pnl` is the absolute realized PnL in USDC
 * base units (6 dp); the sign is carried by `isWin`. The chain applies it to
 * equity and enforces the realized risk gates.
 */
export async function logTrade(params: {
  accountId: string;
  isWin: boolean;
  pnl: bigint;
  venue: string;
  market: string;
}): Promise<ExecutorResult> {
  const config = serverSuiConfig();
  if (!isAccountId(params.accountId)) {
    throw new Error("Invalid account id.");
  }
  const digest = await executeAsExecutor(config, (cfg) =>
    buildLogTradeTransaction({ config: cfg, ...params }),
  );
  return { digest };
}

/** Marks the account's evaluation passed on-chain. */
export async function passEvaluation(
  accountId: string,
): Promise<ExecutorResult> {
  const config = serverSuiConfig();
  if (!isAccountId(accountId)) throw new Error("Invalid account id.");
  const digest = await executeAsExecutor(config, (cfg) =>
    buildPassEvaluationTransaction(cfg, accountId),
  );
  return { digest };
}

/** Marks the account's evaluation failed on-chain. */
export async function failEvaluation(
  accountId: string,
): Promise<ExecutorResult> {
  const config = serverSuiConfig();
  if (!isAccountId(accountId)) throw new Error("Invalid account id.");
  const digest = await executeAsExecutor(config, (cfg) =>
    buildFailEvaluationTransaction(cfg, accountId),
  );
  return { digest };
}

/** Suspends the account for an off-chain (unrealized) drawdown breach. */
export async function registerBreach(
  accountId: string,
): Promise<ExecutorResult> {
  const config = serverSuiConfig();
  if (!isAccountId(accountId)) throw new Error("Invalid account id.");
  const digest = await executeAsExecutor(config, (cfg) =>
    buildRegisterBreachTransaction(cfg, accountId),
  );
  return { digest };
}
