"use client";

import confetti from "canvas-confetti";
import Link from "next/link";
import * as React from "react";
import { use } from "react";
import { SbtLevelReveal } from "@/components/terminal/SbtLevelReveal";
import { ShareCard } from "@/components/terminal/ShareCard";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardLabel,
  StatTile,
} from "@/components/ui";
import { Redirect } from "@/components/Redirect";
import { useAuthoritativeStatus } from "@/lib/evaluation/authoritativeStatus";
import { useSbt, useSession, useVault } from "@/lib/mock/hooks";
import { formatPct, formatUsd } from "@/lib/utils";

function PassedContent({ vaultId }: { vaultId: string }) {
  const vault = useVault(vaultId);
  const status = useAuthoritativeStatus(vaultId);
  const { session } = useSession();
  const sbt = useSbt(session.address ?? undefined);
  const confettiFired = React.useRef(false);

  React.useEffect(() => {
    if (confettiFired.current) return;
    confettiFired.current = true;

    // Respect reduced-motion: no confetti, the page still celebrates statically.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // One restrained burst, calm accent colors only.
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.5 },
      colors: ["#e5484d", "#34d399", "#a1a1aa"],
      startVelocity: 30,
      gravity: 1,
      ticks: 160,
    });
  }, []);

  const returnPct =
    ((vault.equity - vault.startingEquity) / vault.startingEquity) * 100;
  const nextTier =
    vault.tier.id === "starter"
      ? "Basic"
      : vault.tier.id === "basic"
        ? "Pro"
        : null;
  const tradeCount = vault.intentCount;

  // Derive a simple profit-to-target ratio
  const targetGain = vault.startingEquity * vault.tier.profitTarget;
  const actualGain = vault.equity - vault.startingEquity;

  // Only the genuinely-passed vault shows this screen; anything else bounces
  // back to the cockpit, which routes it to the correct terminal (or live) view.
  if (status !== "passed") return <Redirect href={`/evaluation/${vaultId}`} />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12 space-y-8">
      {/* Hero header */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Badge variant="up" className="text-sm px-3 py-1">
            ✓ Evaluation Passed
          </Badge>
        </div>

        <h1 className="text-balance text-4xl sm:text-5xl font-bold text-text tracking-tight">
          {vault.tier.name} <span className="text-brand">Complete</span>
        </h1>

        <p className="text-text-muted text-base max-w-md mx-auto">
          You have satisfied all evaluation criteria for the{" "}
          <strong className="text-text">{vault.tier.name}</strong> tier.
          {nextTier
            ? ` Your next evaluation — ${nextTier} — is now unlocked.`
            : " You have achieved the highest tier in the closed beta."}
        </p>
      </div>

      {/* SBT level-up reveal */}
      <div className="flex justify-center">
        <SbtLevelReveal
          sbt={sbt}
          prevLevel={Math.max(0, sbt.level - 1)}
          className="py-2"
        />
      </div>

      {/* Final stats */}
      <Card>
        <CardHeader>
          <CardLabel>Final results</CardLabel>
          <Badge variant="leverage" className="text-xs">
            {vault.tier.name} · {vault.tier.leverage}X
          </Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            label="Final equity"
            value={formatUsd(vault.equity, { decimals: 0 })}
            delta={formatPct(returnPct)}
            deltaTone={returnPct >= 0 ? "up" : "down"}
          />
          <StatTile
            label="Net gain"
            value={
              <span className="text-up tabular">
                {formatUsd(Math.max(0, actualGain), { decimals: 0 })}
              </span>
            }
            delta={`Target was ${formatUsd(targetGain, { decimals: 0 })}`}
            deltaTone="up"
          />
          <StatTile
            label="Trades submitted"
            value={<span className="tabular">{tradeCount}</span>}
            delta={`of ${vault.tier.intentCap} trade limit`}
            deltaTone="muted"
          />
          <StatTile
            label="Account size"
            value={formatUsd(vault.tier.shadowAllocation, { decimals: 0 })}
          />
        </CardContent>
      </Card>

      {/* Share card */}
      <div>
        <p className="text-xs uppercase tracking-wide text-text-muted mb-3">
          Share your result
        </p>
        <ShareCard vault={vault} sbt={sbt} />
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        {nextTier ? (
          <>
            <Link href="/start" className="w-full sm:w-auto">
              <Button variant="brand" size="lg" className="w-full">
                Continue to {nextTier} →
              </Button>
            </Link>
            <Link href="/leaderboard" className="w-full sm:w-auto">
              <Button variant="ghost" size="lg" className="w-full">
                View leaderboard
              </Button>
            </Link>
          </>
        ) : (
          <>
            <Link href="/leaderboard" className="w-full sm:w-auto">
              <Button variant="brand" size="lg" className="w-full">
                View leaderboard
              </Button>
            </Link>
            <Link
              href={`/profile/${session.address ?? ""}`}
              className="w-full sm:w-auto"
            >
              <Button variant="outline" size="lg" className="w-full">
                My profile
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function PassedPage({
  params,
}: {
  params: Promise<{ vaultId: string }>;
}) {
  const { vaultId } = use(params);
  return <PassedContent vaultId={vaultId} />;
}
