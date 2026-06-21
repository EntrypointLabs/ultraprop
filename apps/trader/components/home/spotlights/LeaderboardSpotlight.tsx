"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { TVChart } from "@/components/charts/TVChart";
import {
  PodiumSkeleton,
  PodiumStrip,
} from "@/components/leaderboard/PodiumStrip";
import { Button, Skeleton } from "@/components/ui";
import { SEED_NOW } from "@/lib/mock/fixtures";
import { useLeaderboardQuery } from "@/lib/mock/hooks";

export function LeaderboardSpotlight() {
  const { entries, isLoading } = useLeaderboardQuery({
    axis: "shadowPnl",
    window: "all",
  });
  const top3 = entries.slice(0, 3);

  // Build a compact 3-line series for the top 3 leaders' P&L progression
  const interval = 4 * 60 * 60 * 1000; // 4h steps
  const now = SEED_NOW;
  const POINTS = 20;
  const chartSeries = top3.map((entry, idx) => {
    const base = entry.shadowPnl * 0.3;
    const data = Array.from({ length: POINTS }, (_, i) => {
      const frac = i / (POINTS - 1);
      const noise =
        Math.sin(i * 2.3 + idx * 5) * 0.08 + Math.cos(i * 1.7 + idx * 3) * 0.04;
      return {
        t: now - (POINTS - 1 - i) * interval,
        v: Number(
          (
            base +
            entry.shadowPnl * 0.7 * frac +
            entry.shadowPnl * noise
          ).toFixed(2),
        ),
      };
    });
    const colors = ["#e5484d", "#0c8051", "#b45309"];
    return {
      data,
      type: "line" as const,
      color: colors[idx] ?? "#e5484d",
      lineWidth: 1.5 as 1 | 2 | 3,
    };
  });

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-widest text-text-muted">
          Leaderboard
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text">
          This week's top performers
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Ranked by simulated P&L across all active evaluations.
        </p>
      </div>

      {isLoading ? (
        <PodiumSkeleton />
      ) : (
        <PodiumStrip top3={top3} axis="shadowPnl" />
      )}

      {isLoading ? (
        <Skeleton className="flex-1 min-h-0 rounded-[var(--radius)]" />
      ) : (
        chartSeries.length > 0 && (
          <div className="flex-1 min-h-0 rounded-[var(--radius)] overflow-hidden border border-border bg-surface-2">
            <TVChart
              series={chartSeries}
              height={"full"}
              watermark="Simulated P&L"
              showTimeScale={false}
              showPriceScale={false}
              interactive={false}
              precision={0}
            />
          </div>
        )
      )}

      <div className="mt-auto">
        <Link href="/leaderboard">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-text-muted hover:text-text"
          >
            View full leaderboard
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
