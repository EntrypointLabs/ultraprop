"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { type TierCta, TierCard } from "@/components/tiers/TierCard";
import { userVaultId } from "@/lib/auth";
import { useDivergenceHalt, useTiers } from "@/lib/mock/hooks";
import type { Tier } from "@/lib/mock/types";
import type { TierName } from "@/lib/sui/config";
import { useAccountSetup, useAccountTier } from "@/lib/sui/useTradingAccount";

interface TierGridProps {
  /** Optional deep-link market (?symbol=) carried into the cockpit pre-selection. */
  symbol?: string;
  /** Optional deep-link side (?side=) carried into the cockpit pre-fill. */
  side?: string;
}

const TIER_LABEL: Record<TierName, string> = {
  starter: "Starter",
  basic: "Basic",
  pro: "Pro",
  elite: "Elite",
  whale: "Whale",
};

/** Tiers the user can open on /start without a prior account, and how. */
const SELF_SERVE: Record<Tier["id"], "free" | "paid" | "none"> = {
  starter: "free",
  basic: "paid",
  pro: "none",
};

export function TierGrid({ symbol, side }: TierGridProps = {}) {
  const router = useRouter();
  const tiers = useTiers();
  const { halted } = useDivergenceHalt();
  const { ready, authenticated, suiAddress, accountId, checking } =
    useAccountSetup();
  const ownedTier = useAccountTier(accountId);

  const [selectedId, setSelectedId] = React.useState<Tier["id"]>("starter");

  // The account picture isn't settled until Privy is ready, the account check
  // has finished, and — if an account exists — its tier has resolved.
  const tierLoading =
    Boolean(accountId) && (ownedTier.isLoading || ownedTier.isPending);
  const accountResolving = checking || tierLoading;
  const owned = ownedTier.data ?? null;

  function ctaFor(tier: Tier): TierCta {
    if (!ready || accountResolving) return { kind: "loading" };

    // Signed in with an on-chain account: only the owned tier continues; a
    // trader holds exactly one account, so every other tier is closed to them.
    if (accountId) {
      if (owned === tier.id) return { kind: "continue" };
      return {
        kind: "locked",
        reason: owned
          ? `You're evaluating ${TIER_LABEL[owned]}.`
          : "You already have an evaluation account.",
      };
    }

    // No account yet. Self-serve tiers open via onboarding; Pro isn't paid-
    // onboardable yet, so it stays locked with a clear reason.
    switch (SELF_SERVE[tier.id]) {
      case "free":
        return { kind: "start" };
      case "paid":
        return { kind: "payment" };
      default:
        return { kind: "locked", reason: "Coming soon — not yet available." };
    }
  }

  function handleCta(tier: Tier, cta: TierCta) {
    if (cta.kind === "loading" || cta.kind === "locked") return;

    // Not signed in: send them to authenticate first.
    if (!authenticated) {
      router.push("/login");
      return;
    }

    if (cta.kind === "continue") {
      // Resume the owned evaluation in the cockpit, carrying the owned tier and
      // any deep-link market/side intent forward.
      const vaultId = suiAddress ? userVaultId(suiAddress) : null;
      if (!vaultId) return;
      const params = new URLSearchParams({ tier: owned ?? tier.id });
      if (symbol) params.set("symbol", symbol);
      if (side) params.set("side", side);
      router.push(`/evaluation/${vaultId}?${params.toString()}`);
      return;
    }

    // start | payment: open onboarding preselected to this tier. Onboarding is
    // where the on-chain account is actually created (pay or invite).
    const params = new URLSearchParams();
    if (tier.id !== "starter") params.set("tier", tier.id);
    const qs = params.toString();
    router.push(`/onboarding${qs ? `?${qs}` : ""}`);
  }

  const ctaDisabled = halted;
  const disabledReason = halted
    ? "Market data feed interrupted — trading is paused to protect evaluations."
    : undefined;

  if (!ready) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 opacity-50 pointer-events-none">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[480px] rounded-[var(--radius-lg)] bg-surface animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {tiers.map((tier) => {
        const cta = ctaFor(tier);
        return (
          <TierCard
            key={tier.id}
            tier={tier}
            cta={cta}
            selected={selectedId === tier.id}
            onSelect={() => setSelectedId(tier.id)}
            onStart={() => handleCta(tier, cta)}
            disabled={ctaDisabled}
            disabledReason={disabledReason}
          />
        );
      })}
    </div>
  );
}
