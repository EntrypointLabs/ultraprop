import { getLeaderboard, type LeaderboardRow } from "@shared/db";
import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type {
  LeaderboardAxis,
  LeaderboardEntry,
  LeaderboardWindow,
  SbtLevel,
} from "@/lib/mock/types";

export const runtime = "nodejs";

const TIER_LEVEL: Record<string, SbtLevel> = {
  Pro: 3,
  Basic: 2,
  Starter: 1,
};

/** The ledger stores the on-chain tier lowercased ("starter"); the UI uses the
 * capitalized name for both the badge color and the credential level. */
function canonicalTier(tier: string): string {
  return tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : tier;
}

function tierLevel(tier: string): SbtLevel {
  return TIER_LEVEL[canonicalTier(tier)] ?? 0;
}

/** Start (epoch ms) of the window the PnL is measured over; undefined = all-time. */
function windowSinceMs(window: LeaderboardWindow): number | undefined {
  const now = new Date();
  if (window === "daily") {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }
  if (window === "weekly") {
    const daysSinceMon = (now.getUTCDay() + 6) % 7;
    return Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMon,
    );
  }
  return undefined;
}

function rankByAxis(
  rows: LeaderboardRow[],
  axis: LeaderboardAxis,
): LeaderboardEntry[] {
  const score = (row: LeaderboardRow): number =>
    axis === "shadowPnl"
      ? row.shadowPnl
      : axis === "passes"
        ? row.passes
        : tierLevel(row.tier);

  return [...rows]
    .sort((a, b) => score(b) - score(a) || b.shadowPnl - a.shadowPnl)
    .map((row, i) => ({
      rank: i + 1,
      wallet: row.owner,
      displayName: null,
      tier: canonicalTier(row.tier),
      sbtLevel: tierLevel(row.tier),
      shadowPnl: row.shadowPnl,
      passes: row.passes,
    }));
}

/**
 * Real leaderboard standings from the ledger: traders ranked by the requested
 * axis (highest tier, simulated P&L, or passes) over the selected window.
 * Without a `DATABASE_URL` the ledger is absent, so this reports
 * `available: false` and the client renders an honest empty board, not a fixture.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const axis = (params.get("axis") ?? "tier") as LeaderboardAxis;
  const window = (params.get("window") ?? "all") as LeaderboardWindow;

  const db = getDb();
  if (!db) return NextResponse.json({ available: false, entries: [] });
  try {
    const rows = await getLeaderboard(db, { sinceMs: windowSinceMs(window) });
    return NextResponse.json({
      available: true,
      entries: rankByAxis(rows, axis),
    });
  } catch (error) {
    console.error("[leaderboard]", error);
    return NextResponse.json({ available: false, entries: [] });
  }
}
