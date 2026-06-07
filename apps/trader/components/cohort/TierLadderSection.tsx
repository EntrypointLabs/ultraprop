"use client";

import { Badge, Card, Tooltip } from "@/components/ui";
import { useTiers } from "@/lib/mock/hooks";
import { cn, formatPct } from "@/lib/utils";

const TIER_ACCENT: Record<string, string> = {
  starter: "border-brand/30 bg-brand/5",
  basic: "border-violet/30 bg-violet/5",
  pro: "border-up/30 bg-up/5",
};

const TIER_LABEL_COLOR: Record<string, string> = {
  starter: "text-brand",
  basic: "text-violet",
  pro: "text-up",
};

interface TierRowProps {
  label: string;
  value: string;
  tooltip?: string;
}

function TierRow({ label, value, tooltip }: TierRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0">
      {tooltip ? (
        <Tooltip content={tooltip} side="top">
          <span className="text-xs text-text-muted cursor-default underline decoration-dotted decoration-text-faint underline-offset-2">
            {label}
          </span>
        </Tooltip>
      ) : (
        <span className="text-xs text-text-muted">{label}</span>
      )}
      <span className="tabular text-xs font-medium text-text">{value}</span>
    </div>
  );
}

export function TierLadderSection() {
  const tiers = useTiers();

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <Badge variant="outline" className="text-xs">
          Evaluation Tiers
        </Badge>
        <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          Three tiers. One ladder.
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-text-muted">
          Each tier is an independent evaluation with its own parameters.
          Passing Starter unlocks Basic; passing Basic unlocks Pro. The
          credential level reflects the highest tier ever passed. Rules are
          enforced identically at every tier — higher tiers require more
          discipline, not different rules.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.id}
            className={cn(
              "relative flex flex-col gap-0 overflow-hidden border",
              TIER_ACCENT[tier.id] ?? "",
            )}
          >
            {/* Tier header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-bold uppercase tracking-wider",
                    TIER_LABEL_COLOR[tier.id],
                  )}
                >
                  {tier.name}
                </span>
                {tier.locked && (
                  <Badge variant="outline" className="text-xs">
                    Locked
                  </Badge>
                )}
              </div>
              <Badge variant="leverage">{tier.leverage}X</Badge>
            </div>

            {/* Tier parameters */}
            <div className="px-4 py-2 flex-1">
              <TierRow
                label="Account Size"
                value={`$${(tier.shadowAllocation / 1000).toFixed(0)}K`}
                tooltip={`Trade with a $${tier.shadowAllocation.toLocaleString()} simulated account`}
              />
              <TierRow
                label="Profit Target"
                value={formatPct(tier.profitTarget * 100, { sign: false })}
                tooltip="Equity must reach this gain on starting balance to pass"
              />
              <TierRow
                label="Max Drawdown"
                value={formatPct(tier.maxDrawdown * 100, { sign: false })}
                tooltip="Equity may not fall more than this % below its peak"
              />
              <TierRow
                label="Daily Loss Limit"
                value={formatPct(tier.dailyLoss * 100, { sign: false })}
                tooltip="Resets 00:00 UTC. Realized + unrealized loss cap."
              />
              <TierRow
                label="Trade Limit"
                value={tier.intentCap.toLocaleString()}
                tooltip="Maximum number of trade submissions per evaluation"
              />
            </div>

            {/* Unlock path */}
            <div className="px-4 py-3 border-t border-border">
              {tier.unlockedBy ? (
                <p className="text-xs text-text-faint">
                  Requires passing{" "}
                  <span className="font-medium text-text-muted capitalize">
                    {tier.unlockedBy}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-up font-medium">
                  Entry tier — available to all cohort members
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Time / reset note */}
      <div className="rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-xs text-text-muted">
        Daily loss limits reset at{" "}
        <span className="tabular font-medium text-text">00:00 UTC</span> for
        every active evaluation. Evaluations idle for 7 consecutive days
        transition to <span className="font-medium text-text">Inactive</span>{" "}
        automatically. Evaluations trade BTC, ETH, and SOL spot only.
      </div>
    </section>
  );
}
