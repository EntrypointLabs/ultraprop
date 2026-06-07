"use client";

import { CohortStatsStrip } from "@/components/cohort/CohortStatsStrip";
import { ActiveEvalCard } from "@/components/markets/ActiveEvalCard";
import { DEMO_VAULT_ID } from "@/lib/mock/fixtures";
import { useSession, useVault } from "@/lib/mock/hooks";
import { Hero } from "./Hero";
import { HowItWorksCard } from "./HowItWorksCard";
import { LeaderboardCard } from "./LeaderboardCard";
import { StartCard } from "./StartCard";

export function HomeScreen() {
  const { session } = useSession();
  const vault = useVault(DEMO_VAULT_ID);
  const showActive = session.status === "connected" && vault.status === "active";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <Hero />

      {showActive && (
        <section className="pb-6">
          <ActiveEvalCard />
        </section>
      )}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <StartCard />
        <LeaderboardCard />
        <HowItWorksCard />
      </section>

      <section className="py-16 sm:py-20">
        <CohortStatsStrip />
      </section>
    </div>
  );
}
