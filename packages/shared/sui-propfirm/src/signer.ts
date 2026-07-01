import type { SuiClientTypes } from "@mysten/sui/client";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import type { ExecutorSuiConfig } from "./config.js";
import {
  buildFailEvaluationTransaction,
  buildLogTradeDetailedTransaction,
  buildLogTradeTransaction,
  buildPassEvaluationTransaction,
  buildReactivateTransaction,
  buildRegisterBreachTransaction,
} from "./transactions.js";

/**
 * Loads the firm's admin keypair. Accepts the bech32 form `sui keytool` exports
 * (`suiprivkey1...`) or a base64 secret with an optional leading scheme-flag byte.
 */
export function loadAdminKeypair(secret: string): Ed25519Keypair {
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
 * effects status — both surface as the same error so callers see one shape.
 */
export function expectExecuted<
  Include extends SuiClientTypes.TransactionInclude,
>(
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

export interface ExecutorResult {
  digest: string;
}

export interface LogTradeParams {
  accountId: string;
  isWin: boolean;
  pnl: bigint;
  venue: string;
  market: string;
}

/**
 * Full closed-trade detail for `log_trade_detailed`. The extra fields beyond
 * `LogTradeParams` ride only in the `TradeSettled` event. All USD/price/leverage
 * values are u64 fixed-point at 1e6; `pnl`/`fundingPaid` are magnitudes whose
 * signs live in `isWin`/`fundingIsCredit`.
 */
export interface LogTradeDetailedParams extends LogTradeParams {
  /** 0 = long, 1 = short */
  side: number;
  sizeUsd: bigint;
  leverage: bigint;
  entryPrice: bigint;
  exitPrice: bigint;
  entryFee: bigint;
  fundingPaid: bigint;
  fundingIsCredit: boolean;
  /** 0 = manual, 1 = tp, 2 = sl, 3 = liquidation */
  closeReason: number;
}

/** True for a syntactically valid Sui object id: `0x` + up to 64 hex digits. */
function isAccountId(value: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(value.trim());
}

/**
 * Signs and executes the executor-gated (and admin-gated `reactivate`) calls with
 * the firm keypair, which holds both the admin and executor caps. One instance
 * binds a gRPC client and a config; the trader app constructs it from its server
 * config, the executor service from its env. Each method throws the on-chain
 * abort message on failure so the caller can surface it.
 */
export class PropfirmExecutor {
  constructor(
    private readonly grpc: SuiGrpcClient,
    private readonly config: ExecutorSuiConfig,
  ) {}

  private async exec(
    build: (config: ExecutorSuiConfig) => Transaction,
  ): Promise<string> {
    const keypair = loadAdminKeypair(this.config.adminSecretKey);
    const tx = build(this.config);
    tx.setSender(keypair.toSuiAddress());
    const result = await this.grpc.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      include: { effects: true },
    });
    return expectExecuted(result, "On-chain call failed").digest;
  }

  async logTrade(params: LogTradeParams): Promise<ExecutorResult> {
    if (!isAccountId(params.accountId)) throw new Error("Invalid account id.");
    const digest = await this.exec((config) =>
      buildLogTradeTransaction({ config, ...params }),
    );
    return { digest };
  }

  async logTradeDetailed(
    params: LogTradeDetailedParams,
  ): Promise<ExecutorResult> {
    if (!isAccountId(params.accountId)) throw new Error("Invalid account id.");
    const digest = await this.exec((config) =>
      buildLogTradeDetailedTransaction({ config, ...params }),
    );
    return { digest };
  }

  async passEvaluation(accountId: string): Promise<ExecutorResult> {
    if (!isAccountId(accountId)) throw new Error("Invalid account id.");
    const digest = await this.exec((config) =>
      buildPassEvaluationTransaction(config, accountId),
    );
    return { digest };
  }

  async failEvaluation(accountId: string): Promise<ExecutorResult> {
    if (!isAccountId(accountId)) throw new Error("Invalid account id.");
    const digest = await this.exec((config) =>
      buildFailEvaluationTransaction(config, accountId),
    );
    return { digest };
  }

  async registerBreach(accountId: string): Promise<ExecutorResult> {
    if (!isAccountId(accountId)) throw new Error("Invalid account id.");
    const digest = await this.exec((config) =>
      buildRegisterBreachTransaction(config, accountId),
    );
    return { digest };
  }

  async reactivate(accountId: string): Promise<ExecutorResult> {
    if (!isAccountId(accountId)) throw new Error("Invalid account id.");
    const digest = await this.exec((config) =>
      buildReactivateTransaction(config, accountId),
    );
    return { digest };
  }
}
