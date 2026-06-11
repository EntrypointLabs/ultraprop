"use client";

import { useState } from "react";
import { LeaderboardMobileCards } from "@/components/leaderboard/LeaderboardMobileCards";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { PodiumStrip } from "@/components/leaderboard/PodiumStrip";
import {
  Card,
  CardContent,
  CardHeader,
  CardLabel,
  SegmentedControl,
  Skeleton,
} from "@/components/ui";
import { useCohortStats, useLeaderboard } from "@/lib/mock/hooks";
import type { LeaderboardAxis, LeaderboardWindow } from "@/lib/mock/types";
import { formatPct } from "@/lib/utils";

const AXIS_OPTIONS: { value: LeaderboardAxis; label: string }[] = [
  { value: "tier", label: "Highest Tier" },
  { value: "shadowPnl", label: "Simulated P&L" },
  { value: "passes", label: "Total Passes" },
  { value: "consistency", label: "Consistency" },
];

const WINDOW_OPTIONS: { value: LeaderboardWindow; label: string }[] = [
  { value: "weekly", label: "This Cohort" },
  { value: "all", label: "All-time" },
];

export default function LeaderboardPage() {
  const [axis, setAxis] = useState<LeaderboardAxis>("tier");
  const [window, setWindow] = useState<LeaderboardWindow>("weekly");

  const entries = useLeaderboard({ axis, window });
  const cohort = useCohortStats();

  const top3 = entries.slice(0, 3);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
      {/* ── Page header ── */}
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-text">
            Leaderboard
          </h1>
          <span className="rounded-sm bg-warn/15 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-on-warn">
            v1 Genesis
          </span>
        </div>
        <p className="text-sm text-text-muted">
          {cohort.members} traders · {cohort.activeEvaluations} active ·{" "}
          {cohort.totalPasses} passes ·{" "}
          {formatPct(cohort.passRate * 100, { sign: false, decimals: 0 })} pass
          rate · median {formatPct(cohort.medianPasserReturnPct, { sign: true })}
        </p>
      </div>

      {/* ── Controls ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <SegmentedControl<LeaderboardAxis>
            options={AXIS_OPTIONS}
            value={axis}
            onValueChange={setAxis}
            size="sm"
          />
        </div>
        <SegmentedControl<LeaderboardWindow>
          options={WINDOW_OPTIONS}
          value={window}
          onValueChange={setWindow}
          size="sm"
        />
      </div>

      {/* ── Podium — top 3 ── */}
      {top3.length >= 3 && <PodiumStrip top3={top3} axis={axis} />}

      {/* ── Full table (desktop) ── */}
      <Card className="hidden sm:block">
        <CardHeader>
          <CardLabel>
            {AXIS_OPTIONS.find((o) => o.value === axis)?.label ?? "Rankings"}
          </CardLabel>
          <span className="text-xs text-text-faint">
            {entries.length} traders
          </span>
        </CardHeader>
        {entries.length === 0 ? (
          <CardContent>
            <div className="flex flex-col gap-2 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          </CardContent>
        ) : (
          <LeaderboardTable entries={entries} axis={axis} />
        )}
      </Card>

      {/* ── Mobile ranked cards ── */}
      <Card className="sm:hidden">
        <CardHeader>
          <CardLabel>
            {AXIS_OPTIONS.find((o) => o.value === axis)?.label ?? "Rankings"}
          </CardLabel>
          <span className="text-xs text-text-faint">
            {entries.length} traders
          </span>
        </CardHeader>
        {entries.length === 0 ? (
          <CardContent>
            <div className="flex flex-col gap-2 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        ) : (
          <LeaderboardMobileCards entries={entries} axis={axis} />
        )}
      </Card>

      {/* ── Legend / axis description ── */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-faint">
        <AxisLegendItem
          dot="bg-up"
          label="Simulated P&L — simulated cumulative return in USD over the selected window"
        />
        <AxisLegendItem
          dot="bg-violet"
          label="Consistency — ratio of profitable sessions vs total, weighted by return"
        />
        <AxisLegendItem
          dot="bg-brand"
          label="Tier — highest evaluation tier cleared (Pro > Basic > Starter)"
        />
      </div>
    </div>
  );
}

function AxisLegendItem({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-start gap-1.5">
      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
}
