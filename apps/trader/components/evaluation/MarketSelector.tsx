"use client";

import { ChevronDown, Search, Star } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { AssetIcon } from "@/components/ui";
import { useMarketCatalog, useMarkets } from "@/lib/mock/hooks";
import {
  decimalsFor,
  getMarket,
  type Market,
  type MarketId,
} from "@/lib/mock/markets";
import type { PriceTick } from "@/lib/mock/types";
import { cn, formatUsdOrDash, VALUE_UNAVAILABLE } from "@/lib/utils";

/**
 * A command-palette-style market toggle: a dropdown anchored on the active pair
 * that lets a trader search, sort, favorite, and pick any market in the catalog.
 * Modeled on a perp-DEX pair selector but in the desk's restrained palette.
 *
 * Live price / 24h are nullable (the oracle may have no value yet), so the
 * selector reads all ticks once via `useMarkets`, builds a map, sorts with
 * unknown values last, and passes each row its tick — rows never refetch.
 *
 * Favorites persist to localStorage, but the set starts empty on first render
 * (hydrated in an effect) so server and first-client render stay identical.
 */

const FAVORITES_KEY = "trader:favorite-markets";

type Filter = "all" | "favorites";
type SortKey = "default" | "symbol" | "price" | "change" | "leverage";
type SortDir = "asc" | "desc";

type TickMap = Map<MarketId, PriceTick | undefined>;

function useFavorites() {
  const [favorites, setFavorites] = useState<Set<MarketId>>(() => new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) setFavorites(new Set(JSON.parse(raw) as MarketId[]));
    } catch {
      // ignore unreadable/blocked storage — favorites are non-critical
    }
  }, []);

  const toggle = useCallback((id: MarketId) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        // ignore write failures (private mode, quota) — UI state still updates
      }
      return next;
    });
  }, []);

  return { favorites, toggle };
}

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "symbol", label: "Market", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "change", label: "24h", align: "right" },
  { key: "leverage", label: "Max", align: "right" },
];

/** Sort comparator for nullable live values: nulls always sort last. */
function cmpNullable(a: number | null, b: number | null, sign: number): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return sign * (a - b);
}

function sortMarkets(
  markets: Market[],
  sort: { key: SortKey; dir: SortDir },
  ticks: TickMap,
  favorites: Set<MarketId>,
  pinFavorites: boolean,
): Market[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  const sorted = [...markets].sort((a, b) => {
    switch (sort.key) {
      case "symbol":
        return sign * a.symbol.localeCompare(b.symbol);
      case "price":
        return cmpNullable(
          ticks.get(a.id)?.markPx ?? null,
          ticks.get(b.id)?.markPx ?? null,
          sign,
        );
      case "change":
        return cmpNullable(
          ticks.get(a.id)?.change24h ?? null,
          ticks.get(b.id)?.change24h ?? null,
          sign,
        );
      case "leverage":
        return sign * (a.maxLeverage - b.maxLeverage);
      default:
        // catalog order (already liquidity-ranked)
        return 0;
    }
  });
  if (!pinFavorites) return sorted;
  // favorites float to the top while keeping their relative sorted order
  return [
    ...sorted.filter((m) => favorites.has(m.id)),
    ...sorted.filter((m) => !favorites.has(m.id)),
  ];
}

/* -------------------------------------------------------------------------- */
/* Row                                                                          */
/* -------------------------------------------------------------------------- */

function MarketRow({
  market,
  tick,
  optionId,
  active,
  highlighted,
  favorite,
  onSelect,
  onToggleFavorite,
}: {
  market: Market;
  tick: PriceTick | undefined;
  optionId: string;
  active: boolean;
  highlighted: boolean;
  favorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  const price = tick?.markPx ?? null;
  const change = tick?.change24h ?? null;
  const up = (change ?? 0) >= 0;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: listbox keyboard handled by the parent combobox (arrows + Enter)
    <div
      role="option"
      tabIndex={-1}
      id={optionId}
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "group grid cursor-pointer grid-cols-[20px_1fr_auto_64px_48px] items-center gap-2.5 px-2.5 py-2 transition-colors",
        active ? "bg-surface-3" : "hover:bg-surface-2",
        highlighted && !active && "bg-surface-2",
      )}
    >
      {/* Favorite — mouse-affordance only (out of the listbox tab order) */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={
          favorite
            ? `Remove ${market.symbol} from favorites`
            : `Add ${market.symbol} to favorites`
        }
        aria-pressed={favorite}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-sm transition-opacity",
          favorite
            ? "text-brand"
            : "text-text-faint opacity-0 hover:text-text-muted group-hover:opacity-100",
        )}
      >
        <Star
          className="h-3.5 w-3.5"
          fill={favorite ? "currentColor" : "none"}
        />
      </button>

      {/* Market identity */}
      <span className="flex min-w-0 items-center gap-2">
        <AssetIcon symbol={market.id} size={18} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-xs font-semibold text-text">
            {market.symbol}
            <span className="text-text-faint">/USD</span>
          </span>
          <span className="truncate text-[11px] text-text-muted">
            {market.name}
          </span>
        </span>
      </span>

      {/* Price — neutral when the live value is unavailable */}
      <span
        className={cn(
          "tabular text-right text-xs font-medium",
          price == null ? "text-text-faint" : "text-text",
        )}
      >
        {formatUsdOrDash(price, {
          decimals: decimalsFor(market, price ?? undefined),
        })}
      </span>

      {/* 24h change — sign carries direction, neutral tone when unknown */}
      <span
        className={cn(
          "tabular text-right text-xs font-medium",
          change == null ? "text-text-faint" : up ? "text-up" : "text-down",
        )}
      >
        {change == null ? (
          VALUE_UNAVAILABLE
        ) : (
          <>
            {up ? "+" : ""}
            {change.toFixed(2)}%
          </>
        )}
      </span>

      {/* Max leverage */}
      <span className="flex justify-end">
        <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold tabular text-text-muted group-hover:bg-surface-3">
          {market.maxLeverage}×
        </span>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Selector                                                                     */
