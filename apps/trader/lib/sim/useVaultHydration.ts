"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";
import type { OpenPositionDto } from "@/app/api/positions/open/route";
import { suiWalletAddress } from "@/lib/auth";
import type { Position } from "@/lib/mock/types";
import { useSimStore } from "@/lib/sim/store";
import { isSuiConfigured } from "@/lib/sui/config";
import { queryAccountTrades } from "@/lib/sui/tradeEvents";
import { useTradingAccount } from "@/lib/sui/useTradingAccount";

/**
 * Cross-device rehydration. On a fresh device (empty localStorage) this fills
 * the cockpit's freshly-opened, empty vault with the trader's real record:
 * realized closes + equity anchors from the on-chain `TradeSettled` log, and the
 * open positions from the server ledger (the chain can't hold live positions).
 * Runs once per resolved account and no-ops when the vault already carries local
 * trades — a device that has traded keeps what it has.
 */
export function useVaultHydration(vaultId: string): void {
  const { user, getAccessToken } = usePrivy();
  const suiAddress = suiWalletAddress(user);
  const { data: accountId } = useTradingAccount(suiAddress);
  const hydrated = useSimStore((s) => s.hydrated);

  // Keep the token getter in a ref so resolving it never re-runs the effect.
  const getToken = useRef(getAccessToken);
  getToken.current = getAccessToken;
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || !accountId || !isSuiConfigured()) return;
    if (ranFor.current === accountId) return;

    // A device that already traded keeps its local record (and the bridge keeps
    // it on-chain); only a fresh, empty vault needs rebuilding.
    const existing = useSimStore.getState().vaults[vaultId];
    if (existing && (existing.trades.length > 0 || existing.positions.length > 0))
      return;

    ranFor.current = accountId;
    let cancelled = false;

    void (async () => {
      const [history, openPositions] = await Promise.all([
        queryAccountTrades(accountId).catch(() => ({
          trades: [],
          equityCurve: [],
        })),
        fetchOpenPositions(accountId, getToken.current).catch(() => []),
      ]);
      if (cancelled) return;
      if (history.trades.length === 0 && openPositions.length === 0) return;
      useSimStore.getState().hydrateVault(
        vaultId,
        {
          trades: history.trades,
          equityCurve: history.equityCurve,
          openPositions,
        },
        Date.now(),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, accountId, vaultId]);
}

type TokenGetter = () => Promise<string | null>;

/** Loads the account's open positions from the server ledger as live Positions. */
async function fetchOpenPositions(
  accountId: string,
  getToken: TokenGetter,
): Promise<Position[]> {
  const token = await getToken();
  if (!token) return [];
  const res = await fetch(
    `/api/positions/open?accountId=${encodeURIComponent(accountId)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({}))) as {
    positions?: OpenPositionDto[];
  };
  return (data.positions ?? []).map(toPosition);
}

/** A server-ledger open position as the engine's live Position. The mark,
 * unrealized PnL and liquidation price are filled in by the next engine tick. */
function toPosition(dto: OpenPositionDto): Position {
  return {
    id: dto.id,
    symbol: dto.symbol as Position["symbol"],
    side: dto.side,
    sizeUsd: dto.sizeUsd,
    entryPrice: dto.entryPrice,
    markPrice: dto.entryPrice,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    openedAt: dto.openedAt,
    marginMode: dto.marginMode,
    leverage: dto.leverage,
    entryFeeUsd: dto.entryFeeUsd,
    lastFundedAt: dto.lastFundedAt,
    fundingPaid: dto.fundingPaid,
    liquidationPrice: null,
    marginRatio: null,
    takeProfit: dto.takeProfit,
    stopLoss: dto.stopLoss,
    bracketExpiresAt: null,
  };
}
