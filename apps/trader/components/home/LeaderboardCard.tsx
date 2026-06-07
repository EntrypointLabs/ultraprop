"use client";

import Link from "next/link";
import { Avatar, Card } from "@/components/ui";
import { useLeaderboard } from "@/lib/mock/hooks";
import { formatUsd, shortAddress } from "@/lib/utils";

export function LeaderboardCard() {
  const rows = useLeaderboard({ axis: "shadowPnl", window: "all" }).slice(0, 5);

  return (
    <Card className="flex flex-col p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">Leaderboard</h2>
        <Link
          href="/leaderboard"
          className="text-xs text-text-muted transition-colors hover:text-text"
        >
          View all →
        </Link>
      </div>

      <ul className="mt-4 flex flex-col">
        {rows.map((r) => (
          <li key={r.wallet}>
            <Link
              href={`/profile/${r.wallet}`}
              className="-mx-2 flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2 transition-colors hover:bg-surface-2"
            >
              <span className="tabular w-4 shrink-0 text-xs text-text-faint">
                {r.rank}
              </span>
              <Avatar address={r.wallet} size={22} />
              <span className="min-w-0 flex-1 truncate text-sm text-text">
                {r.displayName ?? shortAddress(r.wallet)}
              </span>
              <span className="tabular text-sm font-medium text-up">
                {formatUsd(r.shadowPnl, { sign: true, decimals: 0 })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
