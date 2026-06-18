"use client";

import { ArrowRight, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { useCohortStats } from "@/lib/mock/hooks";
import { formatPct } from "@/lib/utils";

export function GenesisBanner() {
  const cohort = useCohortStats();

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-warn/30 bg-surface">
      {/* amber accent strip */}
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-[var(--radius-lg)] bg-warn" />

      <div className="flex flex-col gap-4 px-5 py-4 pl-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="genesis">Genesis</Badge>
            <span className="text-sm font-semibold text-text">
              v1 Genesis cohort is live
            </span>
          </div>
          <p className="max-w-md text-xs text-text-muted">
            Closed beta is open. Trade the full Bluefin, DeepBook &amp; Hyperliquid perpetual catalog in
            simulation against live market prices — earn a non-transferable
            credential as verifiable proof of skill.
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-text-faint" />
              <span className="tabular text-xs text-text-muted">
                <span className="font-semibold text-text">
                  {cohort.members}
                </span>{" "}
                members
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-text-faint" />
              <span className="tabular text-xs text-text-muted">
                <span className="font-semibold text-up">
                  {formatPct(cohort.passRate * 100, { sign: false })}
                </span>{" "}
                pass rate
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-up live-pulse" />
              <span className="tabular text-xs text-text-muted">
                <span className="font-semibold text-text">
                  {cohort.activeEvaluations}
                </span>{" "}
                active evals
              </span>
            </div>
          </div>
        </div>

        <Link href="/cohort" className="shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-warn/40 text-warn hover:bg-warn/10 hover:border-warn/60"
          >
            View cohort
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
