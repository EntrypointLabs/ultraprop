"use client";

import { AlertTriangle, Search } from "lucide-react";
import { useState } from "react";
import { MarketsTable } from "@/components/markets/MarketsTable";
import {
  Card,
  CardHeader,
  CardLabel,
  ConnectionDot,
  Input,
  Toggle,
} from "@/components/ui";
import { useFavorites } from "@/lib/mock/favorites";
import { useConnection, useMarketCatalogQuery } from "@/lib/mock/hooks";

/**
 * The full-catalog markets browser: searchable, favoritable, and backed by the
 * live `useMarketCatalog()` universe (not the 3-market feed snapshot). Search
 * filters by ticker or name; the favorites toggle narrows to starred markets,
 * which are persisted and shared with the home spotlight.
 */
export function MarketsBrowser() {
  const connStatus = useConnection();
  const { markets: catalog, isError: catalogError } = useMarketCatalogQuery();
  const { favorites, toggleFavorite } = useFavorites();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const tradeable = catalog.filter((m) => !m.isDelisted).length;

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
        <span className="text-xs text-text-faint">
          {tradeable} Hyperliquid perps
        </span>
      </CardHeader>

      {/* Catalog load failure — non-blocking; the seed subset still renders below */}
      {catalogError && (
        <div className="flex items-center gap-2 border-b border-warn/30 bg-warn/10 px-4 py-2.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn" />
          <span className="text-xs text-warn">
            Couldn't load the full catalog — showing a subset.
          </span>
        </div>
      )}

      {/* Search + favorites filter */}
      <div className="flex flex-col gap-3 border-b border-border-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-faint" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search markets — BTC, ETH, SOL…"
            aria-label="Search markets"
            className="pl-8"
          />
        </div>
        <Toggle
          checked={showFavoritesOnly}
          onCheckedChange={setShowFavoritesOnly}
          label="Favorites only"
        />
      </div>

      <MarketsTable
        searchQuery={searchQuery}
        showFavoritesOnly={showFavoritesOnly}
        favorites={favorites}
        onToggleFav={toggleFavorite}
      />

      <div className="flex items-center justify-between border-t border-border-soft px-4 py-2.5 text-xs text-text-faint">
        <span>v1 · Hyperliquid perps</span>
        <span>+2 bps house tilt on all fills</span>
      </div>
    </Card>
  );
}
