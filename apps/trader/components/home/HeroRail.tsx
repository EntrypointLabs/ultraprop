"use client";

import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { Avatar, Badge, Button } from "@/components/ui";
import { userVaultId } from "@/lib/auth";
import { accountHandle } from "@/lib/identity";
import { useLeaderboard, useTiers } from "@/lib/mock/hooks";
import { useAccountSetup } from "@/lib/sui/useTradingAccount";
import { cn, formatPct, formatUsd } from "@/lib/utils";

export function HeroRail() {
  return (
    <div className="flex flex-col gap-4">
      <StartPromoCard />
      <CompactTierCards />
      <TrendingTraders />
    </div>
  );
}

function StartPromoCard() {
  const { hasAccount, suiAddress } = useAccountSetup();
  // A trader with an on-chain account is already evaluating — send them straight
  // back into their cockpit instead of the tier picker.
  const resume = Boolean(hasAccount && suiAddress);
  const href = resume
    ? `/evaluation/${userVaultId(suiAddress as string)}`
    : "/start";

  return (
    <div className="rounded-[var(--radius-lg)] border border-violet/30 bg-surface overflow-hidden">
      {/* Violet gradient strip */}
      <div className="h-1 w-full bg-gradient-to-r from-violet/60 via-violet to-violet/40" />
      <div className="p-5">
        <div className="mb-1 text-xs font-medium uppercase tracking-widest text-text-muted">
          v1 Genesis — Open now
        </div>
        <h3 className="text-base font-bold text-text leading-snug">
          {resume ? "Your evaluation is live" : "Start your evaluation"}
        </h3>
        <p className="mt-1.5 text-sm text-text-muted leading-relaxed">
          {resume
            ? "Pick up where you left off. Your account, balance, and rule compliance are tracked on-chain."
            : "Trade the full Bluefin, DeepBook & Hyperliquid perpetual catalog against live market prices. Every rule is enforced automatically. Prove your edge."}
        </p>
        <Link href={href} className="mt-4 block">
          <Button variant="primary" size="md" className="w-full gap-1.5">
            {resume ? "Resume evaluation" : "Begin evaluation"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function CompactTierCards() {
  const tiers = useTiers();
  const displayTiers = tiers.slice(0, 3);

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
          Evaluation tiers
        </span>
        <Link
          href="/start"
          className="text-xs text-text-faint transition-colors hover:text-text"
        >
          All tiers
        </Link>
      </div>
      <div className="divide-y divide-border-soft">
        {displayTiers.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              tier.locked && "opacity-60",
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-text">{tier.name}</span>
                {tier.locked && <Lock className="h-3 w-3 text-text-faint" aria-hidden="true" />}
              </div>
              <div className="tabular mt-0.5 text-xs text-text-muted">
                {formatUsd(tier.shadowAllocation, { decimals: 0 })} account
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="tabular text-xs font-medium text-up">
                +{formatPct(tier.profitTarget * 100, { sign: false, decimals: 0 })} target
              </div>
              <div className="tabular text-xs text-down">
                {formatPct(tier.maxDrawdown * 100, { sign: false, decimals: 0 })} max DD
              </div>
            </div>
            <Badge variant="leverage" className="shrink-0 tabular">
              {tier.leverage}X
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendingTraders() {
  const entries = useLeaderboard({ axis: "shadowPnl", window: "weekly" });
  const top4 = entries.slice(0, 4);

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
          Trending traders
        </span>
        <Link
          href="/leaderboard"
          className="text-xs text-text-faint transition-colors hover:text-text"
        >
          Leaderboard
        </Link>
      </div>
      <div className="divide-y divide-border-soft">
        {top4.map((entry) => {
          const isUp = entry.shadowPnl >= 0;
          return (
            <Link
              key={entry.wallet}
              href={`/profile/${entry.wallet}`}
              className="flex items-center gap-2.5 px-4 py-2.5 transition-[background-color] duration-150 ease-out hover:bg-surface-2"
            >
              <span className="tabular w-5 shrink-0 text-xs text-text-faint">
                #{entry.rank}
              </span>
              <Avatar address={entry.wallet} size={24} />
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium text-text">
                  {entry.displayName ?? accountHandle(entry.wallet)}
                </div>
                <Badge variant="tier" className="mt-0.5 uppercase text-[10px]">
                  {entry.tier}
                </Badge>
              </div>
              <div
                className={cn(
                  "tabular shrink-0 text-sm font-semibold",
                  isUp ? "text-up" : "text-down",
                )}
              >
                {formatUsd(entry.shadowPnl, { sign: true })}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
