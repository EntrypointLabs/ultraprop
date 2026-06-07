import { StatTile } from "@/components/ui";
import type { Profile } from "@/lib/mock/types";
import { formatPct, formatUsd } from "@/lib/utils";

interface StatGridProps {
  profile: Profile;
}

export function StatGrid({ profile }: StatGridProps) {
  const winRate =
    profile.passes + profile.fails > 0
      ? (profile.passes / (profile.passes + profile.fails)) * 100
      : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Simulated P&L"
        value={
          <span className={profile.shadowPnl >= 0 ? "text-up" : "text-down"}>
            {formatUsd(profile.shadowPnl, { sign: true })}
          </span>
        }
        delta="All-time realized"
        deltaTone="muted"
      />
      <StatTile
        label="Evaluations Passed"
        value={<span className="text-up">{profile.passes}</span>}
        delta={`${profile.fails} failed`}
        deltaTone={profile.fails > 0 ? "down" : "muted"}
      />
      <StatTile
        label="Pass Rate"
        value={
          <span className={winRate >= 50 ? "text-up" : "text-warn"}>
            {formatPct(winRate, { sign: false })}
          </span>
        }
        delta={`${profile.passes + profile.fails} total evals`}
        deltaTone="muted"
      />
      <StatTile
        label="Consistency"
        value={
          <span className={profile.consistency >= 70 ? "text-up" : "text-warn"}>
            {profile.consistency.toFixed(1)}
          </span>
        }
        delta="Score / 100"
        deltaTone="muted"
      />
    </div>
  );
}
