"use client";

import { MarketsTable } from "@/components/markets/MarketsTable";
import { Card, CardHeader, CardLabel, ConnectionDot } from "@/components/ui";
import { useFavorites } from "@/lib/mock/favorites";
import { useConnection } from "@/lib/mock/hooks";
import type { MarketId } from "@/lib/mock/types";

/** The home spotlight stays small — the full universe lives on /markets. */
const SPOTLIGHT_MARKETS: MarketId[] = [
  "hyperliquid:BTC",
  "hyperliquid:ETH",
  "hyperliquid:SOL",
];

export function HomeMarketsTable() {
  const connStatus = useConnection();
  const { favorites, toggleFavorite } = useFavorites();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardLabel>Live markets</CardLabel>
          <ConnectionDot status={connStatus} showLabel={false} />
          <span className="text-xs capitalize text-text-muted">
            {connStatus}
          </span>
        </div>
        <span className="text-xs text-text-faint">Bluefin · DeepBook · Hyperliquid perps</span>
      </CardHeader>
      <MarketsTable
        searchQuery=""
        showFavoritesOnly={false}
        favorites={favorites}
        onToggleFav={toggleFavorite}
        marketIds={SPOTLIGHT_MARKETS}
      />
      <div className="flex items-center justify-between border-t border-border-soft px-4 py-2.5 text-xs text-text-faint">
        <span>v1 · Bluefin, DeepBook &amp; Hyperliquid perps</span>
        <span>+2 bps house tilt on all fills</span>
      </div>
    </Card>
  );
}
