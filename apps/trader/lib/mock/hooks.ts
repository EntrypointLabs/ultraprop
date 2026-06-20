"use client";

import { useLogout, usePrivy } from "@privy-io/react-auth";
import type { MarkTick, Market as VenueMarket } from "@shared/venues";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { suiWalletAddress } from "@/lib/auth";
import { openVenueFeed } from "@/lib/feed/venueFeed";
import {
  buildProfile,
  DEMO_EQUITY_CURVE,
  DEMO_POSITIONS,
  DEMO_SBT,
  DEMO_TRADES,
  DEMO_VAULT,
  DEMO_WALLET,
  INITIAL_PRICES,
  TIERS,
} from "@/lib/mock/fixtures";
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
/**
 * The catalog query result — the merged universe plus the fetch's error state.
 * On a failed `/api/catalog` response the query keeps the last good data (the
 * 3-market `SEED_CATALOG` if nothing loaded yet) AND surfaces `isError`/`error`
 * so a consumer can show a non-blocking "showing a subset" notice. The graceful
 * fallback is preserved either way.
 */
export interface MarketCatalogResult {
  markets: Market[];
  isError: boolean;
  error: Error | null;
}

export function useMarketCatalogQuery(): MarketCatalogResult {
  const { data, isError, error } = useQuery({
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
    // The seed is only the 3-market SSR snapshot. `refetchOnMount: "always"`
    // forces the live /api/catalog fetch the moment any consumer mounts —
    // without it the `initialData` + `staleTime` pair can keep the 3-market seed
    // "fresh" and the full ~179-market universe never loads (`/markets` then
    // shows only 3). `initialDataUpdatedAt: 0` keeps the seed stale-from-epoch
    // for the background refetch interval too.
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
    refetchOnMount: "always",
    refetchInterval: 60_000,
  });
  return {
    markets: data ?? SEED_CATALOG,
    isError,
    error: error instanceof Error ? error : null,
  };
}

/** The merged catalog only — the common case. Errors surface via `useMarketCatalogQuery`. */
export function useMarketCatalog(): Market[] {
  return useMarketCatalogQuery().markets;
}

/** Keep the sparkline bounded; it samples the mark, oldest -> newest. */
const SPARK_MAX = 48;

/**
 * Fold a batch of live `MarkTick`s onto the current `["prices"]` snapshot.
 * `MarkTick.marketId` and `PriceTick.symbol` are both the venue-qualified id
 * ("hyperliquid:BTC"), so they match directly. Updated markets carry their new
 * mark/oracle/mid/funding/change24h/ts and append the mark to the spark. A tick
 * with a `null` change24h (no prior-day reference yet) keeps the last known
 * value rather than blanking a live %. `high24h`/`low24h` ride along unchanged —
 * HL's per-coin assetCtx carries no 24h high/low, so they are derived elsewhere.
 */
function mergeMarks(cur: PriceTick[], ticks: MarkTick[]): PriceTick[] {
  if (ticks.length === 0) return cur;
  const byId = new Map(ticks.map((t) => [t.marketId, t]));
  const seen = new Set<string>();

  const merged = cur.map((p) => {
    const t = byId.get(p.symbol);
    if (!t) return p;
    seen.add(p.symbol);
    return {
      ...p,
      markPx: t.markPx,
      oraclePx: t.oraclePx,
      midPx: t.midPx,
      fundingRate: t.fundingRate,
      change24h: t.change24h ?? p.change24h,
      spark: [...p.spark, t.markPx].slice(-SPARK_MAX),
      ts: t.ts,
    };
  });

  // Markets present in the feed but not yet in the snapshot enter fresh.
  for (const t of ticks) {
    if (seen.has(t.marketId)) continue;
    merged.push({
      symbol: t.marketId,
      markPx: t.markPx,
      oraclePx: t.oraclePx,
      midPx: t.midPx,
      fundingRate: t.fundingRate,
      change24h: t.change24h,
      spark: [t.markPx],
      high24h: null,
      low24h: null,
      ts: t.ts,
    });
  }
  return merged;
}

/**
 * Live marks for the full universe, streamed from OUR `/api/feed` SSE route
 * (gateway-fronted; the browser never touches the venue) and stored at
 * `["prices"]` — the SOLE writer of that key. `usePaperEngine` reads the same
 * key to mark the simulation to market; nothing else writes it. Mark drives PnL
 * (not mid). Seeded with `INITIAL_PRICES` at `staleTime: Infinity` so SSR and
 * first client render are identical; the SSE feed hydrates only after mount.
 */
function usePricesQuery() {
  return useQuery({
    queryKey: ["prices"],
    // The SSE effect is the writer; this never fetches. Returning the current
    // (seeded) snapshot keeps the query resolved without network at mount.
    queryFn: () => INITIAL_PRICES,
    initialData: INITIAL_PRICES,
    staleTime: Infinity,
  });
}

/** Module-level guard so the SSE feed opens exactly once across all consumers. */
let feedRefs = 0;
let feedHandle: ReturnType<typeof openVenueFeed> | null = null;

