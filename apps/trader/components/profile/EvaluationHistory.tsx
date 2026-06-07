"use client";

import { ExternalLink } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardLabel,
  Sparkline,
} from "@/components/ui";
import type { VaultStatus, VaultSummary } from "@/lib/mock/types";
import { formatPct } from "@/lib/utils";

/** Local seeded equity-curve stubs for visual variety without modifying shared mocks. */
const EVAL_SPARKS: Record<string, number[]> = {
  vault_starter_001: [
    10000, 10120, 10045, 10230, 10380, 10520, 10470, 10610, 10720, 10840, 10780,
    10950, 11020, 11180, 11050, 11240, 11380, 11290, 11450, 10840,
  ],
  vault_basic_001: [
    25000, 25180, 25320, 25240, 25410, 25390, 25520, 25480, 25630, 25710, 25660,
    25750, 25820, 25780, 25910, 25880, 25960, 26040, 25980, 26110,
  ],
  vault_starter_000: [
    10000, 9980, 9860, 9720, 9640, 9550, 9490, 9380, 9440, 9310, 9260, 9190,
    9130, 9070, 9010, 8960, 8920, 8880, 8850, 8830,
  ],
};

function fallbackSpark(_vaultId: string, returnPct: number): number[] {
  // Simple seeded walk for unknown vaults
  const base = 10000;
  const points = 20;
  const end = base * (1 + returnPct / 100);
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    return base + (end - base) * t;
  });
}

function statusBadge(status: VaultStatus) {
  switch (status) {
    case "passed":
      return <Badge variant="up">Passed</Badge>;
    case "failed":
      return <Badge variant="down">Failed</Badge>;
    case "inactive":
      return <Badge variant="default">Inactive</Badge>;
    case "active":
      return <Badge variant="genesis">Active</Badge>;
  }
}

function tierBadge(tier: string) {
  return <Badge variant="tier">{tier}</Badge>;
}

function dateLabel(ts: number | null): string {
  if (!ts) return "Ongoing";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface EvaluationRowProps {
  eval_: VaultSummary;
  index: number;
}

function EvaluationRow({ eval_, index }: EvaluationRowProps) {
  const spark =
    EVAL_SPARKS[eval_.vaultId] ?? fallbackSpark(eval_.vaultId, eval_.returnPct);
  const isPos = eval_.returnPct >= 0;
  const tone: "up" | "down" | "neutral" =
    eval_.status === "active" ? "neutral" : isPos ? "up" : "down";

  const suiExplorerUrl = `https://suiexplorer.com/address/${eval_.vaultId}?network=mainnet`;

  return (
    <div className="flex flex-col gap-3 py-4 border-b border-border-soft last:border-0 sm:flex-row sm:items-center sm:gap-4">
      {/* Index */}
      <div className="tabular text-xs text-text-faint w-5 shrink-0">
        #{index + 1}
      </div>

      {/* Tier + status */}
      <div className="flex items-center gap-2 min-w-[120px]">
        {tierBadge(eval_.tier)}
        {statusBadge(eval_.status)}
      </div>

      {/* Sparkline */}
      <div className="shrink-0">
        <Sparkline
          data={spark}
          width={80}
          height={28}
          tone={tone}
          fill
          strokeWidth={1.5}
        />
      </div>

      {/* Return % */}
      <div className="tabular text-sm font-semibold min-w-[72px] text-right sm:text-left">
        <span
          className={
            isPos
              ? "text-up"
              : eval_.status === "active"
                ? "text-text-muted"
                : "text-down"
          }
        >
          {eval_.status === "active" ? (
            <>
              {formatPct(eval_.returnPct, { sign: true })}
              <span className="text-xs font-normal text-text-faint ml-1">
                (live)
              </span>
            </>
          ) : (
            formatPct(eval_.returnPct, { sign: true })
          )}
        </span>
      </div>

      {/* Dates */}
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="text-xs text-text-faint">
          <span className="text-text-muted">Started</span>{" "}
          <span className="tabular">{dateLabel(eval_.startedAt)}</span>
        </div>
        {eval_.endedAt && (
          <div className="text-xs text-text-faint">
            <span className="text-text-muted">
              {eval_.status === "passed"
                ? "Passed"
                : eval_.status === "failed"
                  ? "Failed"
                  : "Ended"}
            </span>{" "}
            <span className="tabular">{dateLabel(eval_.endedAt)}</span>
          </div>
        )}
      </div>

      {/* Permalink */}
      <a
        href={suiExplorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-text-faint hover:text-info transition-colors shrink-0"
        aria-label="Verify ↗"
        title="Verify ↗"
      >
        <ExternalLink size={12} />
        <span className="hidden sm:inline">Verify ↗</span>
      </a>
    </div>
  );
}

interface EvaluationHistoryProps {
  evaluations: VaultSummary[];
}

export function EvaluationHistory({ evaluations }: EvaluationHistoryProps) {
  if (evaluations.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-text-faint text-center py-8">
            No evaluations yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardLabel>Evaluation History</CardLabel>
        <span className="text-xs text-text-faint tabular">
          {evaluations.length} evaluation{evaluations.length !== 1 ? "s" : ""}
        </span>
      </CardHeader>
      <CardContent className="py-0 px-4">
        {evaluations.map((ev, i) => (
          <EvaluationRow key={ev.vaultId} eval_={ev} index={i} />
        ))}
      </CardContent>
      <div className="px-4 py-3 border-t border-border-soft flex items-center gap-2 text-xs text-text-faint">
        <ExternalLink size={11} />
        Every evaluation is independently verifiable — each result is a
        permanent, non-transferable record.
      </div>
    </Card>
  );
}
