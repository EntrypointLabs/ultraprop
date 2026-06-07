"use client";

import { CohortStatsStrip } from "@/components/cohort/CohortStatsStrip";
import { ActiveEvalCard } from "@/components/markets/ActiveEvalCard";
import { DEMO_VAULT_ID } from "@/lib/mock/fixtures";
import { useSession, useVault } from "@/lib/mock/hooks";
import { HeroCarousel } from "./HeroCarousel";
import { HeroRail } from "./HeroRail";
import { HomeLeaderboard } from "./HomeLeaderboard";
import { HomeMarketsTable } from "./HomeMarketsTable";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { InfoCardsRow } from "./InfoCardsRow";

export function HomeScreen() {
  const { session } = useSession();
  const vault = useVault(DEMO_VAULT_ID);

  const isSignedIn = session.status === "connected";
  const hasActiveEval = vault.status === "active";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-8">
      {/* Active evaluation banner — only when signed in and eval is running */}
      {isSignedIn && hasActiveEval && (
        <div>
          <ActiveEvalCard />
        </div>
      )}

      {/* HERO: carousel + right rail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <HeroCarousel />
        <HeroRail />
      </div>

      {/* Info cards trio */}
      <InfoCardsRow />

      {/* Leaderboard section */}
      <section className="space-y-3">
        <HomeSectionHeader
          title="Leaderboard"
          viewAllHref="/leaderboard"
          viewAllLabel="Full leaderboard"
        />
        <HomeLeaderboard />
      </section>

      {/* Live markets section */}
      <section className="space-y-3">
        <HomeSectionHeader
          title="Live markets"
          viewAllHref="/start"
          viewAllLabel="Start trading"
        />
        <HomeMarketsTable />
      </section>

      {/* Cohort health section */}
      <section className="space-y-3">
        <HomeSectionHeader
          title="Cohort health"
          viewAllHref="/cohort"
          viewAllLabel="About the cohort"
        />
        <CohortStatsStrip />
      </section>
    </div>
  );
}
