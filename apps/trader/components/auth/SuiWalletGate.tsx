"use client";

import { useSuiWalletProvision } from "@/lib/sui/useSuiWalletProvision";

/**
 * Provisions a Sui embedded wallet behind the scenes the first time a user is
 * authenticated without one. Renders nothing; the wallet is infrastructure, not
 * a feature the trader sees (per the product's "chain is plumbing" principle).
 * Onboarding surfaces any failure + retry via the same `useSuiWalletProvision`.
 */
export function SuiWalletGate() {
  useSuiWalletProvision();
  return null;
}
