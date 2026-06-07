"use client";

import { Badge, StatTile } from "@/components/ui";
import { DEMO_WALLET } from "@/lib/mock/fixtures";
import { useCohortStats, useSbt } from "@/lib/mock/hooks";
import { formatPct, formatUsd } from "@/lib/utils";

/** The big Genesis hero + personal stat tiles. */
export function GenesisHero() {
  const sbt = useSbt(DEMO_WALLET);
  const cohort = useCohortStats();

  // Week number derived from seed epoch (2025-06-07 is week 23 of 2025).
  const weekNum = 23;
  const weekStart = "Jun 2";
  const weekEnd = "Jun 8";

  const sbtLevelLabel: Record<number, string> = {
    0: "Unranked",
    1: "L1 — Starter",
    2: "L2 — Basic",
    3: "L3 — Pro",
  };

  return (
    <section className="relative overflow-hidden rounded-lg border border-border bg-surface">
      <div className="px-6 pb-6 pt-6">
        {/* Tag row */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="genesis">GENESIS</Badge>
          <Badge variant="outline">v1 Closed Beta</Badge>
          <span className="text-xs text-text-faint">
            Season: <span className="font-medium text-text-muted">Genesis</span>
          </span>
        </div>

        {/* Display header */}
        <h1 className="mb-1.5 text-4xl font-bold tracking-tight sm:text-5xl">
          <span className="text-brand">Genesis</span>{" "}
          <span className="text-text">Cohort</span>
        </h1>

        {/* Week label */}
        <p className="mb-6 text-sm tabular text-text-muted">
          Week {weekNum} &nbsp;·&nbsp; {weekStart} – {weekEnd} &nbsp;·&nbsp;
          resets Monday 00:00 UTC
        </p>

        {/* Stat tiles grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Your credential level"
            value={
              <span className="text-lg font-semibold text-brand">
                {sbtLevelLabel[sbt.level]}
              </span>
            }
            delta={sbt.cohort}
            deltaTone="muted"
          />
          <StatTile
            label="Highest Tier"
            value={
              <span className="text-lg">
                {sbt.passedTiers.length > 0
                  ? sbt.passedTiers[sbt.passedTiers.length - 1]
                  : "—"}
              </span>
            }
            delta={`${sbt.passedTiers.length} tier${sbt.passedTiers.length !== 1 ? "s" : ""} passed`}
            deltaTone="muted"
          />
          <StatTile
            label="Total Passes"
            value={
              <span className="tabular text-lg">{sbt.passedTiers.length}</span>
            }
            delta={`of ${cohort.totalPasses} cohort-wide`}
            deltaTone="muted"
          />
          <StatTile
            label="Simulated P&L"
            value={
              <span className="tabular text-lg text-up">
                {formatUsd(14_280.42, { sign: true })}
              </span>
            }
            delta={`${formatPct(8.4, { sign: true })} lifetime`}
            deltaTone="up"
          />
        </div>
      </div>
    </section>
  );
}
