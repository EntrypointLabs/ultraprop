"use client";

import {
  AssetIcon,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardLabel,
  Sparkline,
  StatTile,
} from "@/components/ui";
import type {
  CohortStats,
  RuleKind,
  TradeRecord,
  VaultState,
} from "@/lib/mock/types";
import { cn, formatPct, formatUsd } from "@/lib/utils";

export interface FailureDebriefProps {
  vault: VaultState;
  cohort: CohortStats;
  equitySpark: number[];
  className?: string;
}

const RULE_LABELS: Record<RuleKind, string> = {
  drawdown: "Max Drawdown",
  dailyLoss: "Daily Loss Limit",
  profitTarget: "Profit Target",
  intentCount: "Trade Limit",
};

const RULE_DESCRIPTIONS: Record<RuleKind, string> = {
  drawdown: "Equity fell more than the allowed maximum drawdown from peak.",
  dailyLoss: "Cumulative loss for the day exceeded the daily loss limit.",
  profitTarget: "Profit target was not reached within the evaluation window.",
  intentCount: "The maximum number of trades was consumed.",
};

function TriggerTradeRow({ trade }: { trade: TradeRecord }) {
  const isLong = trade.side === "long";
  return (
    <div className="rounded-[var(--radius)] border border-border-soft bg-surface-2 px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <AssetIcon symbol={trade.symbol} size={20} />
        <span className="font-semibold text-text">{trade.symbol}</span>
        <Badge variant={isLong ? "up" : "down"}>
          {isLong ? "Long" : "Short"}
        </Badge>
        <span className="ml-auto text-xs text-text-faint tabular">
          {new Date(trade.ts).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted mb-0.5">
            Size
          </p>
          <p className="tabular text-sm font-semibold text-text">
            {formatUsd(trade.sizeUsd, { decimals: 0 })}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted mb-0.5">
            Market mid
          </p>
          <p className="tabular text-sm font-semibold text-text">
            {formatUsd(trade.oracleMid)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted mb-0.5">
            Fill
          </p>
          <p className="tabular text-sm font-semibold text-text">
            {formatUsd(trade.fill)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted mb-0.5">
            PnL
          </p>
          <p
            className={cn(
              "tabular text-sm font-semibold",
              trade.realizedPnl >= 0 ? "text-up" : "text-down",
            )}
          >
            {formatUsd(trade.realizedPnl, { sign: true })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-text-faint">Slippage</span>
        <span className="tabular text-xs text-text-muted">
          {trade.slippageBps} bps
        </span>
        <span className="text-xs text-text-faint">+ house tilt</span>
        <span className="tabular text-xs text-text-muted">
          +{trade.tiltBps} bps
        </span>
        <a
          href={`https://suiexplorer.com/txblock/${trade.txDigest}?network=mainnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-violet hover:text-violet-hover hover:underline"
          title={trade.txDigest}
        >
          Verify ↗
        </a>
      </div>
    </div>
  );
}

function CohortComparison({
  vault,
  cohort,
}: {
  vault: VaultState;
  cohort: CohortStats;
}) {
  const returnPct =
    ((vault.equity - vault.startingEquity) / vault.startingEquity) * 100;
  const medianPct = cohort.medianPasserReturnPct;
  const gap = medianPct - returnPct;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted mb-1">
            Your return
          </p>
          <p
            className={cn(
              "tabular text-2xl font-bold",
              returnPct >= 0 ? "text-up" : "text-down",
            )}
          >
            {formatPct(returnPct)}
          </p>
        </div>
        <div className="h-10 w-px bg-border mx-2" />
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted mb-1">
            Cohort median (passers)
          </p>
          <p className="tabular text-2xl font-bold text-text-muted">
            {formatPct(medianPct)}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs uppercase tracking-wide text-text-muted mb-1">
            Gap to median
          </p>
          <p
            className={cn(
              "tabular text-lg font-semibold",
              gap > 0 ? "text-down" : "text-up",
            )}
          >
            {gap > 0 ? "-" : "+"}
            {Math.abs(gap).toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="rounded-[var(--radius)] bg-surface-2 px-4 py-3 text-sm text-text-muted">
        <span className="font-semibold text-text">
          {Math.round(cohort.passRate * 100)}%
        </span>{" "}
        of cohort members have passed an evaluation.{" "}
        <span className="font-semibold text-text">{cohort.totalPasses}</span>{" "}
        total passes across{" "}
        <span className="font-semibold text-text">{cohort.members}</span>{" "}
        members.
      </div>
    </div>
  );
}

export function FailureDebrief({
  vault,
  cohort,
  equitySpark,
  className,
}: FailureDebriefProps) {
  const violatedRule = vault.violatedRule;
  const triggerTrade = vault.triggerTrade;
  const returnPct =
    ((vault.equity - vault.startingEquity) / vault.startingEquity) * 100;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Violated rule callout */}
      {violatedRule && (
        <div className="rounded-[var(--radius)] border border-down/30 bg-down/5 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-down shrink-0" />
            <span className="text-xs uppercase tracking-wide font-semibold text-down">
              Rule breached — {RULE_LABELS[violatedRule]}
            </span>
          </div>
          <p className="text-sm text-text-muted pl-3.5">
            {RULE_DESCRIPTIONS[violatedRule]}
          </p>
        </div>
      )}

      {/* Stats at termination */}
      <Card>
        <CardHeader>
          <CardLabel>Final stats</CardLabel>
          <Badge variant="down">Failed</Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            label="Final equity"
            value={formatUsd(vault.equity, { decimals: 0 })}
            delta={formatPct(returnPct)}
            deltaTone={returnPct >= 0 ? "up" : "down"}
          />
          <StatTile
            label="Starting equity"
            value={formatUsd(vault.startingEquity, { decimals: 0 })}
          />
          <StatTile
            label="Peak equity"
            value={formatUsd(vault.peakEquity, { decimals: 0 })}
          />
          <StatTile
            label="Trades submitted"
            value={<span className="tabular">{vault.intentCount}</span>}
          />
        </CardContent>
      </Card>

      {/* Equity curve up to failure */}
      <Card>
        <CardHeader>
          <CardLabel>Equity curve</CardLabel>
          <span className="text-xs text-text-faint tabular">
            Start → termination
          </span>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-hidden">
            <Sparkline
              data={equitySpark}
              width={480}
              height={56}
              fill
              tone={returnPct >= 0 ? "up" : "down"}
              strokeWidth={2}
              className="max-w-full"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-text-faint">
            <span className="tabular">
              {formatUsd(equitySpark[0] ?? vault.startingEquity, {
                decimals: 0,
              })}
            </span>
            <span className="tabular">
              {formatUsd(equitySpark[equitySpark.length - 1] ?? vault.equity, {
                decimals: 0,
              })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Trigger trade */}
      {triggerTrade && (
        <Card>
          <CardHeader>
            <CardLabel>Trigger trade</CardLabel>
            <span className="text-xs text-text-faint">
              The trade that ended this evaluation
            </span>
          </CardHeader>
          <CardContent>
            <TriggerTradeRow trade={triggerTrade} />
          </CardContent>
        </Card>
      )}

      {/* Cohort comparison */}
      <Card>
        <CardHeader>
          <CardLabel>Your stats vs. cohort</CardLabel>
          <Badge variant="genesis">{cohort.cohort}</Badge>
        </CardHeader>
        <CardContent>
          <CohortComparison vault={vault} cohort={cohort} />
        </CardContent>
      </Card>
    </div>
  );
}
