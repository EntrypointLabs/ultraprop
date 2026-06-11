"use client";

import { CohortStatsStrip } from "@/components/cohort/CohortStatsStrip";
import { ActiveEvalCard } from "@/components/markets/ActiveEvalCard";
import { DEMO_VAULT_ID } from "@/lib/mock/fixtures";
import { useSession, useVault } from "@/lib/mock/hooks";
import { HeroCarousel } from "./HeroCarousel";
import { HeroRail } from "./HeroRail";
import { HomeMarketsTable } from "./HomeMarketsTable";
import { HomeSectionHeader } from "./HomeSectionHeader";

export function HomeScreen() {
  const { session } = useSession();
  const vault = useVault(DEMO_VAULT_ID);
  const showActive = session.status === "connected" && vault.status === "active";

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 px-4 py-8 sm:px-6">
      {showActive && <ActiveEvalCard />}

      {/* Hero — spotlight carousel + rail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <HeroCarousel />
        <HeroRail />
      </div>

      {/* One content section: live markets */}
      <section className="space-y-3">
        <HomeSectionHeader
          title="Live markets"
          viewAllHref="/markets"
          viewAllLabel="All markets"
        />
        <HomeMarketsTable />
      </section>

      {/* Slim cohort strip */}
      <section className="pb-10 pt-2">
        <CohortStatsStrip />
      </section>
    </div>
  );
}
