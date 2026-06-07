"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { TierCard } from "@/components/tiers/TierCard";
import { WaitlistState } from "@/components/tiers/WaitlistState";
import { DEMO_VAULT_ID } from "@/lib/mock/fixtures";
import {
  useDivergenceHalt,
  useSbt,
  useSession,
  useTiers,
} from "@/lib/mock/hooks";
import type { Tier } from "@/lib/mock/types";

export function TierGrid() {
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
    // Mock: navigate to the demo vault as if a vault was opened
    router.push(`/evaluation/${DEMO_VAULT_ID}`);
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
