/**
 * The on-chain coordinates and constants for the deployed propfirm package,
 * shared by every server that signs executor-gated calls — the trader app's API
 * routes and the standalone executor service. This package is env-free on
 * purpose: callers build the config from THEIR own environment (the app from its
 * `NEXT_PUBLIC_*` + server vars, the executor from plain process env) and pass it
 * in, so the static-inlining rules of one host never constrain the other.
 */

export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

export type TierName = "starter" | "basic" | "pro" | "elite" | "whale";

export const TIER_NAMES: readonly TierName[] = [
  "starter",
  "basic",
  "pro",
  "elite",
  "whale",
];

/** The well-known shared `Clock` object, the same on every Sui network. */
export const CLOCK_OBJECT_ID = "0x6";

/** The shared-object ids a write transaction references. */
export interface WriteConfig {
  packageId: string;
  /**
   * The LATEST package version id, set after an in-place upgrade. Calls to
   * functions introduced by the upgrade (e.g. `log_trade_detailed`) must target
   * it; pre-upgrade functions and all struct/event TYPE tags keep using the
   * original `packageId`. Falls back to `packageId` when unset (no upgrade yet).
   */
  packageIdLatest?: string;
  accountRegistryId: string;
  accessRegistryId: string;
  executorCapId: string;
  adminCapId: string;
}

/** Everything the executor write path needs: where to send, and the firm key. */
export interface ExecutorSuiConfig extends WriteConfig {
  network: SuiNetwork;
  grpcUrl?: string | null;
  graphqlUrl?: string | null;
  adminSecretKey: string;
}
