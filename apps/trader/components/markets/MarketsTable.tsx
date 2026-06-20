"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import {
  AssetIcon,
  Badge,
  Button,
  ConnectionDot,
  Sparkline,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
} from "@/components/ui";
import { useMarketCatalog, usePrices } from "@/lib/mock/hooks";
import { coinOf, getMarket, type Market } from "@/lib/mock/markets";
import type { MarketId, PriceTick } from "@/lib/mock/types";
import { useTradeHref } from "@/lib/trade-link";
import { cn, formatPctOrDash, formatUsdOrDash } from "@/lib/utils";

interface MarketRowProps {
  tick: PriceTick;
  favorited: boolean;
  onToggleFav: () => void;
  /** Resolves the row's Long/Short destination from the trader's account state. */
  tradeHref: ReturnType<typeof useTradeHref>;
}

function usePrevPrice(price: number | null) {
  const prev = React.useRef(price);
  const [flashClass, setFlashClass] = React.useState("");

  React.useEffect(() => {
    if (price == null || prev.current == null || price === prev.current) {
      prev.current = price;
      return;
    }
    const cls = price > prev.current ? "flash-up" : "flash-down";
    setFlashClass(cls);
    prev.current = price;
    const t = setTimeout(() => setFlashClass(""), 700);
    return () => clearTimeout(t);
  }, [price]);

  return flashClass;
}

function MarketRow({
  tick,
  favorited,
  onToggleFav,
  tradeHref,
}: MarketRowProps) {
  const market = getMarket(tick.symbol);
  const ticker = coinOf(tick.symbol);
  const name = market?.name ?? ticker;
  const leverage = market?.maxLeverage ?? 10;
  const hasChange = tick.change24h != null;
  const isUp = (tick.change24h ?? 0) >= 0;
  const flashClass = usePrevPrice(tick.markPx);

  const longHref = tradeHref({ symbol: tick.symbol, side: "long" });
  const shortHref = tradeHref({ symbol: tick.symbol, side: "short" });

  return (
    <Tr>
      {/* Favorite */}
      <Td className="w-10">
        <button
          type="button"
          aria-label={`${favorited ? "Remove" : "Add"} ${ticker} favorite`}
          onClick={onToggleFav}
          className={cn(
            "rounded-sm p-1 transition-colors hover:text-warn",
            favorited ? "text-warn" : "text-text-faint",
          )}
        >
          <Star className={cn("h-3.5 w-3.5", favorited && "fill-warn")} />
        </button>
      </Td>

      {/* Asset */}
      <Td className="min-w-[160px]">
        <div className="flex items-center gap-2.5">
          <AssetIcon symbol={ticker} size={28} />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-text">{ticker}</span>
            <span className="text-xs text-text-muted">{name}</span>
          </div>
        </div>
      </Td>

      {/* Oracle price */}
      <Td numeric>
        <span
          className={cn(
            "tabular text-sm font-semibold",
            tick.markPx == null ? "text-text-faint" : flashClass,
          )}
        >
          {formatUsdOrDash(tick.markPx, {
            decimals:
              tick.markPx == null
                ? 2
                : tick.markPx > 10_000
                  ? 1
                  : tick.markPx > 100
                    ? 2
                    : 4,
          })}
        </span>
      </Td>

      {/* 24h change */}
      <Td numeric className="hidden sm:table-cell">
        <span
          className={cn(
            "tabular text-sm font-medium",
            !hasChange ? "text-text-faint" : isUp ? "text-up" : "text-down",
          )}
        >
          {formatPctOrDash(tick.change24h, { sign: true })}
        </span>
      </Td>

      {/* Sparkline */}
      <Td className="hidden lg:table-cell w-24">
        <Sparkline
          data={tick.spark}
          width={80}
          height={28}
          fill
          tone={!hasChange ? "neutral" : isUp ? "up" : "down"}
        />
      </Td>

      {/* Feed status */}
      <Td className="hidden xl:table-cell">
        <Tooltip content="Market data feed is live and updating" side="top">
          <span>
            <ConnectionDot status="live" showLabel={false} />
          </span>
        </Tooltip>
      </Td>

      {/* Long / Short + leverage badge */}
      <Td className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Badge variant="leverage" className="shrink-0">
            {leverage}X
          </Badge>
          <Link href={longHref}>
            <Button
              variant="long"
              size="sm"
              className="tabular h-7 px-2.5 text-xs font-semibold"
            >
              Long
            </Button>
          </Link>
          <Link href={shortHref}>
            <Button
              variant="short"
              size="sm"
              className="tabular h-7 px-2.5 text-xs font-semibold"
            >
              Short
            </Button>
          </Link>
        </div>
      </Td>
    </Tr>
  );
}

