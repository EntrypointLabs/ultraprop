"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Avatar,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
} from "@/components/ui";
import type { LeaderboardAxis, LeaderboardEntry } from "@/lib/mock/types";
import { cn, formatUsd, shortAddress } from "@/lib/utils";

type SortCol = "rank" | "shadowPnl" | "passes" | "consistency";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  axis: LeaderboardAxis;
}

const MEDAL_GLYPHS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

function RankCell({ rank }: { rank: number }) {
  const glyph = MEDAL_GLYPHS[rank];
  if (glyph) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-sm">{glyph}</span>
        <span className="tabular text-xs font-semibold text-text-muted">
          #{rank}
        </span>
      </span>
    );
  }
  return (
    <span className="tabular text-sm font-medium text-text-muted">#{rank}</span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colorMap: Record<string, string> = {
    Pro: "text-brand bg-brand/15",
    Basic: "text-violet bg-violet/15",
    Starter: "text-text-muted bg-surface-3",
  };
  const cls = colorMap[tier] ?? colorMap.Starter;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        cls,
      )}
    >
      {tier}
    </span>
  );
}

export function LeaderboardTable({ entries, axis }: LeaderboardTableProps) {
  const [sortCol, setSortCol] = useState<SortCol>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const activeCol: SortCol =
    axis === "shadowPnl"
      ? "shadowPnl"
      : axis === "passes"
        ? "passes"
        : axis === "consistency"
          ? "consistency"
          : "rank";

  function handleSort(col: SortCol) {
    if (col === sortCol) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "rank" ? "asc" : "desc");
    }
  }

  const sorted = [...entries].sort((a, b) => {
    let diff = 0;
    switch (sortCol) {
      case "rank":
        diff = a.rank - b.rank;
        break;
      case "shadowPnl":
        diff = b.shadowPnl - a.shadowPnl;
        break;
      case "passes":
        diff = b.passes - a.passes;
        break;
      case "consistency":
        diff = b.consistency - a.consistency;
        break;
    }
    return sortDir === "asc" ? diff : -diff;
  });

  function thDir(col: SortCol): "asc" | "desc" | null {
    return sortCol === col ? sortDir : null;
  }

  const axisHighlight = (col: SortCol) =>
    col === activeCol ? "text-brand" : undefined;

  return (
    <Table>
      <Thead>
        <tr>
          <Th
            sortable
            sortDir={thDir("rank")}
            onSort={() => handleSort("rank")}
            className={axisHighlight("rank")}
          >
            Rank
          </Th>
          <Th>Trader</Th>
          <Th>Tier</Th>
          <Th
            numeric
            sortable
            sortDir={thDir("shadowPnl")}
            onSort={() => handleSort("shadowPnl")}
            className={axisHighlight("shadowPnl")}
          >
            Simulated P&L
          </Th>
          <Th
            numeric
            sortable
            sortDir={thDir("passes")}
            onSort={() => handleSort("passes")}
            className={axisHighlight("passes")}
          >
            Passes
          </Th>
          <Th numeric>Trades</Th>
          <Th
            numeric
            sortable
            sortDir={thDir("consistency")}
            onSort={() => handleSort("consistency")}
            className={axisHighlight("consistency")}
          >
            Consistency
          </Th>
        </tr>
      </Thead>
      <Tbody>
        {sorted.map((entry) => {
          const pnlPositive = entry.shadowPnl >= 0;
          return (
            <Tr key={entry.wallet}>
              <Td className="w-16">
                <RankCell rank={entry.rank} />
              </Td>
              <Td>
                <Link
                  href={`/profile/${entry.wallet}`}
                  className="group inline-flex items-center gap-2 transition-colors hover:text-brand"
                >
                  <Avatar address={entry.wallet} size={24} />
                  <div className="flex flex-col gap-0">
                    {entry.displayName && (
                      <span className="text-sm font-medium text-text group-hover:text-brand">
                        {entry.displayName}
                      </span>
                    )}
                    <Tooltip content={entry.wallet} side="top">
                      <span
                        className={cn(
                          "tabular text-xs text-text-muted",
                          entry.displayName && "text-text-faint",
                        )}
                      >
                        {shortAddress(entry.wallet, 6, 4)}
                      </span>
                    </Tooltip>
                  </div>
                </Link>
              </Td>
              <Td>
                <TierBadge tier={entry.tier} />
              </Td>
              <Td numeric>
                <span
                  className={cn(
                    "tabular text-sm font-semibold",
                    pnlPositive ? "text-up" : "text-down",
                  )}
                >
                  {formatUsd(entry.shadowPnl, { sign: true })}
                </span>
              </Td>
              <Td numeric>
                <span className="tabular text-sm">{entry.passes}</span>
              </Td>
              <Td numeric>
                <span className="tabular text-sm text-text-muted">
                  {entry.passes * 12 + Math.floor(entry.consistency / 5)}
                </span>
              </Td>
              <Td numeric>
                <ConsistencyBar value={entry.consistency} />
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}

function ConsistencyBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 70 ? "bg-up" : pct >= 40 ? "bg-warn" : "bg-down";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn("inline-block h-1.5 rounded-full", color)}
        style={{ width: `${Math.round(pct * 0.6)}px` }}
      />
      <span className="tabular text-sm">{value.toFixed(1)}</span>
    </span>
  );
}
