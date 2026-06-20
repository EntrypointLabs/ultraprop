"use client";

import { CohortStatsStrip } from "@/components/cohort/CohortStatsStrip";
import { ActiveEvalCard } from "@/components/markets/ActiveEvalCard";
import { userVaultId } from "@/lib/auth";
import { DEMO_VAULT_ID } from "@/lib/mock/fixtures";
import { useSession } from "@/lib/mock/hooks";
import { useSimStore } from "@/lib/sim/store";
import { HeroCarousel } from "./HeroCarousel";
import { HeroRail } from "./HeroRail";
import { HomeMarketsTable } from "./HomeMarketsTable";
import { HomeSectionHeader } from "./HomeSectionHeader";

export function HomeScreen() {
  const { session } = useSession();
  const signedIn = session.status === "connected" && Boolean(session.address);
  // A returning signed-in user resumes via the Resume card, keyed to THEIR
  // per-user vault and read from the persisted sim store. The card is shown only
  // while a signed-in trader's own evaluation is still active — a signed-out
  // visitor never sees it (the demo vault is always "active").
  const userVault = useSimStore((s) =>
    session.address ? s.vaults[userVaultId(session.address)] : undefined,
  );
  const showActive = signedIn && userVault?.status === "active";
  const activeVaultId = signedIn
    ? userVaultId(session.address as string)
    : DEMO_VAULT_ID;

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 px-4 py-8 sm:px-6">
      {showActive && <ActiveEvalCard vaultId={activeVaultId} />}

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