/** Mobile stacked card fallback for small screens */
function MobileAssetCard({
  tick,
  favorited,
  onToggleFav,
  tradeHref,
}: MarketRowProps) {
  const market = getMarket(tick.symbol);
  const ticker = coinOf(tick.symbol);
  const name = market?.name ?? ticker;
  const leverage = market?.maxLeverage ?? 10;
  const hasChange = tick.change24h != null;
  const isUp = (tick.change24h ?? 0) >= 0;
  const flashClass = usePrevPrice(tick.markPx);

  return (
    <div className="border-b border-border-soft last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-label={`${favorited ? "Remove" : "Add"} ${ticker} favorite`}
          onClick={onToggleFav}
          className={cn(
            "shrink-0 rounded-sm p-0.5 transition-colors hover:text-warn",
            favorited ? "text-warn" : "text-text-faint",
          )}
        >
          <Star className={cn("h-3.5 w-3.5", favorited && "fill-warn")} />
        </button>

        <AssetIcon symbol={ticker} size={32} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-text">{ticker}</div>
              <div className="text-xs text-text-muted">{name}</div>
            </div>
            <div className="text-right">
              <div
                className={cn(
                  "tabular text-sm font-semibold",
                  tick.markPx == null ? "text-text-faint" : flashClass,
                )}
              >
                {formatUsdOrDash(tick.markPx, {
                  decimals:
                    tick.markPx == null
                      ? 2
                      : tick.markPx > 10_000
                        ? 1
                        : tick.markPx > 100
                          ? 2
                          : 4,
                })}
              </div>
              <div
                className={cn(
                  "tabular text-xs",
                  !hasChange
                    ? "text-text-faint"
                    : isUp
                      ? "text-up"
                      : "text-down",
                )}
              >
                {formatPctOrDash(tick.change24h, { sign: true })}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <Sparkline
              data={tick.spark}
              width={72}
              height={22}
              fill
              tone={!hasChange ? "neutral" : isUp ? "up" : "down"}
            />
            <div className="flex items-center gap-1.5">
              <Badge variant="leverage">{leverage}X</Badge>
              <Link href={tradeHref({ symbol: tick.symbol, side: "long" })}>
                <Button
                  variant="long"
                  size="sm"
                  className="h-7 px-2.5 text-xs font-semibold"
                >
                  Long
                </Button>
              </Link>
              <Link href={tradeHref({ symbol: tick.symbol, side: "short" })}>
                <Button
                  variant="short"
                  size="sm"
                  className="h-7 px-2.5 text-xs font-semibold"
                >
                  Short
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MarketsTableProps {
  searchQuery: string;
  showFavoritesOnly: boolean;
  favorites: Set<MarketId>;
  onToggleFav: (sym: MarketId) => void;
  /**
   * Restrict the table to a fixed set of market ids (the home spotlight uses
   * this to stay small). When omitted, the FULL live catalog renders.
   */
  marketIds?: MarketId[];
}

/** A live-price placeholder for a catalog market with no feed tick yet. */
function placeholderTick(market: Market): PriceTick {
  return {
    symbol: market.id,
    markPx: null as unknown as number,
    oraclePx: 0,
    midPx: 0,
    fundingRate: 0,
    change24h: null,
    spark: [],
    high24h: null,
    low24h: null,
    ts: 0,
  };
}

export function MarketsTable({
  searchQuery,
  showFavoritesOnly,
  favorites,
  onToggleFav,
  marketIds,
}: MarketsTableProps) {
  // The catalog is the source of breadth (full HL universe); live prices ride
  // on top per market, with a placeholder ("—") until a tick arrives. This is
  // why `/markets` shows the whole universe even before the feed warms up.
  const catalog = useMarketCatalog();
  const prices = usePrices();
  const tradeHref = useTradeHref();

  const rows: PriceTick[] = React.useMemo(() => {
    const byId = new Map(prices.map((p) => [p.symbol, p]));
    const restrict = marketIds ? new Set(marketIds) : null;
    return catalog
      .filter((m) => !m.isDelisted && (!restrict || restrict.has(m.id)))
      .map((m) => byId.get(m.id) ?? placeholderTick(m));
  }, [catalog, prices, marketIds]);

  const filtered = rows.filter((t) => {
    const name = getMarket(t.symbol)?.name ?? t.symbol;
    const matchesSearch =
      searchQuery === "" ||
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFav = !showFavoritesOnly || favorites.has(t.symbol);
    return matchesSearch && matchesFav;
  });

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block">
        <Table>
          <Thead>
            <Tr className="hover:bg-transparent">
              <Th className="w-10" />
              <Th>Asset</Th>
              <Th numeric>Market price</Th>
              <Th numeric className="hidden sm:table-cell">
                24h
              </Th>
              <Th className="hidden lg:table-cell">Trend</Th>
              <Th className="hidden xl:table-cell">Feed</Th>
              <Th className="text-right">Trade</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr>
                <Td colSpan={7} className="py-10 text-center text-text-muted">
                  No markets match your filter.
                </Td>
              </Tr>
            ) : (
              filtered.map((tick) => (
                <MarketRow
                  key={tick.symbol}
                  tick={tick}
                  favorited={favorites.has(tick.symbol)}
                  onToggleFav={() => onToggleFav(tick.symbol)}
                  tradeHref={tradeHref}
                />
              ))
            )}
          </Tbody>
        </Table>
      </div>

      {/* Mobile stacked cards */}
      <div className="sm:hidden">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-text-muted">
            No markets match your filter.
          </div>
        ) : (
          filtered.map((tick) => (
            <MobileAssetCard
              key={tick.symbol}
              tick={tick}
              favorited={favorites.has(tick.symbol)}
              onToggleFav={() => onToggleFav(tick.symbol)}
              tradeHref={tradeHref}
            />
          ))
        )}
      </div>
    </>
  );
}
