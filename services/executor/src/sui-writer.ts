import {
  createGrpcClient,
  type ExecutorSuiConfig,
  PropfirmExecutor,
  type SuiNetwork,
} from "@shared/sui-propfirm";
import type { LogTradeParams, OnChainResult, OnChainWriter } from "./onchain.js";

/**
 * The real on-chain writer: it holds the firm executor key and signs the
 * `log_trade` / `pass` / `fail` / `register_dd_breach` calls through the shared
 * `PropfirmExecutor` — the exact same code path the trader app's API routes sign
 * with, so the two can never drift on the write ABI. Swapped in for
 * `StubOnChainWriter` once the executor's Sui env is set.
 */
export class SuiOnChainWriter implements OnChainWriter {
  private readonly executor: PropfirmExecutor;

  constructor(config: ExecutorSuiConfig) {
    this.executor = new PropfirmExecutor(
      createGrpcClient(config.network, config.grpcUrl),
      config,
    );
  }

  logTrade(params: LogTradeParams): Promise<OnChainResult> {
    return this.executor.logTrade(params);
  }

  passEvaluation(accountId: string): Promise<OnChainResult> {
    return this.executor.passEvaluation(accountId);
  }

  failEvaluation(accountId: string): Promise<OnChainResult> {
    return this.executor.failEvaluation(accountId);
  }

  registerBreach(accountId: string): Promise<OnChainResult> {
    return this.executor.registerBreach(accountId);
  }
}

function parseNetwork(raw: string | undefined): SuiNetwork {
  return raw === "mainnet" || raw === "devnet" || raw === "localnet"
    ? raw
    : "testnet";
}

/**
 * Build the executor's Sui config from plain process env. Returns null when any
 * required coordinate is missing, so the bootstrap can fall back to the stub
 * writer (and say so loudly) rather than crash a half-configured deploy.
 */
export function loadExecutorSuiConfig(): ExecutorSuiConfig | null {
  const env = process.env;
  const required = {
    packageId: env.PROPFIRM_PACKAGE_ID,
    accountRegistryId: env.PROPFIRM_ACCOUNT_REGISTRY_ID,
    accessRegistryId: env.PROPFIRM_ACCESS_REGISTRY_ID,
    executorCapId: env.PROPFIRM_EXECUTOR_CAP_ID,
    adminCapId: env.PROPFIRM_ADMIN_CAP_ID,
    adminSecretKey: env.SUI_ADMIN_SECRET_KEY,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    console.warn(
      `[executor] Sui write config incomplete (missing ${missing.join(", ")}); on-chain writes are stubbed.`,
    );
    return null;
  }
  return {
    network: parseNetwork(env.SUI_NETWORK),
    grpcUrl: env.SUI_GRPC_URL || null,
    graphqlUrl: env.SUI_GRAPHQL_URL || null,
    packageId: required.packageId as string,
    accountRegistryId: required.accountRegistryId as string,
    accessRegistryId: required.accessRegistryId as string,
    executorCapId: required.executorCapId as string,
    adminCapId: required.adminCapId as string,
    adminSecretKey: required.adminSecretKey as string,
  };
}
