"use client";

import { CohortStatsStrip } from "@/components/cohort/CohortStatsStrip";
import { ActiveEvalCard } from "@/components/markets/ActiveEvalCard";
import { userVaultId } from "@/lib/auth";
import { DEMO_VAULT_ID } from "@/lib/mock/fixtures";
import { useSession, useVault } from "@/lib/mock/hooks";
import { useSimStore } from "@/lib/sim/store";
import { HeroCarousel } from "./HeroCarousel";
import { HeroRail } from "./HeroRail";
import { HomeMarketsTable } from "./HomeMarketsTable";
import { HomeSectionHeader } from "./HomeSectionHeader";

export function HomeScreen() {
  const { session } = useSession();
  const demoVault = useVault(DEMO_VAULT_ID);
  // A returning signed-in user gets back to their cockpit via the Resume card,
  // keyed to THEIR per-user vault (not the demo vault). Read that vault's real
  // status from the persisted sim store. Signed-out visitors keep the demo
  // path: the card shows whenever the seeded demo vault is active.
  const userVault = useSimStore((s) =>
    session.address ? s.vaults[userVaultId(session.address)] : undefined,
  );
  const signedIn = session.status === "connected" && Boolean(session.address);
  const activeVaultId = signedIn
    ? userVaultId(session.address as string)
    : DEMO_VAULT_ID;
  const activeStatus = signedIn ? userVault?.status : demoVault.status;
  const showActive = activeStatus === "active";

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
