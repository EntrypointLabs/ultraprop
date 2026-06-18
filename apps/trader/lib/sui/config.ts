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
  defaultTier: TierName;
}

function env(name: string): string {
  return (process.env[name] ?? "").trim();
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
  const network = env("NEXT_PUBLIC_SUI_NETWORK").toLowerCase();
  return {
    network:
      network === "mainnet" || network === "devnet" || network === "localnet"
        ? network
        : "testnet",
    rpcUrl: env("NEXT_PUBLIC_SUI_RPC_URL") || null,
    packageId: env("NEXT_PUBLIC_PROPFIRM_PACKAGE_ID"),
    accountRegistryId: env("NEXT_PUBLIC_PROPFIRM_ACCOUNT_REGISTRY_ID"),
    accessRegistryId: env("NEXT_PUBLIC_PROPFIRM_ACCESS_REGISTRY_ID"),
    treasuryId: env("NEXT_PUBLIC_PROPFIRM_TREASURY_ID"),
    tierConfigId: env("NEXT_PUBLIC_PROPFIRM_TIER_CONFIG_ID"),
    usdcType: env("NEXT_PUBLIC_PROPFIRM_USDC_TYPE"),
    defaultTier: parseTier(env("NEXT_PUBLIC_PROPFIRM_DEFAULT_TIER"), "starter"),
  };
}

/** True once the public package coordinates needed to read accounts are set. */
export function isSuiConfigured(): boolean {
  const c = publicSuiConfig();
  return Boolean(c.packageId && c.accountRegistryId);
}

export interface ServerSuiConfig extends PublicSuiConfig {
  adminSecretKey: string;
  adminCapId: string;
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
    adminSecretKey: need(env("SUI_ADMIN_SECRET_KEY"), "SUI_ADMIN_SECRET_KEY"),
    adminCapId: need(env("PROPFIRM_ADMIN_CAP_ID"), "PROPFIRM_ADMIN_CAP_ID"),
  };

  if (missing.length > 0) {
    throw new Error(
      `Sui onboarding is not configured. Set: ${missing.join(", ")}.`,
    );
  }
  return config;
}
