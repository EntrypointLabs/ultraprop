"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";
import * as React from "react";
import { hasSuiWallet } from "@/lib/auth";

export interface SuiWalletProvision {
  /** A provisioning attempt is currently in flight. */
  pending: boolean;
  /** The last attempt failed; the wallet still doesn't exist. */
  error: string | null;
  /** Re-attempt provisioning after a failure. */
  retry: () => void;
}

/**
 * Provisions the user's Sui embedded wallet once they're authenticated without
 * one, and surfaces failure so onboarding can offer a retry instead of hanging.
 * A failed attempt is recoverable: `retry()` re-arms a fresh attempt.
 */
export function useSuiWalletProvision(): SuiWalletProvision {
  const { ready, authenticated, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const inFlight = React.useRef(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Bumping this re-runs the provisioning effect after a failure.
  const [attempt, setAttempt] = React.useState(0);

  // `attempt` is intentional: retry() bumps it to re-run provisioning.
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry trigger
  React.useEffect(() => {
    if (!ready || !authenticated) return;
    if (hasSuiWallet(user)) {
      setPending(false);
      setError(null);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    createWallet({ chainType: "sui" })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "We couldn't set up your wallet. Please try again.",
        );
      })
      .finally(() => {
        inFlight.current = false;
        setPending(false);
      });
  }, [ready, authenticated, user, createWallet, attempt]);

  const retry = React.useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { pending, error, retry };
}
