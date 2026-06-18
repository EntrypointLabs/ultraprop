import type { User } from "@privy-io/react-auth";

/**
 * Dev/test-only escape hatch: allow trading the shared demo vault WITHOUT a Privy
 * session, purely so the order→position→close loop can be exercised in a headless
 * browser (real Privy OTP/OAuth can't complete there). OFF by default — an
 * evaluation is identity-attributable (and, in v2, on-chain-recorded via
 * `log_trade`), so real users MUST authenticate to trade. Never enable in prod.
 */
export const DEMO_TRADING_ENABLED =
  process.env.NEXT_PUBLIC_DEMO_TRADING === "true";

/**
 * Privy's linked-account union doesn't statically expose `chainType`, so we
 * read the embedded-wallet accounts loosely. A Sui wallet is provisioned via
 * `@privy-io/react-auth/extended-chains`, which tags the account `chainType: "sui"`.
 */
type LooseAccount = { type?: string; chainType?: string; address?: string };

export function suiWalletAddress(user: User | null | undefined): string | null {
  const accounts = (user?.linkedAccounts ?? []) as LooseAccount[];
  for (const account of accounts) {
    if (account.type === "wallet" && account.chainType === "sui") {
      return account.address ?? null;
    }
  }
  return null;
}

export function hasSuiWallet(user: User | null | undefined): boolean {
  return suiWalletAddress(user) !== null;
}

/** A short, human-readable line for a Privy auth error. */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * The per-user paper vault id derived from a signed-in session address. Lowercased
 * and stripped to `[a-z0-9]` so the id is route-safe and stable regardless of the
 * address's hex casing (matching the write path's lowercasing). One persistent
 * vault per wallet; a signed-out visitor uses the shared demo vault instead.
 */
export function userVaultId(address: string): string {
  const sanitized = address.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `vault_${sanitized}`;
}
