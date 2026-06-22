import { useVault } from "@/lib/mock/hooks";
import type { VaultStatus } from "@/lib/mock/types";
import { statusFromCode } from "@/lib/sui/onchainRules";
import { useOnchainAccountSummary } from "@/lib/sui/useTradingAccount";

/**
 * The single source of truth for terminal routing. The cockpit redirects on
 * this value and each terminal page guards on it, so they can never disagree —
 * a mismatch (e.g. on-chain reads "failed" while the local sim vault is still
 * "active") is exactly what produces an infinite cockpit ⇄ terminal redirect
 * loop.
 *
 * On-chain status is authoritative when an account exists; the engine status is
 * the fallback for the signed-out demo / unconfigured package. A local pause
 * ("inactive") has no on-chain notion, so it's preserved while the chain still
 * reads Evaluating.
 */
export function useAuthoritativeStatus(vaultId: string): VaultStatus {
  const vault = useVault(vaultId);
  const { summary: onchainSummary } = useOnchainAccountSummary();

  const chainStatus =
    onchainSummary != null ? statusFromCode(onchainSummary.statusCode) : null;

  if (chainStatus == null) return vault.status;
  if (chainStatus === "active" && vault.status === "inactive")
    return "inactive";
  return chainStatus;
}
