"use client";

import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { useLeaderboard } from "@/lib/mock/hooks";

export function HomeLeaderboard() {
  const entries = useLeaderboard({ axis: "shadowPnl", window: "all" });
  const top8 = entries.slice(0, 8);

  return (
    <div className="rounded-[var(--radius)] border border-border bg-surface overflow-hidden">
      <LeaderboardTable entries={top8} axis="shadowPnl" />
    </div>
  );
}
