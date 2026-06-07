import { CohortActivity } from "@/components/points/CohortActivity";
import { DailyScores } from "@/components/points/DailyScores";
import { GenesisHero } from "@/components/points/GenesisHero";
import { HowToLevelUp } from "@/components/points/HowToLevelUp";
import { TierLadder } from "@/components/points/TierLadder";
import { WeeklyHistory } from "@/components/points/WeeklyHistory";

export default function PointsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-10 sm:px-6">
      {/* Hero */}
      <GenesisHero />

      {/* Tier ladder */}
      <TierLadder />

      {/* How to level up + CTAs */}
      <HowToLevelUp />

      {/* Cohort-wide live stats */}
      <CohortActivity />

      {/* Two-column data panels */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <DailyScores />
        <WeeklyHistory />
      </div>
    </div>
  );
}
