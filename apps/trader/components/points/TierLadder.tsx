"use client";

import { Badge } from "@/components/ui";
import { DEMO_WALLET } from "@/lib/mock/fixtures";
import { useSbt, useTiers } from "@/lib/mock/hooks";
import { cn } from "@/lib/utils";

const TIER_UNLOCKS: Record<string, string[]> = {
  Starter: [
    "Account size: $10,000",
    "Max leverage: 10×",
    "Access to BTC/ETH/SOL",
  ],
  Basic: ["Account size: $25,000", "Max leverage: 8×", "Stronger credential level"],
  Pro: [
    "Account size: $50,000",
    "Max leverage: 8×",
    "Top-tier cohort standing",
  ],
};

export function TierLadder() {
  const tiers = useTiers();
  const sbt = useSbt(DEMO_WALLET);

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">
          Tier Ladder
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiers.map((tier, idx) => {
          const passed = sbt.passedTiers.includes(tier.name);
          // Active = this tier is the next one to pass (sbt.level = # tiers passed, idx is 0-based)
          const isActive = !passed && sbt.level === idx;
          const locked = tier.locked && !passed && !isActive;

          return (
            <div
              key={tier.id}
              className={cn(
                "relative rounded-lg border bg-surface p-4 transition-[border-color,background-color,opacity]",
                passed && "border-up/40 bg-up/5",
                isActive && !passed && "border-violet/60",
                !passed && !isActive && "border-border",
              )}
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text">{tier.name}</span>
                    {passed && <Badge variant="up">Passed</Badge>}
                    {isActive && !passed && (
                      <Badge variant="genesis">Active</Badge>
                    )}
                    {locked && <Badge variant="default">Locked</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-text-faint">
                    {tier.locked && !passed
                      ? `Pass ${tier.unlockedBy ? tier.unlockedBy.charAt(0).toUpperCase() + tier.unlockedBy.slice(1) : "previous tier"} to unlock`
                      : "Available"}
                  </div>
                </div>
                <Badge variant="leverage">{tier.leverage}X</Badge>
              </div>

              {/* Stats */}
              <dl className="space-y-1.5 text-xs">
                <Row
                  label="Account size"
                  value={`$${(tier.shadowAllocation / 1000).toFixed(0)}k`}
                />
                <Row
                  label="Profit target"
                  value={`${(tier.profitTarget * 100).toFixed(0)}%`}
                />
                <Row
                  label="Max drawdown"
                  value={`${(tier.maxDrawdown * 100).toFixed(0)}%`}
                />
                <Row
                  label="Daily loss limit"
                  value={`${(tier.dailyLoss * 100).toFixed(0)}%`}
                />
                <Row label="Trade limit" value={`${tier.intentCap} trades`} />
              </dl>

              {/* What it unlocks */}
              <div className="mt-3 border-t border-border pt-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-text-faint">
                  What it unlocks
                </div>
                <ul className="space-y-1">
                  {(TIER_UNLOCKS[tier.name] ?? []).map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-1.5 text-xs text-text-muted"
                    >
                      <span className="mt-0.5 text-text-faint">▸</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Progress bar for active tier */}
              {isActive && !passed && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-text-faint">
                    <span>Your progress</span>
                    <span className="tabular text-violet">In progress</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-violet transition-[width]"
                      style={{ width: "35%" }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Arrow connectors — hidden on mobile, shown at sm */}
      <p className="mt-3 text-center text-xs text-text-faint">
        Pass each tier to unlock the next and advance your v1 Genesis credential.
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-text-faint">{label}</dt>
      <dd className="tabular font-medium text-text">{value}</dd>
    </div>
  );
}
