"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { Avatar, Badge } from "@/components/ui";
import { accountHandle } from "@/lib/identity";
import type { LeaderboardAxis, LeaderboardEntry } from "@/lib/mock/types";
import { cn, formatUsd } from "@/lib/utils";

type Medal = (typeof MEDAL_COLORS)[number];

interface PodiumStripProps {
  top3: LeaderboardEntry[];
  axis: LeaderboardAxis;
}

const MEDAL_COLORS = [
  {
    bg: "bg-warn/15",
    border: "border-warn/40",
    text: "text-warn",
    glyph: "1ST",
  },
  {
    bg: "bg-surface-2",
    border: "border-border",
    text: "text-text-muted",
    glyph: "2ND",
  },
  {
    bg: "bg-down/10",
    border: "border-down/30",
    text: "text-down",
    glyph: "3RD",
  },
];

function axisPrimaryValue(
  entry: LeaderboardEntry,
  axis: LeaderboardAxis,
): string {
  switch (axis) {
    case "shadowPnl":
      return formatUsd(entry.shadowPnl, { sign: true });
    case "passes":
      return `${entry.passes} passes`;
    case "tier":
      return entry.tier;
  }
}

function axisSecondaryLabel(axis: LeaderboardAxis): string {
  switch (axis) {
    case "shadowPnl":
      return "Simulated P&L";
    case "passes":
      return "Passes";
    case "tier":
      return "Tier";
  }
}

export function PodiumStrip({ top3, axis }: PodiumStripProps) {
  if (top3.length === 0) return null;

  const [first, second, third] = top3;
  // Always lay out three podium positions (2nd · 1st · 3rd) so the grid never
  // collapses while the cohort is small; positions with no trader yet render as
  // muted "open" slots rather than leaving holes in the layout.
  const podium: { entry: LeaderboardEntry | undefined; rank: number }[] = [
    { entry: second, rank: 2 },
    { entry: first, rank: 1 },
    { entry: third, rank: 3 },
  ];

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Top Traders
        </span>
        <span className="h-px flex-1 bg-border-soft" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {podium.map(({ entry, rank }) => {
          const medal = MEDAL_COLORS[rank - 1]!;
          if (!entry) {
            return (
              <PodiumSlot
                key={`open-${rank}`}
                medal={medal}
                axisLabel={axisSecondaryLabel(axis)}
              />
            );
          }
          const isFirst = rank === 1;
          return (
            <Link
              key={entry.wallet}
              href={`/profile/${entry.wallet}`}
              className={cn(
                "lift group relative flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border p-4 hover:bg-surface-2",
                medal.bg,
                medal.border,
                isFirst && "ring-1 ring-warn/30",
              )}
            >
              <span
                className={cn(
                  "absolute right-3 top-3 font-mono text-xs font-bold tracking-wider",
                  medal.text,
                )}
              >
                {medal.glyph}
              </span>

              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2",
                  medal.border,
                )}
              >
                <Avatar address={entry.wallet} size={40} />
              </div>

              <div className="flex flex-col items-center gap-1 text-center">
                <span className="max-w-[120px] truncate text-sm font-medium text-text">
                  {entry.displayName ?? accountHandle(entry.wallet)}
                </span>
                <Badge variant="tier" className="uppercase">
                  {entry.tier}
                </Badge>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-xs uppercase tracking-wide text-text-faint">
                  {axisSecondaryLabel(axis)}
                </span>
                <span
                  className={cn(
                    "tabular text-base font-semibold",
                    axis === "shadowPnl" && entry.shadowPnl >= 0 && "text-up",
                    axis === "shadowPnl" && entry.shadowPnl < 0 && "text-down",
                    axis !== "shadowPnl" && "text-text",
                  )}
                >
                  {axisPrimaryValue(entry, axis)}
                </span>
              </div>

              {isFirst && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 select-none text-lg">
                  🏆
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** An unfilled podium position — keeps the 3-up layout intact before the cohort
 * has three ranked traders, without inventing a trader. */
function PodiumSlot({ medal, axisLabel }: { medal: Medal; axisLabel: string }) {
  return (
    <div className="relative flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-border bg-surface-2/40 p-4">
      <span className="absolute right-3 top-3 font-mono text-xs font-bold tracking-wider text-text-faint">
        {medal.glyph}
      </span>

      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-border">
        <UserRound className="h-5 w-5 text-text-faint" aria-hidden="true" />
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-medium text-text-faint">Open spot</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-faint">
          Be the next
        </span>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-xs uppercase tracking-wide text-text-faint">
          {axisLabel}
        </span>
        <span className="tabular text-base font-semibold text-text-faint">
          —
        </span>
      </div>
    </div>
  );
}