/* -------------------------------------------------------------------------- */

export function MarketSelector({
  marketId,
  onMarketChange,
  className,
}: {
  marketId: MarketId;
  onMarketChange: (id: MarketId) => void;
  className?: string;
}) {
  const active = getMarket(marketId);
  const { favorites, toggle } = useFavorites();

  // The full live HL universe (seeds with BTC/ETH/SOL until it loads).
  const catalog = useMarketCatalog();

  // One read of all live ticks; rows take their tick from this map.
  const allTicks = useMarkets();
  const tickMap = useMemo<TickMap>(() => {
    const m: TickMap = new Map();
    for (const t of allTicks) m.set(t.symbol, t);
    return m;
  }, [allTicks]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "default",
    dir: "desc",
  });
  const [highlight, setHighlight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (id: MarketId) =>
    `${baseId}-${id.replace(/[^a-z0-9]/gi, "-")}`;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = catalog.filter((m) => {
      if (filter === "favorites" && !favorites.has(m.id)) return false;
      if (q === "") return true;
      return (
        m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
      );
    });
    // pin favorites only in the unfiltered "all" view with no active query
    const pin = filter === "all" && q === "";
    return sortMarkets(base, sort, tickMap, favorites, pin);
  }, [catalog, query, filter, sort, favorites, tickMap]);

  // Keep the highlight on the active market (or top) as the list changes.
  useEffect(() => {
    if (!open) return;
    const idx = rows.findIndex((m) => m.id === marketId);
    setHighlight(idx >= 0 ? idx : 0);
  }, [open, rows, marketId]);

  // Focus search on open.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = useCallback(
    (id: MarketId) => {
      onMarketChange(id);
      setOpen(false);
      setQuery("");
    },
    [onMarketChange],
  );

  // Handled on the container (not just the search input) so Escape/Enter/Arrows
  // keep working once focus moves off the input into the listbox. Only acts
  // while open, so it never intercepts keys meant for the closed trigger button.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, rows.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const picked = rows[highlight];
        if (picked) choose(picked.id);
      }
    },
    [open, rows, highlight, choose],
  );

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "symbol" ? "asc" : "desc" },
    );

  const activeOptionId = rows[highlight]
    ? optionId(rows[highlight].id)
    : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: combobox key handling lives on the container so Escape/Enter/Arrows work from any focus inside the open dropdown (input or listbox row); guarded to only act while open.
    <div
      ref={containerRef}
      onKeyDown={onKeyDown}
      className={cn("relative", className)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "-ml-2 flex items-center gap-2 rounded-sm px-2 py-1 transition-colors hover:bg-surface-2",
          open && "bg-surface-2",
        )}
      >
        <AssetIcon symbol={marketId} size={20} />
        <span className="text-base font-semibold text-text">
          {active?.symbol ?? marketId}
          <span className="font-normal text-text-faint"> / USD</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-text-faint transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[380px] overflow-hidden rounded-(--radius) border border-border bg-surface shadow-[0_16px_48px_-12px_rgba(0,0,0,0.5)]">
          {/* Search — focus shows as a calm inset ring on the row. The global
              `*:focus-visible` red outline is un-layered, so it beats a normal
              `outline-none`; `!` (important) is required to suppress it here so
              the auto-focused input doesn't open with an error-looking red box. */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 focus-within:ring-1 focus-within:ring-inset focus-within:ring-text-faint">
            <Search className="h-4 w-4 shrink-0 text-text-faint" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={activeOptionId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search markets · use ↑ ↓ to navigate"
              aria-label="Search markets"
              className="w-full bg-transparent md:text-sm text-text placeholder:text-text-faint outline-none! focus-visible:outline-none!"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
            {(["all", "favorites"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  filter === f
                    ? "bg-surface-3 text-text"
                    : "text-text-muted hover:text-text",
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[20px_1fr_auto_64px_48px] items-center gap-2.5 border-b border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
            <span aria-hidden />
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                type="button"
                onClick={() => toggleSort(col.key)}
                aria-label={`Sort by ${col.label}`}
                className={cn(
                  "flex items-center gap-0.5 transition-colors hover:text-text-muted",
                  col.align === "right" ? "justify-end" : "justify-start",
                  sort.key === col.key && "text-text-muted",
                )}
              >
                {col.label}
                {sort.key === col.key && (
                  <span aria-hidden>{sort.dir === "asc" ? "▲" : "▼"}</span>
                )}
              </button>
            ))}
          </div>

          {/* Rows */}
          <div
            role="listbox"
            id={listId}
            aria-label="Markets"
            className="max-h-[320px] overflow-y-auto py-1"
          >
            {rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-text-faint">
                {filter === "favorites"
                  ? "Star a market to add it here."
                  : "No markets match your search."}
              </p>
            ) : (
              rows.map((m, i) => (
                <MarketRow
                  key={m.id}
                  market={m}
                  tick={tickMap.get(m.id)}
                  optionId={optionId(m.id)}
                  active={m.id === marketId}
                  highlighted={i === highlight}
                  favorite={favorites.has(m.id)}
                  onSelect={() => choose(m.id)}
                  onToggleFavorite={() => toggle(m.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
