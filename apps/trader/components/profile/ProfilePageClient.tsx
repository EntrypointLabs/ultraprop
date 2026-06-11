"use client";

import { EvaluationHistory } from "@/components/profile/EvaluationHistory";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { SbtCard } from "@/components/profile/SbtCard";
import { StatGrid } from "@/components/profile/StatGrid";
import { TierBadges } from "@/components/profile/TierBadges";
import { useProfile, useSbt } from "@/lib/mock/hooks";

/** Total trades across all evaluations — rough proxy using eval count * a per-eval fixture. */
const TRADES_PER_EVAL = 12;

interface ProfilePageClientProps {
  wallet: string;
}

export function ProfilePageClient({ wallet }: ProfilePageClientProps) {
  const profile = useProfile(wallet);
  const sbt = useSbt(wallet);

  const totalTrades = profile.evaluations.length * TRADES_PER_EVAL;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 space-y-6">
      {/* Header */}
      <ProfileHeader profile={profile} wallet={wallet} />

      {/* SBT Card */}
      <SbtCard
        sbt={sbt}
        shadowPnl={profile.shadowPnl}
        passes={profile.passes}
        fails={profile.fails}
        totalTrades={totalTrades}
      />

      {/* All-time stat tiles */}
      <StatGrid profile={profile} />

      {/* Tier badges */}
      <TierBadges sbt={sbt} />

      {/* Evaluation history */}
      <EvaluationHistory evaluations={profile.evaluations} />
    </div>
  );
}
