"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardLabel,
  Pill,
} from "@/components/ui";
import { DEMO_VAULT_ID } from "@/lib/mock/fixtures";
import { useVault } from "@/lib/mock/hooks";
import { toVaultState, useSimStore } from "@/lib/sim/store";
import { cn, formatPct, formatUsd } from "@/lib/utils";

interface ActiveEvalCardProps {
  /** The vault to resume — the signed-in user's per-user vault, or the demo vault. */
  vaultId?: string;
}

export function ActiveEvalCard({ vaultId }: ActiveEvalCardProps = {}) {
  const resolvedId = vaultId ?? DEMO_VAULT_ID;
  // The demo vault is seeded in the RQ cache, so read it via `useVault`. A signed-in
  // user's per-user vault lives in the persisted sim store and may not be mirrored
  // into RQ on a page where the cockpit isn't mounted (the home screen) — read it
  // straight from the store so "Resume" shows that vault's real equity/return.
  const demoVault = useVault(DEMO_VAULT_ID);
  const simVault = useSimStore((s) => s.vaults[resolvedId]);
  const vault =
    resolvedId === DEMO_VAULT_ID || !simVault
      ? demoVault
      : toVaultState(simVault);
  const tier = vault.tier;

  const returnUsd = vault.equity - vault.startingEquity;
  const returnPct = (returnUsd / vault.startingEquity) * 100;
  const isUp = returnUsd >= 0;

  const profitRule = vault.rules.find((r) => r.kind === "profitTarget");
  const ddRule = vault.rules.find((r) => r.kind === "drawdown");

  return (
    <Card className="relative overflow-hidden border-violet/40 bg-surface">
      {/* violet accent strip left edge */}
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-[var(--radius)] bg-violet" />

      <CardHeader className="pl-6">
        <div className="flex items-center gap-2">
          <Badge variant="tier">{tier.name}</Badge>
          <Badge variant="leverage">{tier.leverage}X</Badge>
          <span className="text-xs text-text-muted">Active evaluation</span>
        </div>
        <Link href={`/evaluation/${vaultId ?? DEMO_VAULT_ID}`}>
          <Button variant="primary" size="sm" className="gap-1.5 shrink-0">
            Resume
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="pl-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <CardLabel>Equity</CardLabel>
            <div className="tabular mt-1 text-lg font-semibold text-text">
              {formatUsd(vault.equity, { decimals: 2 })}
            </div>
          </div>

          <div>
            <CardLabel>Return</CardLabel>
            <div
              className={cn(
                "tabular mt-1 text-lg font-semibold",
                isUp ? "text-up" : "text-down",
              )}
            >
              {formatPct(returnPct, { sign: true })}
            </div>
          </div>

          <div>
            <CardLabel>Account size</CardLabel>
            <div className="tabular mt-1 text-lg font-semibold text-text">
              {formatUsd(tier.shadowAllocation, { decimals: 0 })}
            </div>
          </div>

          <div>
            <CardLabel>Trades used</CardLabel>
            <div className="tabular mt-1 text-lg font-semibold text-text">
              {vault.tradeCount}
              <span className="text-xs text-text-muted">
                {" "}
                / {tier.intentCap}
              </span>
            </div>
          </div>
        </div>

        {profitRule && ddRule && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Pill
              as="div"
              label="Profit target"
              value={`${formatUsd(profitRule.current, { sign: true, decimals: 0 })} / ${formatUsd(profitRule.limit, { decimals: 0 })}`}
              zone={profitRule.zone}
              progress={profitRule.used}
            />
            <Pill
              as="div"
              label="Max drawdown"
              value={`${formatUsd(ddRule.current, { decimals: 0 })} / ${formatUsd(ddRule.limit, { decimals: 0 })}`}
              zone={ddRule.zone}
              progress={ddRule.used}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
