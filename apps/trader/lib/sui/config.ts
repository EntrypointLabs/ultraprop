/**
 * Resolves the on-chain coordinates of the deployed propfirm package from the
 * environment. Public ids (package, shared objects, USDC type, RPC) are exposed
 * to the browser via `NEXT_PUBLIC_*` so the client can read account state
 * directly; the admin secret and admin-cap id are server-only and live in
 * `serverSuiConfig` so they can never be bundled into client code.
 */

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

export interface PublicSuiConfig {
  network: "mainnet" | "testnet" | "devnet" | "localnet";
  rpcUrl: string | null;
  packageId: string;
  accountRegistryId: string;
  accessRegistryId: string;
  treasuryId: string;
  tierConfigId: string;
  usdcType: string;
  /** Shared mock-USDC `Faucet` object id; the user calls `faucet` on it to mint
   * test dollars before paying their evaluation fee. Testnet only. */
  usdcFaucetId: string;
  /** The firm's eval-funds destination address. The user transfers their fee
   * here in the PAID onboarding path; the server verifies the payment landed on
   * it before admin-signing `open_account`. */
  evalFundsAddress: string;
  defaultTier: TierName;
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function parseTier(value: string, fallback: TierName): TierName {
  const v = value.toLowerCase();
  return (TIER_NAMES as readonly string[]).includes(v)
    ? (v as TierName)
    : fallback;
}

/**
 * The public on-chain coordinates. Safe to call from client or server. Fields
 * are empty strings when unset; gate real reads behind `isSuiConfigured()`.
 */
export function publicSuiConfig(): PublicSuiConfig {
  // Each NEXT_PUBLIC_* is read via static `process.env.X` access so Next inlines
  // it into the client bundle. A dynamic `process.env[name]` lookup is NOT
  // replaced for the browser and would read as empty client-side.
  const network = clean(process.env.NEXT_PUBLIC_SUI_NETWORK).toLowerCase();
  return {
    network:
      network === "mainnet" || network === "devnet" || network === "localnet"
        ? network
        : "testnet",
    rpcUrl: clean(process.env.NEXT_PUBLIC_SUI_RPC_URL) || null,
    packageId: clean(process.env.NEXT_PUBLIC_PROPFIRM_PACKAGE_ID),
    accountRegistryId: clean(process.env.NEXT_PUBLIC_PROPFIRM_ACCOUNT_REGISTRY_ID),
    accessRegistryId: clean(process.env.NEXT_PUBLIC_PROPFIRM_ACCESS_REGISTRY_ID),
    treasuryId: clean(process.env.NEXT_PUBLIC_PROPFIRM_TREASURY_ID),
    tierConfigId: clean(process.env.NEXT_PUBLIC_PROPFIRM_TIER_CONFIG_ID),
    usdcType: clean(process.env.NEXT_PUBLIC_PROPFIRM_USDC_TYPE),
    usdcFaucetId: clean(process.env.NEXT_PUBLIC_PROPFIRM_USDC_FAUCET_ID),
    evalFundsAddress: clean(process.env.NEXT_PUBLIC_PROPFIRM_EVAL_FUNDS_ADDRESS),
    defaultTier: parseTier(
      clean(process.env.NEXT_PUBLIC_PROPFIRM_DEFAULT_TIER),
      "starter",
    ),
  };
}

/** True once the public package coordinates needed to read accounts are set. */
export function isSuiConfigured(): boolean {
  const c = publicSuiConfig();
  return Boolean(c.packageId && c.accountRegistryId);
}

/**
 * True once the extra coordinates the PAID onboarding flow needs are set: the
 * USDC type, the faucet to mint test dollars from, and the firm address the fee
 * is paid to. Gates the "Get test USDC" / "Pay & start" UI so it only appears
 * when the user can actually complete it.
 */
export function isOnboardingPaymentConfigured(): boolean {
  const c = publicSuiConfig();
  return (
    isSuiConfigured() &&
    Boolean(c.usdcType && c.usdcFaucetId && c.evalFundsAddress)
  );
}

export interface ServerSuiConfig extends PublicSuiConfig {
  adminSecretKey: string;
  adminCapId: string;
  executorCapId: string;
}

/**
 * The full config including admin authority. Throws if a required value is
 * missing, since onboarding cannot proceed without it. Server-only — importing
 * this into a client component will leak the admin key, so it lives here behind
 * a function that reads non-public env.
 */
export function serverSuiConfig(): ServerSuiConfig {
  const base = publicSuiConfig();
  const missing: string[] = [];
  const need = (value: string, name: string): string => {
    if (!value) missing.push(name);
    return value;
  };

  const config: ServerSuiConfig = {
    ...base,
    packageId: need(base.packageId, "NEXT_PUBLIC_PROPFIRM_PACKAGE_ID"),
    accountRegistryId: need(
      base.accountRegistryId,
      "NEXT_PUBLIC_PROPFIRM_ACCOUNT_REGISTRY_ID",
    ),
    accessRegistryId: need(
      base.accessRegistryId,
      "NEXT_PUBLIC_PROPFIRM_ACCESS_REGISTRY_ID",
    ),
    treasuryId: need(base.treasuryId, "NEXT_PUBLIC_PROPFIRM_TREASURY_ID"),
    tierConfigId: need(
      base.tierConfigId,
      "NEXT_PUBLIC_PROPFIRM_TIER_CONFIG_ID",
    ),
    usdcType: need(base.usdcType, "NEXT_PUBLIC_PROPFIRM_USDC_TYPE"),
    evalFundsAddress: need(
      base.evalFundsAddress,
      "NEXT_PUBLIC_PROPFIRM_EVAL_FUNDS_ADDRESS",
    ),
    adminSecretKey: need(
      clean(process.env.SUI_ADMIN_SECRET_KEY),
      "SUI_ADMIN_SECRET_KEY",
    ),
    adminCapId: need(
      clean(process.env.PROPFIRM_ADMIN_CAP_ID),
      "PROPFIRM_ADMIN_CAP_ID",
    ),
    executorCapId: need(
      clean(process.env.PROPFIRM_EXECUTOR_CAP_ID),
      "PROPFIRM_EXECUTOR_CAP_ID",
    ),
  };

  if (missing.length > 0) {
    throw new Error(
      `Sui onboarding is not configured. Set: ${missing.join(", ")}.`,
    );
  }
  return config;
}
