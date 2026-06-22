"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { use } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardLabel,
  Sparkline,
  StatTile,
} from "@/components/ui";
import { useEquityCurve, useSession, useVault } from "@/lib/mock/hooks";
import type { VaultState } from "@/lib/mock/types";
import { usePaperEngine } from "@/lib/sim/usePaperEngine";
import { formatPct, formatUsd } from "@/lib/utils";

/** Derives days idle from inactiveAt and a fixed 7-day window. */
function daysIdle(vault: VaultState): number {
  const windowMs = 7 * 24 * 60 * 60 * 1000;
  const elapsed = vault.inactiveAt - (vault.startedAt + windowMs);
  if (elapsed <= 0) return 7;
  return Math.min(7, Math.ceil(elapsed / (24 * 60 * 60 * 1000)));
}

function InactiveContent({ vaultId }: { vaultId: string }) {
  const router = useRouter();
  const vault = useVault(vaultId);
  const equityCurve = useEquityCurve(vaultId);
  const { session } = useSession();
  const { resume } = usePaperEngine(vaultId, vault.tier);

  // Resume reactivates the paused eval, then returns to its cockpit. The cockpit
  // routes terminal states itself, so a vault that re-activates lands on the
  // live cockpit and a still-terminal one bounces straight back.
  function handleResume() {
    resume();
    router.replace(`/evaluation/${vaultId}`);
  }

  const equitySpark = React.useMemo(
    () => equityCurve.map((p) => p.equity),
    [equityCurve],
  );

  const returnPct =
    ((vault.equity - vault.startingEquity) / vault.startingEquity) * 100;
  const idleDays = daysIdle(vault);
  const nextTierUp =
    vault.tier.id === "starter"
      ? "Basic"
      : vault.tier.id === "basic"
        ? "Pro"
        : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="pending">Inactive</Badge>
          <Badge variant="outline">{vault.tier.name}</Badge>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-text tracking-tight mb-2">
            Evaluation paused
          </h1>
          <p className="text-text-muted text-base">
            This evaluation was automatically closed after{" "}
            <strong className="text-text tabular">{idleDays} days</strong>{" "}
            without any trading activity. There is no penalty — your progress up
            to the last trade is preserved.
          </p>
        </div>

        {/* Warm callout box */}
        <div className="rounded-[var(--radius)] border border-border bg-surface-2 px-4 py-3 flex items-start gap-3">
          <div className="mt-0.5">
            <div className="h-2 w-2 rounded-full bg-warn live-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text mb-0.5">
              No penalty, no data lost
            </p>
            <p className="text-sm text-text-muted">
              Idle auto-close protects the integrity of the evaluation window.
              Start a fresh evaluation any time — your credential history and
              leaderboard standing carry over.
            </p>
          </div>
        </div>
      </div>

      {/* Progress snapshot */}
      <Card>
        <CardHeader>
          <CardLabel>Evaluation snapshot</CardLabel>
          <span className="text-xs text-text-faint tabular">At auto-close</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Equity at close"
              value={formatUsd(vault.equity, { decimals: 0 })}
              delta={formatPct(returnPct)}
              deltaTone={returnPct >= 0 ? "up" : "down"}
            />
            <StatTile
              label="Account size"
              value={formatUsd(vault.tier.shadowAllocation, { decimals: 0 })}
            />
            <StatTile
              label="Trades submitted"
              value={<span className="tabular">{vault.intentCount}</span>}
              delta={`of ${vault.tier.intentCap} trade limit`}
              deltaTone="muted"
            />
            <StatTile
              label="Profit target"
              value={
                <span className="tabular text-text-muted">
                  +{(vault.tier.profitTarget * 100).toFixed(0)}%
                </span>
              }
              delta={`Required to pass ${vault.tier.name}`}
              deltaTone="muted"
            />
          </div>

          {/* Mini equity curve */}
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted mb-2">
              Equity curve
            </p>
            <div className="relative overflow-hidden">
              <Sparkline
                data={equitySpark}
                width={480}
                height={64}
                fill
                tone={returnPct >= 0 ? "up" : "neutral"}
                strokeWidth={1.5}
                className="max-w-full"
              />
              <div className="absolute inset-x-0 bottom-0 flex justify-between text-xs text-text-faint tabular px-0.5">
                <span>
                  {formatUsd(equitySpark[0] ?? vault.startingEquity, {
                    decimals: 0,
                  })}
                </span>
                <span>
                  {formatUsd(
                    equitySpark[equitySpark.length - 1] ?? vault.equity,
                    { decimals: 0 },
                  )}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What you can do */}
      <Card>
        <CardHeader>
          <CardLabel>Continue trading</CardLabel>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-text-muted">
            Open a new evaluation for the same tier and pick up from where your
            trading discipline left off. Your previous stats and credential
            level are unchanged.
          </p>

          <ul className="space-y-2 text-sm text-text-muted">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-brand">✓</span>
              Fresh{" "}
              <strong className="text-text">
                {formatUsd(vault.tier.shadowAllocation, { decimals: 0 })}
              </strong>{" "}
              account size to trade
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-brand">✓</span>
              Same{" "}
              <strong className="text-text">
                {(vault.tier.profitTarget * 100).toFixed(0)}% profit target
              </strong>{" "}
              and{" "}
              <strong className="text-text">
                {(vault.tier.maxDrawdown * 100).toFixed(0)}% max drawdown
              </strong>
            </li>
            {nextTierUp && (
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand">✓</span>
                Pass to unlock the{" "}
                <strong className="text-text">{nextTierUp}</strong> tier
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-stretch gap-3">
        <Button
          variant="brand"
          size="lg"
          className="flex-1"
          onClick={handleResume}
        >
          Resume trading — {vault.tier.name}
        </Button>
        <Link href="/leaderboard" className="flex-1 sm:flex-none">
          <Button variant="outline" size="lg" className="w-full">
            Leaderboard
          </Button>
        </Link>
      </div>

      {session.address && (
        <div className="flex justify-center">
          <Link href={`/profile/${session.address}`}>
            <Button variant="ghost" size="sm" className="text-text-faint">
              View my profile
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function InactivePage({
  params,
}: {
  params: Promise<{ vaultId: string }>;
}) {
  const { vaultId } = use(params);
  return <InactiveContent vaultId={vaultId} />;
}
