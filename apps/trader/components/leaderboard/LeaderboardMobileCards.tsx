"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui";
import type { LeaderboardAxis, LeaderboardEntry } from "@/lib/mock/types";
import { cn, formatUsd, shortAddress } from "@/lib/utils";

interface LeaderboardMobileCardsProps {
  entries: LeaderboardEntry[];
  axis: LeaderboardAxis;
}

const MEDAL_GLYPHS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

function TierDot({ tier }: { tier: string }) {
  const colorMap: Record<string, string> = {
    Pro: "bg-brand",
    Basic: "bg-violet",
    Starter: "bg-text-muted",
  };
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        colorMap[tier] ?? "bg-text-muted",
      )}
    />
  );
}

export function LeaderboardMobileCards({
  entries,
  axis,
}: LeaderboardMobileCardsProps) {
  return (
    <div className="flex flex-col divide-y divide-border-soft">
      {entries.map((entry) => {
        const glyph = MEDAL_GLYPHS[entry.rank];
        const pnlPositive = entry.shadowPnl >= 0;
        const axisValueEl =
          axis === "shadowPnl" ? (
            <span
              className={cn(
                "tabular text-xs font-semibold",
                pnlPositive ? "text-up" : "text-down",
              )}
            >
              {formatUsd(entry.shadowPnl, { sign: true })}
            </span>
          ) : axis === "passes" ? (
            <span className="tabular text-xs font-semibold text-text">
              {entry.passes}p
            </span>
          ) : axis === "consistency" ? (
            <span className="tabular text-xs font-semibold text-text">
              {entry.consistency.toFixed(1)}%
            </span>
          ) : (
            <span className="tabular text-xs font-semibold text-violet">
              {entry.tier}
            </span>
          );

        return (
          <Link
            key={entry.wallet}
            href={`/profile/${entry.wallet}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <div className="w-8 shrink-0 text-center">
              {glyph ? (
                <span className="text-base">{glyph}</span>
              ) : (
                <span className="tabular text-xs font-bold text-text-faint">
                  #{entry.rank}
                </span>
              )}
            </div>

            <Avatar address={entry.wallet} size={32} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <TierDot tier={entry.tier} />
                <span className="truncate text-sm font-medium text-text">
                  {entry.displayName ?? shortAddress(entry.wallet, 4, 4)}
                </span>
                <span className="shrink-0 rounded-sm bg-violet/15 px-1 py-0.5 text-xs font-semibold uppercase text-on-accent">
                  {entry.tier}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-3">
                {axisValueEl}
                <span className="text-xs text-text-faint">
                  {entry.passes}p · {entry.consistency.toFixed(0)}%
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
