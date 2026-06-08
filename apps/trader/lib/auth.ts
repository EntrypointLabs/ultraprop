import type { User } from "@privy-io/react-auth";

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
