"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  BASE_PRICES,
  buildProfile,
  buildRuleBudgets,
  DEMO_COHORT,
  DEMO_EQUITY_CURVE,
  DEMO_LEADERBOARD,
  DEMO_POSITIONS,
  DEMO_SBT,
  DEMO_TRADES,
  DEMO_VAULT,
  INITIAL_PRICES,
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
  Position,
  PriceTick,
  Profile,
  SbtState,
  Session,
  Symbol,
  Tier,
  TradeRecord,
  VaultState,
} from "@/lib/mock/types";

/* ------------------------------------------------------------------ */
/* Session — backed by the zustand mock store                          */
/* ------------------------------------------------------------------ */

export function useSession(): {
  session: Session;
  signIn: () => void;
  signOut: () => void;
  hydrated: boolean;
} {
  const session = useMockStore((s) => s.session);
  const signIn = useMockStore((s) => s.signIn);
  const signOut = useMockStore((s) => s.signOut);
  const hydrated = useMockStore((s) => s.hydrated);
  return { session, signIn, signOut, hydrated };
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
/* Live-tick engine: seeded initial data, jitter only in client effect */
/* ------------------------------------------------------------------ */

function jitterPrice(prev: PriceTick): PriceTick {
  // bounded random walk around the base price; client-only.
  const drift = (Math.random() - 0.5) * 0.0009;
  const price = Number(
    (prev.price * (1 + drift)).toFixed(prev.price > 1000 ? 1 : 4),
  );
  const base = BASE_PRICES[prev.symbol];
  const _change24h = Number(
    (((price - base) / base) * 100 + prev.change24h * 0.0).toFixed(2),
  );
  const spark = [...prev.spark.slice(1), price];
  return {
    ...prev,
    price,
    change24h: Number((prev.change24h + drift * 100).toFixed(2)),
    spark,
    ts: Date.now(),
  };
}

export function usePrices(symbols?: Symbol[]): PriceTick[] {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["prices"],
    queryFn: () => INITIAL_PRICES,
    initialData: INITIAL_PRICES,
    staleTime: Infinity,
  });

  useEffect(() => {
    const id = setInterval(() => {
      qc.setQueryData<PriceTick[]>(["prices"], (cur) =>
        (cur ?? INITIAL_PRICES).map(jitterPrice),
      );
    }, 1500);
    return () => clearInterval(id);
  }, [qc]);

  const list = data ?? INITIAL_PRICES;
  if (!symbols || symbols.length === 0) return list;
  return list.filter((p) => symbols.includes(p.symbol));
}

export function usePrice(symbol: Symbol): PriceTick | undefined {
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
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["vault", vaultId],
    queryFn: () => DEMO_VAULT,
    initialData: DEMO_VAULT,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (DEMO_VAULT.status !== "active") return;
    const id = setInterval(() => {
      qc.setQueryData<VaultState>(["vault", vaultId], (cur) => {
        const v = cur ?? DEMO_VAULT;
        const equity = Number(
          (v.equity * (1 + (Math.random() - 0.47) * 0.0015)).toFixed(2),
        );
        const peakEquity = Math.max(v.peakEquity, equity);
        return {
          ...v,
          equity,
          peakEquity,
          rules: buildRuleBudgets({
            startingEquity: v.startingEquity,
            equity,
            peakEquity,
            tier: v.tier,
            intentCount: v.intentCount,
          }),
        };
      });
    }, 2000);
    return () => clearInterval(id);
  }, [qc, vaultId]);

  return data ?? DEMO_VAULT;
}

export function useEquityCurve(vaultId: string): EquityPoint[] {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["equity", vaultId],
    queryFn: () => DEMO_EQUITY_CURVE,
    initialData: DEMO_EQUITY_CURVE,
    staleTime: Infinity,
  });

  useEffect(() => {
    const id = setInterval(() => {
      qc.setQueryData<EquityPoint[]>(["equity", vaultId], (cur) => {
        const points = cur ?? DEMO_EQUITY_CURVE;
        const last = points[points.length - 1];
        const next: EquityPoint = {
          ts: Date.now(),
          equity: Number(
            (last.equity * (1 + (Math.random() - 0.47) * 0.0015)).toFixed(2),
          ),
        };
        return [...points.slice(-191), next];
      });
    }, 2000);
    return () => clearInterval(id);
  }, [qc, vaultId]);

  return data ?? DEMO_EQUITY_CURVE;
}

export function usePositions(vaultId: string): Position[] {
  const qc = useQueryClient();
  const prices = usePrices();
  const { data } = useQuery({
    queryKey: ["positions", vaultId],
    queryFn: () => DEMO_POSITIONS,
    initialData: DEMO_POSITIONS,
    staleTime: Infinity,
  });

  useEffect(() => {
    qc.setQueryData<Position[]>(["positions", vaultId], (cur) =>
      (cur ?? DEMO_POSITIONS).map((pos) => {
        const tick = prices.find((p) => p.symbol === pos.symbol);
        if (!tick) return pos;
        const markPrice = tick.price;
        const dir = pos.side === "long" ? 1 : -1;
        const pnlPct = ((markPrice - pos.entryPrice) / pos.entryPrice) * dir;
        return {
          ...pos,
          markPrice,
          unrealizedPnl: Number((pos.sizeUsd * pnlPct).toFixed(2)),
          unrealizedPnlPct: Number((pnlPct * 100).toFixed(2)),
        };
      }),
    );
  }, [qc, vaultId, prices]);

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
/* Connection status — cycles to feel live; halted forces "stale"      */
/* ------------------------------------------------------------------ */

export function useConnection(): ConnectionStatus {
  const halted = useMockStore((s) => s.divergenceHalt);
  const [status, setStatus] = useState<ConnectionStatus>("live");
  const tick = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      tick.current += 1;
      // brief reconnecting blip every ~20s, otherwise live.
      setStatus(tick.current % 13 === 0 ? "reconnecting" : "live");
    }, 1500);
    return () => clearInterval(id);
  }, []);

  return halted ? "stale" : status;
}
