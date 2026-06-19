"use client";

import { CheckCircle, Lock } from "lucide-react";
import type * as React from "react";
import { Badge, Button, CardContent } from "@/components/ui";
import type { Tier } from "@/lib/mock/types";
import { cn, formatPct, formatUsd } from "@/lib/utils";

/**
 * What the card's CTA should do, derived by the grid from the trader's on-chain
 * account:
 *  - `start`    no account yet → open onboarding for this tier.
 *  - `continue` this is the tier they already own → resume their evaluation.
 *  - `payment`  no account, but this tier is unlocked by paying → onboarding.
 *  - `locked`   unavailable, with a reason (owned elsewhere / coming soon).
 *  - `loading`  account check still in flight.
 */
export type TierCta =
  | { kind: "start" }
  | { kind: "continue" }
  | { kind: "payment" }
  | { kind: "locked"; reason: string }
  | { kind: "loading" };

export interface TierCardProps {
  tier: Tier;
  cta: TierCta;
  selected: boolean;
  onSelect: () => void;
  onStart: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

const TIER_DESCRIPTIONS: Record<Tier["id"], string> = {
  starter:
    "Begin your evaluation. Trade the full Bluefin, DeepBook & Hyperliquid perpetual catalog in simulation with automatic rule enforcement.",
  basic:
    "Elevated capital, tighter rules. Pay the evaluation fee to open a Basic account.",
  pro: "Maximum account size. Reserved for traders who have proven themselves at every level.",
};

const TIER_ACCENT: Record<Tier["id"], string> = {
  starter: "from-violet/10 to-transparent",
  basic: "from-brand/8 to-transparent",
  pro: "from-up/8 to-transparent",
};

const TIER_BORDER_SELECTED: Record<Tier["id"], string> = {
  starter: "border-violet",
  basic: "border-brand/60",
  pro: "border-up/60",
};

function badgeLabel(cta: TierCta): string {
  switch (cta.kind) {
    case "continue":
      return "ACTIVE";
    case "start":
    case "payment":
      return "OPEN";
    default:
      return "LOCKED";
  }
}

interface StatRowProps {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}

function StatRow({ label, value, highlight }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-soft last:border-0">
      <span className="text-xs text-text-muted uppercase tracking-wide">
        {label}
      </span>
      <span
        className={cn(
          "tabular text-sm font-medium",
          highlight ? "text-brand" : "text-text",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function TierCard({
  tier,
  cta,
  selected,
  onSelect,
  onStart,
  disabled = false,
  disabledReason,
}: TierCardProps) {
  const isLocked = cta.kind === "locked" || cta.kind === "loading";
  const selectable = cta.kind === "start" || cta.kind === "continue" || cta.kind === "payment";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Select ${tier.name} tier`}
      onClick={() => selectable && onSelect()}
      onKeyDown={(e) => {
        if (selectable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "lift relative flex flex-col rounded-[var(--radius-lg)] border bg-surface cursor-pointer focus-visible:outline-2 focus-visible:outline-violet focus-visible:outline-offset-2",
        selected
          ? cn(
              "border-2 shadow-lg shadow-black/30",
              TIER_BORDER_SELECTED[tier.id],
            )
          : "border-border hover:border-border hover:bg-surface-2/50",
        isLocked && "opacity-60 cursor-default",
      )}
    >
      {/* Gradient accent top */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-24 rounded-t-[var(--radius-lg)] bg-gradient-to-b pointer-events-none",
          TIER_ACCENT[tier.id],
        )}
      />

      {/* Selected ring indicator */}
      {selected && !isLocked && (
        <div className="absolute top-3 right-3 z-10">
          <CheckCircle className="h-4 w-4 text-violet" aria-hidden="true" />
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Badge variant="leverage">{tier.leverage}X</Badge>
            <Badge variant={isLocked ? "default" : "tier"}>
              {badgeLabel(cta)}
            </Badge>
          </div>
        </div>

        <h2 className="text-balance text-2xl font-bold text-text tracking-tight mt-3">
          {tier.name}
        </h2>
        <p className="text-sm text-text-muted mt-1 leading-relaxed">
          {TIER_DESCRIPTIONS[tier.id]}
        </p>

        {/* Shadow capital — the headline number */}
        <div className="mt-4">
          <div className="tabular text-3xl font-bold text-text">
            {formatUsd(tier.shadowAllocation, { decimals: 0 })}
          </div>
          <div className="text-xs text-text-muted mt-0.5 uppercase tracking-wide">
            Account size
          </div>
        </div>
      </div>

      {/* Stats */}
      <CardContent className={cn("relative z-10 pt-0 flex-1")}>
        <div className="rounded-[var(--radius)] bg-surface-2 px-4 py-1 mb-4">
          <StatRow
            label="Profit target"
            value={formatPct(tier.profitTarget * 100, {
              sign: false,
              decimals: 0,
            })}
            highlight
          />
          <StatRow
            label="Max drawdown"
            value={formatPct(tier.maxDrawdown * 100, {
              sign: false,
              decimals: 0,
            })}
          />
          <StatRow
            label="Daily loss limit"
            value={formatPct(tier.dailyLoss * 100, {
              sign: false,
              decimals: 0,
            })}
          />
          <StatRow label="Trade limit" value={`${tier.intentCap} trades`} />
        </div>

        {/* CTA */}
        <TierCtaSlot
          tier={tier}
          cta={cta}
          disabled={disabled}
          disabledReason={disabledReason}
          onStart={onStart}
        />
      </CardContent>
    </div>
  );
}

function LockSlot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius)] bg-surface-3 px-4 py-3 text-sm text-text-muted">
      <Lock className="h-4 w-4 shrink-0 text-text-faint" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function TierCtaSlot({
  tier,
  cta,
  disabled,
  disabledReason,
  onStart,
}: {
  tier: Tier;
  cta: TierCta;
  disabled: boolean;
  disabledReason?: string;
  onStart: () => void;
}) {
  if (cta.kind === "loading") {
    return (
      <Button variant="primary" size="lg" className="w-full" disabled>
        Checking your account…
      </Button>
    );
  }

  if (cta.kind === "locked") {
    return <LockSlot>{cta.reason}</LockSlot>;
  }

  const label =
    cta.kind === "continue"
      ? "Continue"
      : cta.kind === "payment"
        ? `Pay & start ${tier.name}`
        : `Start ${tier.name}`;

  return (
    <>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={disabled}
        title={disabledReason}
        onClick={(e) => {
          e.stopPropagation();
          onStart();
        }}
      >
        {label}
      </Button>
      {cta.kind === "payment" && !disabled && (
        <p className="mt-2 text-center text-xs text-text-muted">
          Requires payment of the evaluation fee.
        </p>
      )}
      {disabled && disabledReason && (
        <p className="mt-2 text-center text-xs text-text-muted">
          {disabledReason}
        </p>
      )}
    </>
  );
}
