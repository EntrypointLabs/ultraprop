"use client";

import { useLogout, usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { suiWalletAddress } from "@/lib/auth";
import {
  buildProfile,
  DEMO_COHORT,
  DEMO_EQUITY_CURVE,
  DEMO_LEADERBOARD,
  DEMO_POSITIONS,
  DEMO_SBT,
  DEMO_TRADES,
  DEMO_VAULT,
  DEMO_WALLET,
  INITIAL_PRICES,
  TIERS,
} from "@/lib/mock/fixtures";
import type { Market as VenueMarket } from "@shared/venues";
import {
  DEFAULT_SIM_FIELDS,
  getMarket,
  type Market,
  SEED_CATALOG,
  setLiveCatalog,
} from "@/lib/mock/markets";
import { useMockStore } from "@/lib/mock/store";
import type {
  CohortStats,
  ConnectionStatus,
  EquityPoint,
  LeaderboardAxis,
  LeaderboardEntry,
  LeaderboardWindow,
  MarketId,
  Position,
  PriceTick,
  Profile,
  SbtState,
  Session,
  Tier,
  TradeRecord,
  VaultState,
} from "@/lib/mock/types";

/* ------------------------------------------------------------------ */
/* Session — identity from Privy, balances/allowlist still mocked       */
/* ------------------------------------------------------------------ */

export function useSession(): {
  session: Session;
  /** Opens the auth modal; real sign-in happens via Privy in the auth flow. */
  signIn: () => void;
  signOut: () => void;
  hydrated: boolean;
} {
  const { ready, authenticated, user } = usePrivy();
  const { logout } = useLogout();
  const openLogin = useMockStore((s) => s.openLogin);

  const session: Session = authenticated
    ? {
        address: suiWalletAddress(user) ?? DEMO_WALLET,
        chain: "sui",
        balanceUsd: 0,
        allowlisted: true,
        status: "connected",
      }
    : {
        address: null,
        chain: "sui",
        balanceUsd: 0,
        allowlisted: false,
        status: "disconnected",
      };

  return { session, signIn: openLogin, signOut: logout, hydrated: ready };
}

/* ------------------------------------------------------------------ */
/* Divergence halt toggle (drives StaleFeedBanner)                     */
/* ------------------------------------------------------------------ */

export function useDivergenceHalt(): {
  halted: boolean;
  set: (v: boolean) => void;
  toggle: () => void;
} {
  const halted = useMockStore((s) => s.divergenceHalt);
  const set = useMockStore((s) => s.setDivergenceHalt);
  const toggle = useMockStore((s) => s.toggleDivergenceHalt);
  return { halted, set, toggle };
}

/* ------------------------------------------------------------------ */
/* Live Hyperliquid catalog + marks — via OUR endpoints, never HL direct */
/* ------------------------------------------------------------------ */

/** Marks refresh cadence — live ticks (server-side fetch behind /api/marks). */
const MARKS_REFETCH_MS = 3_000;

/** The bare venue-symbol → mark/funding context shape from /api/marks. */
interface MarkCtx {
  markPx: string;
  oraclePx: string;
  midPx: string | null;
  funding: string;
  prevDayPx: string;
}

/** The venue-derived fields the live `/api/catalog` DTO supplies. */
type LiveMarket = Pick<
  VenueMarket,
  | "id"
  | "venue"
  | "symbol"
  | "base"
  | "displayName"
  | "szDecimals"
  | "tickSize"
  | "maxLeverage"
  | "maker"
  | "taker"
  | "fundingIntervalMs"
  | "isDelisted"
>;

/**
 * Merge a live venue DTO onto the Phase-1 snapshot to produce the ONE canonical
 * FE `Market`: venue-derived fields win (live), sim-only fields (name, depthUsd,
 * volFactor, volume24h) come from the matched snapshot entry — or documented
 * defaults when the live market is not in the snapshot.
 */
function mergeMarket(live: LiveMarket): Market {
  const snap =
    getMarket(live.id) ?? SEED_CATALOG.find((m) => m.symbol === live.symbol);
  return {
    name: snap?.name ?? live.base,
    depthUsd: snap?.depthUsd ?? DEFAULT_SIM_FIELDS.depthUsd,
    volFactor: snap?.volFactor ?? DEFAULT_SIM_FIELDS.volFactor,
    volume24h: snap?.volume24h ?? DEFAULT_SIM_FIELDS.volume24h,
    ...live,
  };
}

/**
 * The full live HL perp universe, fetched from OUR `/api/catalog` route (which
 * calls Hyperliquid server-side) and MERGED onto the Phase-1 snapshot so the
 * result is the single canonical FE `Market` type. Seeds with the snapshot so
 * SSR and first paint are deterministic — TanStack runs `queryFn` client-side
 * after mount, so the browser never fetches at module scope. On each success the
 * module `liveCatalog` is updated so synchronous `getMarket` readers see the
 * live universe too.
 */
export function useMarketCatalog(): Market[] {
  const { data } = useQuery({
    queryKey: ["markets", "hl"],
    queryFn: async ({ signal }): Promise<Market[]> => {
      const res = await fetch("/api/catalog?venue=hl", { signal });
      if (!res.ok) throw new Error(`/api/catalog ${res.status}`);
      const live = (await res.json()) as LiveMarket[];
      const merged = live.map(mergeMarket);
      setLiveCatalog(merged);
      return merged;
    },
    initialData: SEED_CATALOG,
    // The seed is only the 3-market SSR snapshot. Mark it stale-from-epoch so
    // the live /api/catalog fetch fires on mount — otherwise `staleTime` keeps
    // the seed "fresh" forever and the full ~179-market universe never loads.
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  return data ?? SEED_CATALOG;
}

function buildTick(symbol: string, ctx: MarkCtx): PriceTick {
  const mark = Number(ctx.markPx);
  const prevDay = Number(ctx.prevDayPx);
  const markValid = Number.isFinite(mark);
  const change24h =
    markValid && Number.isFinite(prevDay) && prevDay !== 0
      ? Number((((mark - prevDay) / prevDay) * 100).toFixed(2))
      : null;
  const mid = ctx.midPx == null ? null : Number(ctx.midPx);
  const oracle = Number(ctx.oraclePx);
  return {
    // FE id scheme is venue-qualified; /api/marks keys by bare symbol.
    symbol: `hyperliquid:${symbol}`,
    // mark drives PnL/marks (not mid); price mirrors mark for existing readers
    price: markValid ? mark : null,
    change24h,
    spark: [],
    high24h: null,
    low24h: null,
    ts: Date.now(),
    markPx: markValid ? mark : null,
    oraclePx: Number.isFinite(oracle) ? oracle : null,
    midPx: mid != null && Number.isFinite(mid) ? mid : null,
  };
}

/**
 * Live marks for the full universe, polled every 3s from OUR `/api/marks` route
 * (which fetches Hyperliquid server-side) and stored at `["prices"]` — the
 * single writer of that key. `usePaperEngine` reads the same key to mark the
 * simulation to market; nothing else writes it. Mark drives PnL (not mid), and
 * `midPx` may be null (guarded). The route keys by bare symbol; ticks are
 * re-keyed to `hyperliquid:<symbol>`. Seeds with `INITIAL_PRICES` so SSR/first
 * paint match.
 */
function useMarksQuery() {
  return useQuery({
    queryKey: ["prices"],
    queryFn: async ({ signal }): Promise<PriceTick[]> => {
      const res = await fetch("/api/marks", { signal });
      if (!res.ok) throw new Error(`/api/marks ${res.status}`);
      const marks = (await res.json()) as Record<string, MarkCtx>;
      return Object.entries(marks).map(([symbol, ctx]) =>
        buildTick(symbol, ctx),
      );
    },
    initialData: INITIAL_PRICES,
    staleTime: MARKS_REFETCH_MS,
    refetchInterval: MARKS_REFETCH_MS,
  });
}

export function usePrices(symbols?: MarketId[]): PriceTick[] {
  const { data } = useMarksQuery();
  const list = data ?? INITIAL_PRICES;

  return useMemo(() => {
    if (!symbols || symbols.length === 0) return list;
    const want = new Set(symbols);
    return list.filter((p) => want.has(p.symbol));
  }, [list, symbols]);
}

export function usePrice(symbol: MarketId): PriceTick | undefined {
  const { data } = useMarksQuery();
  return (data ?? INITIAL_PRICES).find((p) => p.symbol === symbol);
}

/* ------------------------------------------------------------------ */
/* Markets / tiers                                                     */
/* ------------------------------------------------------------------ */

export function useMarkets(): PriceTick[] {
  return usePrices();
}

export function useTiers(): Tier[] {
  const { data } = useQuery({
    queryKey: ["tiers"],
    queryFn: () => TIERS,
    initialData: TIERS,
    staleTime: Infinity,
  });
  return data ?? TIERS;
}

/* ------------------------------------------------------------------ */
/* Vault — equity ticks up; rules recompute                            */
/* ------------------------------------------------------------------ */

export function useVault(vaultId: string): VaultState {
  // Pure reader — `usePaperEngine` is the sole writer of this key.
  const { data } = useQuery({
    queryKey: ["vault", vaultId],
    queryFn: () => DEMO_VAULT,
    initialData: DEMO_VAULT,
    staleTime: Infinity,
  });
  return data ?? DEMO_VAULT;
}

export function useEquityCurve(vaultId: string): EquityPoint[] {
  const { data } = useQuery({
    queryKey: ["equity", vaultId],
    queryFn: () => DEMO_EQUITY_CURVE,
    initialData: DEMO_EQUITY_CURVE,
    staleTime: Infinity,
  });
  return data ?? DEMO_EQUITY_CURVE;
}

export function usePositions(vaultId: string): Position[] {
  const { data } = useQuery({
    queryKey: ["positions", vaultId],
    queryFn: () => DEMO_POSITIONS,
    initialData: DEMO_POSITIONS,
    staleTime: Infinity,
  });
  return data ?? DEMO_POSITIONS;
}

export function useTradeHistory(vaultId: string): TradeRecord[] {
  const { data } = useQuery({
    queryKey: ["trades", vaultId],
    queryFn: () => DEMO_TRADES,
    initialData: DEMO_TRADES,
    staleTime: Infinity,
  });
  return data ?? DEMO_TRADES;
}

/* ------------------------------------------------------------------ */
/* SBT / leaderboard / profile / cohort                                */
/* ------------------------------------------------------------------ */

export function useSbt(address?: string): SbtState {
  const { data } = useQuery({
    queryKey: ["sbt", address ?? DEMO_SBT.owner],
    queryFn: () => (address ? { ...DEMO_SBT, owner: address } : DEMO_SBT),
    initialData: address ? { ...DEMO_SBT, owner: address } : DEMO_SBT,
    staleTime: Infinity,
  });
  return data ?? DEMO_SBT;
}

export function useLeaderboard(opts: {
  axis: LeaderboardAxis;
  window: LeaderboardWindow;
}): LeaderboardEntry[] {
  const { axis, window } = opts;
  const { data } = useQuery({
    queryKey: ["leaderboard", axis, window],
    queryFn: () => sortLeaderboard(DEMO_LEADERBOARD, axis),
    initialData: sortLeaderboard(DEMO_LEADERBOARD, axis),
    staleTime: Infinity,
  });
  return data ?? DEMO_LEADERBOARD;
}

function sortLeaderboard(
  entries: LeaderboardEntry[],
  axis: LeaderboardAxis,
): LeaderboardEntry[] {
  const cmp: Record<
    LeaderboardAxis,
    (a: LeaderboardEntry, b: LeaderboardEntry) => number
  > = {
    tier: (a, b) => b.sbtLevel - a.sbtLevel,
    shadowPnl: (a, b) => b.shadowPnl - a.shadowPnl,
    passes: (a, b) => b.passes - a.passes,
    consistency: (a, b) => b.consistency - a.consistency,
  };
  return [...entries].sort(cmp[axis]).map((e, i) => ({ ...e, rank: i + 1 }));
}

export function useProfile(wallet: string): Profile {
  const { data } = useQuery({
    queryKey: ["profile", wallet],
    queryFn: () => buildProfile(wallet),
    initialData: buildProfile(wallet),
    staleTime: Infinity,
  });
  return data ?? buildProfile(wallet);
}

export function useCohort(): CohortStats {
  return useCohortStats();
}

export function useCohortStats(): CohortStats {
  const { data } = useQuery({
    queryKey: ["cohort"],
    queryFn: () => DEMO_COHORT,
    initialData: DEMO_COHORT,
    staleTime: Infinity,
  });
  return data ?? DEMO_COHORT;
}

/* ------------------------------------------------------------------ */
/* Connection status — reflects real venue health (or a manual halt)    */
/* ------------------------------------------------------------------ */

/** Live marks are treated as stale if they haven't refreshed in this window. */
const MARKS_STALE_MS = 30_000;

export function useConnection(): ConnectionStatus {
  const halted = useMockStore((s) => s.divergenceHalt);
  const { isError, isFetched, dataUpdatedAt } = useMarksQuery();
  const [, force] = useState(0);

  // The query only re-renders on a fetch — which is exactly what stops when the
  // feed dies — so re-evaluate staleness on a steady cadence of our own.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 2000);
    return () => clearInterval(id);
  }, []);

  if (halted) return "stale";
  if (isError) return "stale";
  // `initialData` seeds the query, so a successful fetch must land before "live".
  if (!isFetched) return "reconnecting";
  if (Date.now() - dataUpdatedAt > MARKS_STALE_MS) return "stale";
  return "live";
}
