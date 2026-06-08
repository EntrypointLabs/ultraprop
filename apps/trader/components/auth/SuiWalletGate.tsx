"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";
import * as React from "react";
import { hasSuiWallet } from "@/lib/auth";

/**
 * Provisions a Sui embedded wallet behind the scenes the first time a user is
 * authenticated without one. Renders nothing; the wallet is infrastructure, not
 * a feature the trader sees (per the product's "chain is plumbing" principle).
 */
export function SuiWalletGate() {
  const { ready, authenticated, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const attempted = React.useRef(false);

  React.useEffect(() => {
    if (!ready || !authenticated || attempted.current) return;
    if (hasSuiWallet(user)) {
      attempted.current = true;
      return;
    }
    attempted.current = true;
    createWallet({ chainType: "sui" }).catch(() => {
      // Allow a later retry (e.g. transient network failure on provisioning).
      attempted.current = false;
    });
  }, [ready, authenticated, user, createWallet]);

  return null;
}
