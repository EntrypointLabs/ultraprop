"use client";

import { useLogout, usePrivy } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  SYMBOLS,
  TIERS,
} from "@/lib/mock/fixtures";
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
import {
  fetchDailyHistory,
  fetchLatestPrices,
  type OracleHistory,
  type OraclePrice,
} from "@/lib/oracle/pyth";

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
/* Live oracle prices — Pyth Hermes spot + Benchmarks 24h history       */
/* ------------------------------------------------------------------ */

/** Latest spot for every market, refreshed straight off the oracle. */
function useOracleLatest() {
  return useQuery({
    queryKey: ["oracle", "latest"],
    queryFn: ({ signal }) => fetchLatestPrices(SYMBOLS, signal),
    refetchInterval: 2500,
    staleTime: 2500,
  });
}

/** Trailing-24h hourly closes per market (sparkline + 24h change basis). */
function useOracleHistory() {
  return useQuery({
    queryKey: ["oracle", "history"],
    queryFn: async ({ signal }) => {
      const nowSec = Math.floor(Date.now() / 1000);
      const entries = await Promise.all(
        SYMBOLS.map(
          async (s) =>
            [
              s,
              await fetchDailyHistory(s, nowSec, signal).catch(() => null),
            ] as const,
        ),
      );
      const out: Partial<Record<MarketId, OracleHistory>> = {};
      for (const [s, h] of entries) if (h) out[s] = h;
      return out;
    },
    refetchInterval: 5 * 60_000,
    staleTime: 5 * 60_000,
  });
}

/**
 * Build a `PriceTick` per market from live oracle data only. There is no
 * synthetic fallback: until the oracle responds (or if it fails), price and
 * change24h are null and the UI must render an explicit "unavailable" state
 * rather than a stale or fabricated number. This keeps server render and first
 * client paint aligned (both have no data) with no hydration drift.
 */
function composeTicks(
  latest: OraclePrice[] | undefined,
  history: Partial<Record<MarketId, OracleHistory>> | undefined,
): PriceTick[] {
  return SYMBOLS.map((symbol) => {
    const live = latest?.find((p) => p.symbol === symbol);
    const hist = history?.[symbol];
    const price = live?.price ?? null;
    const change24h =
      price != null && hist?.price24hAgo
        ? Number(
            (((price - hist.price24hAgo) / hist.price24hAgo) * 100).toFixed(2),
          )
        : null;
    const spark = hist && hist.closes.length > 1 ? hist.closes.slice(-32) : [];
    return {
      symbol,
      price,
      change24h,
      spark,
      high24h: hist?.high24h ?? null,
      low24h: hist?.low24h ?? null,
      ts: live?.publishTime ?? 0,
    };
  });
}

export function usePrices(symbols?: MarketId[]): PriceTick[] {
  const { data: latest } = useOracleLatest();
  const { data: history } = useOracleHistory();

  const list = useMemo(() => composeTicks(latest, history), [latest, history]);

  if (!symbols || symbols.length === 0) return list;
  return list.filter((p) => symbols.includes(p.symbol));
}

export function usePrice(symbol: MarketId): PriceTick | undefined {
  return usePrices([symbol])[0];
}

/* ------------------------------------------------------------------ */
/* Markets / tiers                                                     */
/* ------------------------------------------------------------------ */

export function useMarkets(): PriceTick[] {
  return usePrices(SYMBOLS);
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
/* Connection status — reflects real oracle health (or a manual halt)   */
/* ------------------------------------------------------------------ */

/** Live oracle data is treated as stale if it hasn't refreshed in this window. */
const ORACLE_STALE_MS = 30_000;

export function useConnection(): ConnectionStatus {
  const halted = useMockStore((s) => s.divergenceHalt);
  const { data, isError, dataUpdatedAt } = useOracleLatest();
  const [, force] = useState(0);

  // The query only re-renders on a fetch — which is exactly what stops when the
  // feed dies — so re-evaluate staleness on a steady cadence of our own.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 2000);
    return () => clearInterval(id);
  }, []);

  if (halted) return "stale";
  if (isError) return "stale";
  if (!data || data.length === 0) return "reconnecting";
  if (Date.now() - dataUpdatedAt > ORACLE_STALE_MS) return "stale";
  return "live";
}
