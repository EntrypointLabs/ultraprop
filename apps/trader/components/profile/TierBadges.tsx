import { Check, Lock } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardLabel,
} from "@/components/ui";
import type { SbtState } from "@/lib/mock/types";

const ALL_TIERS = [
  {
    id: "starter",
    name: "Starter",
    leverage: "10X",
    allocation: "$10,000",
    profitTarget: "8%",
    maxDD: "10%",
  },
  {
    id: "basic",
    name: "Basic",
    leverage: "8X",
    allocation: "$25,000",
    profitTarget: "8%",
    maxDD: "8%",
  },
  {
    id: "pro",
    name: "Pro",
    leverage: "8X",
    allocation: "$50,000",
    profitTarget: "10%",
    maxDD: "8%",
  },
] as const;

interface TierBadgesProps {
  sbt: SbtState;
}

export function TierBadges({ sbt }: TierBadgesProps) {
  return (
    <Card>
      <CardHeader>
        <CardLabel>Tier Badges Earned</CardLabel>
        <span className="tabular text-xs text-text-faint">
          {sbt.passedTiers.length} / {ALL_TIERS.length} tiers
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ALL_TIERS.map((tier) => {
            const earned = sbt.passedTiers.includes(tier.name);
            return (
              <div
                key={tier.id}
                className={`rounded-[var(--radius-sm)] border p-3 transition-colors ${
                  earned
                    ? "border-violet/30 bg-violet/5"
                    : "border-border bg-surface-2 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="leverage">{tier.leverage}</Badge>
                    <span className="text-sm font-semibold text-text">
                      {tier.name}
                    </span>
                  </div>
                  {earned ? (
                    <span className="flex items-center gap-1 text-xs text-up">
                      <Check size={12} />
                      Passed
                    </span>
                  ) : (
                    <Lock size={12} className="text-text-faint" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-faint">Account size</span>
                    <span className="tabular text-text-muted">
                      {tier.allocation}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-faint">Profit target</span>
                    <span className="tabular text-text-muted">
                      {tier.profitTarget}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-faint">Max drawdown</span>
                    <span className="tabular text-text-muted">
                      {tier.maxDD}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
