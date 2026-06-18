"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { TIERS } from "@/lib/mock/fixtures";
import {
  useCohortStats,
  useEquityCurve,
  useSession,
  useVault,
} from "@/lib/mock/hooks";

function FailedContent({ vaultId }: { vaultId: string }) {
  const router = useRouter();
  const vault = useVault(vaultId);
  const cohort = useCohortStats();
  const equityCurve = useEquityCurve(vaultId);
  const { session } = useSession();

  // The failed screen reflects the REAL terminated vault. A vault reached here
  // only via the cockpit flipping status to "failed"; a direct nav (or a vault
  // that never failed) has no debrief to show, so bounce back to its cockpit
  // rather than fabricating a failure.
  const isFailed = vault.status === "failed";
  React.useEffect(() => {
    if (!isFailed) router.replace(`/evaluation/${vaultId}`);
  }, [isFailed, router, vaultId]);

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

  if (!isFailed) return null;

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
