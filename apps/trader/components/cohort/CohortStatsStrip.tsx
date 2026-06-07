"use client";

import { ConnectionDot, StatTile } from "@/components/ui";
import { useCohortStats, useConnection } from "@/lib/mock/hooks";
import { formatPct } from "@/lib/utils";

export function CohortStatsStrip() {
  const stats = useCohortStats();
  const connStatus = useConnection();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
          Cohort Health — Live
        </h2>
        <ConnectionDot status={connStatus} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Members"
          value={
            <span className="tabular">{stats.members.toLocaleString()}</span>
          }
          delta="traders in cohort"
          deltaTone="muted"
        />
        <StatTile
          label="Active Evaluations"
          value={<span className="tabular">{stats.activeEvaluations}</span>}
          delta="currently trading"
          deltaTone="muted"
        />
        <StatTile
          label="Cohort Pass Rate"
          value={
            <span className="tabular">
              {formatPct(stats.passRate * 100, { sign: false })}
            </span>
          }
          delta={`${stats.totalPasses} total passes`}
          deltaTone="up"
        />
        <StatTile
          label="Weekly Reset"
          value={<span className="text-base">Mon 00:00 UTC</span>}
          delta="stats window refreshes"
          deltaTone="muted"
        />
      </div>

      <div className="rounded-[var(--radius)] border border-border-soft bg-surface px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Median Passer Return
            </span>
            <p className="tabular mt-0.5 text-lg font-semibold text-up">
              {formatPct(stats.medianPasserReturnPct)}
            </p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Evaluation Universe
            </span>
            <p className="tabular mt-0.5 text-lg font-semibold text-text">
              BTC / ETH / SOL
            </p>
          </div>
          <div className="h-8 w-px bg-border hidden sm:block" />
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Market Data
            </span>
            <p className="mt-0.5 text-lg font-semibold text-text">
              Live · real-time
            </p>
          </div>
          <div className="h-8 w-px bg-border hidden sm:block" />
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Rules Enforced By
            </span>
            <p className="mt-0.5 text-lg font-semibold text-text">
              Automatic contract
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
