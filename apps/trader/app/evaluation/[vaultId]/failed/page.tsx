"use client";

import Link from "next/link";
import * as React from "react";
import { use } from "react";
import { FailureDebrief } from "@/components/terminal/FailureDebrief";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardLabel,
} from "@/components/ui";
import { DEMO_TRADES, SEED_NOW, TIERS } from "@/lib/mock/fixtures";
import {
  useCohortStats,
  useEquityCurve,
  useSession,
  useVault,
} from "@/lib/mock/hooks";
import type { RuleKind, TradeRecord, VaultState } from "@/lib/mock/types";

/**
 * Local fixture that adds a failed state to the demo vault for display purposes.
 * This avoids modifying the shared mock layer while still providing a realistic
 * terminal-state screen.
 */
const FAILED_TRIGGER_TRADE: TradeRecord = {
  ...DEMO_TRADES[0],
  id: "trd_fail_1",
  symbol: "ETH",
  side: "short",
  sizeUsd: 3500,
  oracleMid: 3_488.4,
  fill: 3_487.7,
  slippageBps: 0,
  tiltBps: 2,
  realizedPnl: -520.0,
  ts: SEED_NOW - 2 * 60_000,
  txDigest: "7Bz9kR4Nm2Tz6Lv1Cx8Ws3Hj5Af0Ed4Yk7Nc9Pr2Qx",
};

const FAILED_VIOLATED_RULE: RuleKind = "drawdown";

function buildFailedVault(vault: VaultState): VaultState {
  const failedEquity = vault.startingEquity * 0.892;
  const peakEquity = vault.startingEquity * 1.032;
  return {
    ...vault,
    status: "failed",
    equity: failedEquity,
    peakEquity,
    triggerTrade: FAILED_TRIGGER_TRADE,
    violatedRule: FAILED_VIOLATED_RULE,
  };
}

function FailedContent({ vaultId }: { vaultId: string }) {
  const rawVault = useVault(vaultId);
  const vault = React.useMemo(() => buildFailedVault(rawVault), [rawVault]);
  const cohort = useCohortStats();
  const equityCurve = useEquityCurve(vaultId);
  const { session } = useSession();

  const equitySpark = React.useMemo(
    () => equityCurve.map((p) => p.equity),
    [equityCurve],
  );

  const lowerTier =
    vault.tier.id === "pro"
      ? TIERS.find((t) => t.id === "basic")
      : vault.tier.id === "basic"
        ? TIERS.find((t) => t.id === "starter")
        : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="down">Evaluation ended</Badge>
          <Badge variant="outline">{vault.tier.name}</Badge>
        </div>

        <h1 className="text-balance text-3xl sm:text-4xl font-bold text-text tracking-tight">
          This evaluation has closed
        </h1>

        <p className="text-text-muted text-base max-w-prose">
          A rule was breached and the evaluation was automatically terminated.
          Your progress and trade history are preserved below. Every closed
          evaluation is a data point — review the debrief and come back
          stronger.
        </p>
      </div>

      {/* Failure debrief */}
      <FailureDebrief vault={vault} cohort={cohort} equitySpark={equitySpark} />

      {/* Rule overview for the tier */}
      <Card>
        <CardHeader>
          <CardLabel>{vault.tier.name} tier rules</CardLabel>
          <Badge variant="leverage">{vault.tier.leverage}X</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {vault.rules.map((rule) => (
            <div
              key={rule.kind}
              className="flex items-center justify-between py-1.5 border-b border-border-soft last:border-0"
            >
              <span className="text-sm text-text-muted">{rule.label}</span>
              <div className="flex items-center gap-2">
                <span className="tabular text-sm text-text">
                  {rule.unit === "usd"
                    ? `${(rule.used * 100).toFixed(1)}%`
                    : rule.unit === "count"
                      ? `${rule.current} / ${rule.limit}`
                      : `${(rule.used * 100).toFixed(1)}%`}
                </span>
                <span
                  className={
                    rule.zone === "danger"
                      ? "text-xs text-down"
                      : rule.zone === "warn"
                        ? "text-xs text-warn"
                        : "text-xs text-up"
                  }
                >
                  {rule.zone === "danger"
                    ? "Breached"
                    : rule.zone === "warn"
                      ? "Near limit"
                      : "OK"}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CTAs */}
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-text-muted">
          What would you like to do?
        </p>
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <Link href="/start" className="flex-1">
            <Button variant="primary" size="lg" className="w-full">
              Retry {vault.tier.name} evaluation
            </Button>
          </Link>

          {lowerTier && (
            <Link href="/start" className="flex-1">
              <Button variant="outline" size="lg" className="w-full">
                Start {lowerTier.name} instead
              </Button>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Link href="/leaderboard">
            <Button variant="ghost" size="sm">
              Leaderboard
            </Button>
          </Link>
          {session.address && (
            <Link href={`/profile/${session.address}`}>
              <Button variant="ghost" size="sm">
                My profile
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FailedPage({
  params,
}: {
  params: Promise<{ vaultId: string }>;
}) {
  const { vaultId } = use(params);
  return <FailedContent vaultId={vaultId} />;
}
