"use client";

import { useState } from "react";
import { MarketsTable } from "@/components/markets/MarketsTable";
import { Card, CardHeader, CardLabel, ConnectionDot } from "@/components/ui";
import { useConnection } from "@/lib/mock/hooks";
import type { Symbol } from "@/lib/mock/types";

export function HomeMarketsTable() {
  const connStatus = useConnection();
  const [favorites, setFavorites] = useState<Set<Symbol>>(new Set(["BTC"]));

  function toggleFav(sym: Symbol) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardLabel>Live markets</CardLabel>
          <ConnectionDot status={connStatus} showLabel={false} />
          <span className="text-xs capitalize text-text-muted">{connStatus}</span>
        </div>
        <span className="text-xs text-text-faint">BTC / ETH / SOL spot</span>
      </CardHeader>
      <MarketsTable
        searchQuery=""
        showFavoritesOnly={false}
        favorites={favorites}
        onToggleFav={toggleFav}
      />
      <div className="flex items-center justify-between border-t border-border-soft px-4 py-2.5 text-xs text-text-faint">
        <span>v1 · BTC / ETH / SOL spot only</span>
        <span>+2 bps house tilt on all fills</span>
      </div>
    </Card>
  );
}
