"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { TierCard } from "@/components/tiers/TierCard";
import { WaitlistState } from "@/components/tiers/WaitlistState";
import { userVaultId } from "@/lib/auth";
import { DEMO_VAULT_ID } from "@/lib/mock/fixtures";
import {
  useDivergenceHalt,
  useSbt,
  useSession,
  useTiers,
} from "@/lib/mock/hooks";
import type { Tier } from "@/lib/mock/types";

interface TierGridProps {
  /** Optional deep-link market (?symbol=) carried into the cockpit pre-selection. */
  symbol?: string;
  /** Optional deep-link side (?side=) carried into the cockpit pre-fill. */
  side?: string;
}

export function TierGrid({ symbol, side }: TierGridProps = {}) {
  const router = useRouter();
  const tiers = useTiers();
  const { session, hydrated } = useSession();
  const { halted } = useDivergenceHalt();
  const sbt = useSbt(session.address ?? undefined);

  const [selectedId, setSelectedId] = React.useState<Tier["id"]>("starter");
  const [starting, setStarting] = React.useState<Tier["id"] | null>(null);

  const isSignedIn = Boolean(session.address);
  const isAllowlisted = session.allowlisted;

  // Derive which tiers are unlocked based on SBT passedTiers
  const passedTierNames = new Set(sbt.passedTiers.map((t) => t.toLowerCase()));
  const tiersWithUnlockState = tiers.map((tier) => {
    if (!tier.locked) return tier;
    const requiredPrev = tier.unlockedBy;
    const unlocked = requiredPrev ? passedTierNames.has(requiredPrev) : false;
    return { ...tier, locked: !unlocked };
  });

  function handleStart(tier: Tier) {
    if (tier.locked) return;
    setStarting(tier.id);
    // A signed-in trader opens a persistent per-user vault keyed off their wallet;
    // a guest routes to the shared demo vault. The chosen tier rides along as a
    // query param so the cockpit opens THIS tier (not always Starter) on creation.
    const vaultId = session.address
      ? userVaultId(session.address)
      : DEMO_VAULT_ID;
    // Forward the deep-link market/side intent (if any) so the cockpit opens on
    // THAT pair and pre-fills the side. The resolver in the eval route narrows
    // both — a bare/garbage value is simply ignored.
    const params = new URLSearchParams({ tier: tier.id });
    if (symbol) params.set("symbol", symbol);
    if (side) params.set("side", side);
    router.push(`/evaluation/${vaultId}?${params.toString()}`);
  }

  const ctaDisabled = halted;
  const disabledReason = halted
    ? "Market data feed interrupted — trading is paused to protect evaluations."
    : undefined;

  // Not signed in: show sign-in prompt inline
  if (!hydrated) {
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

  if (isSignedIn && !isAllowlisted) {
    return <WaitlistState />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {tiersWithUnlockState.map((tier) => (
        <TierCard
          key={tier.id}
          tier={tier}
          selected={selectedId === tier.id}
          onSelect={() => !tier.locked && setSelectedId(tier.id)}
          onStart={() => handleStart(tier)}
          disabled={ctaDisabled || starting !== null}
          disabledReason={disabledReason}
        />
      ))}
    </div>
  );
}