/**
 * Mount the live venue feed once (ref-counted across every `usePrices`
 * consumer) and route its batches into `["prices"]` via `mergeMarks` — the
 * single writer. Feed health flows into the store: `feedStatus` drives
 * `useConnection`, and a CONFIRMED live->stale transition trips `divergenceHalt`
 * so the existing `StaleFeedBanner` lights up with no new UI. Runs only in a
 * client effect.
 *
 * The halt is auto-SET only on a `"stale"` feed and auto-CLEARED only on `"live"`
 * — `"reconnecting"` (cold start AND transport blips) leaves it untouched, so the
 * trade form is NOT suspended during the initial reconnect window and a manual
 * QA halt survives a brief reconnect.
 */
function useVenueFeed(): void {
  const qc = useQueryClient();
  const setFeedStatus = useMockStore((s) => s.setFeedStatus);
  const setDivergenceHalt = useMockStore((s) => s.setDivergenceHalt);

  useEffect(() => {
    feedRefs += 1;
    if (feedRefs === 1) {
      feedHandle = openVenueFeed(
        "hyperliquid",
        (ticks) =>
          qc.setQueryData<PriceTick[]>(["prices"], (cur) =>
            mergeMarks(cur ?? INITIAL_PRICES, ticks),
          ),
        (status) => {
          setFeedStatus(status);
          if (status === "stale") setDivergenceHalt(true);
          else if (status === "live") setDivergenceHalt(false);
        },
      );
    }
    return () => {
      feedRefs -= 1;
      if (feedRefs === 0) {
        feedHandle?.close();
        feedHandle = null;
      }
    };
  }, [qc, setFeedStatus, setDivergenceHalt]);
}

export function usePrices(symbols?: MarketId[]): PriceTick[] {
  useVenueFeed();
  const { data } = usePricesQuery();
  const list = data ?? INITIAL_PRICES;

  return useMemo(() => {
    if (!symbols || symbols.length === 0) return list;
    const want = new Set(symbols);
    return list.filter((p) => want.has(p.symbol));
  }, [list, symbols]);
}

export function usePrice(symbol: MarketId): PriceTick | undefined {
  useVenueFeed();
  const { data } = usePricesQuery();
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

/**
 * Real leaderboard from the ledger via `/api/leaderboard`, ranked by the chosen
 * axis over the chosen window. With no ledger the API reports `available: false`
 * and this returns an honest empty board — never a fixture.
 */
export function useLeaderboard(opts: {
  axis: LeaderboardAxis;
  window: LeaderboardWindow;
}): LeaderboardEntry[] {
  const { axis, window } = opts;
  const { data } = useQuery({
    queryKey: ["leaderboard", axis, window],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      try {
        const res = await fetch(
          `/api/leaderboard?axis=${axis}&window=${window}`,
        );
        const body = (await res.json()) as {
          available?: boolean;
          entries?: LeaderboardEntry[];
        };
        if (!body?.available) return [];
        return body.entries ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });
  return data ?? [];
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

/** Next weekly window reset — Monday 00:00 UTC; a fixed schedule, not data. */
function nextWeeklyResetMs(): number {
  const now = new Date();
  const daysUntilMon = (8 - now.getUTCDay()) % 7 || 7;
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilMon,
  );
}

function emptyCohort(): CohortStats {
  return {
    cohort: "v1 Genesis",
    members: 0,
    activeEvaluations: 0,
    totalPasses: 0,
    passRate: 0,
    weekResetsAt: nextWeeklyResetMs(),
    medianPasserReturnPct: 0,
  };
}

/**
 * Real cohort stats from the ledger via `/api/cohort/stats`. With no ledger the
 * API reports `available: false` and this returns honest zeros — never a fixture.
 */
export function useCohortStats(): CohortStats {
  const { data } = useQuery({
    queryKey: ["cohort-stats"],
    queryFn: async (): Promise<CohortStats> => {
      const base = emptyCohort();
      try {
        const res = await fetch("/api/cohort/stats");
        const body = (await res.json()) as Partial<CohortStats> & {
          available?: boolean;
        };
        if (!body?.available) return base;
        return {
          ...base,
          members: body.members ?? 0,
          activeEvaluations: body.activeEvaluations ?? 0,
          totalPasses: body.totalPasses ?? 0,
          passRate: body.passRate ?? 0,
          medianPasserReturnPct: body.medianPasserReturnPct ?? 0,
        };
      } catch {
        return base;
      }
    },
    staleTime: 60_000,
  });
  return data ?? emptyCohort();
}

/* ------------------------------------------------------------------ */
/* Connection status — reflects real venue feed health (or a manual halt) */
/* ------------------------------------------------------------------ */

/**
 * Derives `ConnectionStatus` from the live venue feed. `openVenueFeed` reports
 * `"live"`/`"reconnecting"`/`"stale"` into `feedStatus` (via `useVenueFeed`); a
 * manual divergence halt forces `"stale"` so QA can simulate an outage. No
 * polling here — status is push-driven by the SSE feed.
 */
export function useConnection(): ConnectionStatus {
  const halted = useMockStore((s) => s.divergenceHalt);
  const feedStatus = useMockStore((s) => s.feedStatus);
  return halted ? "stale" : feedStatus;
}
