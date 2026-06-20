"use client";

import { useCallback } from "react";
import { userVaultId } from "@/lib/auth";
import type { Side } from "@/lib/mock/types";
import { useAccountSetup } from "@/lib/sui/useTradingAccount";

/**
 * Resolves where a "trade this market" CTA should go, based on whether the
 * trader already holds an on-chain account. One who does drops straight into
 * their cockpit (their live evaluation); everyone else lands on the tier picker
 * to open one. An optional symbol/side rides along as a deep-link either way.
 *
 * Returns a builder so a table can call the hook once and stamp every row.
 */
export function useTradeHref() {
  const { hasAccount, suiAddress } = useAccountSetup();
  return useCallback(
    (opts?: { symbol?: string; side?: Side }) => {
      const base =
        hasAccount && suiAddress
          ? `/evaluation/${userVaultId(suiAddress)}`
          : "/start";
      const params = new URLSearchParams();
      if (opts?.symbol) params.set("symbol", opts.symbol);
      if (opts?.side) params.set("side", opts.side);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
    [hasAccount, suiAddress],
  );
}
