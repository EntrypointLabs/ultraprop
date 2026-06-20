"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { TVChart } from "@/components/charts/TVChart";
import { Avatar, Badge } from "@/components/ui";
import { accountHandle } from "@/lib/identity";
import { DEMO_VAULT_ID, DEMO_WALLET } from "@/lib/mock/fixtures";
import { useEquityCurve, useLeaderboard, useProfile } from "@/lib/mock/hooks";
import { formatPct, formatUsd } from "@/lib/utils";

export function TopTraderSpotlight() {
  const entries = useLeaderboard({ axis: "shadowPnl", window: "all" });
  const leader = entries[0];
  const profile = useProfile(leader?.wallet ?? DEMO_WALLET);
  const equityCurve = useEquityCurve(DEMO_VAULT_ID);

  const profileWallet = leader?.wallet ?? DEMO_WALLET;

  const chartSeries =
    equityCurve.length > 0
      ? [
          {
            data: equityCurve.map((p) => ({ t: p.ts, v: p.equity })),
            type: "area" as const,
            color: "#e5484d",
            topColor: "rgba(229,72,77,0.28)",
            bottomColor: "rgba(229,72,77,0.02)",
            lineWidth: 2 as 1 | 2 | 3,
          },
        ]
      : [];

  const startEquity = equityCurve[0]?.equity ?? 10_000;
  const lastEquity = equityCurve[equityCurve.length - 1]?.equity ?? startEquity;
  const returnPct = ((lastEquity - startEquity) / startEquity) * 100;
  const isUp = returnPct >= 0;

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-widest text-text-muted">
          Top Trader
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text">
          Leading the evaluation cohort
        </h2>
      </div>

      {/* Trader identity */}
      <div className="flex items-center gap-3">
        <Avatar address={profileWallet} size={40} />
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-text">
            {profile.displayName ?? accountHandle(profileWallet)}
          </span>
          <div className="flex items-center gap-1.5">
            <Badge variant="tier" className="uppercase">
              {profile.highestTier}
            </Badge>
            {leader && (
              <Badge variant="up">
                {leader.passes} {leader.passes === 1 ? "pass" : "passes"}
              </Badge>
            )}
          </div>
        </div>

        <div className="ml-auto text-right">
          <div
            className={`tabular text-lg font-bold ${isUp ? "text-up" : "text-down"}`}
          >
            {formatPct(returnPct, { sign: true })}
          </div>
          <div className="text-xs text-text-muted">Evaluation return</div>
        </div>
      </div>

      {/* Equity curve */}
      {chartSeries.length > 0 && (
        <div className="flex-1 min-h-0 rounded-[var(--radius)] overflow-hidden border border-border bg-surface-2">
          <TVChart
            series={chartSeries}
            height={"full"}
            watermark="Equity"
            showTimeScale={true}
            showPriceScale={true}
            interactive={false}
            precision={0}
          />
        </div>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius)] bg-surface-2 px-3 py-2.5">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Simulated P&L
          </div>
          <div
            className={`tabular mt-1 text-sm font-semibold ${(leader?.shadowPnl ?? 0) >= 0 ? "text-up" : "text-down"}`}
          >
            {formatUsd(leader?.shadowPnl ?? 0, { sign: true })}
          </div>
        </div>
        <div className="rounded-[var(--radius)] bg-surface-2 px-3 py-2.5">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Passes
          </div>
          <div className="tabular mt-1 text-sm font-semibold text-text">
            {leader?.passes ?? 0}
          </div>
        </div>
        <div className="rounded-[var(--radius)] bg-surface-2 px-3 py-2.5">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Tier
          </div>
          <div className="tabular mt-1 text-sm font-semibold text-text">
            {leader?.tier ?? "—"}
          </div>
        </div>
      </div>

      <div className="mt-auto">
        <Link href={`/profile/${profileWallet}`}>
          <span className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text">
            View profile
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
