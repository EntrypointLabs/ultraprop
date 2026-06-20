import { getCohortStats } from "@shared/db";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Real cohort figures from the ledger (account counts by status + median passer
 * return). Without a `DATABASE_URL` the ledger is absent, so this reports
 * `available: false` and the client renders honest zeros rather than a fixture.
 */
export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ available: false });
  try {
    const s = await getCohortStats(db);
    const resolved = s.totalPasses + s.totalFails;
    return NextResponse.json({
      available: true,
      members: s.members,
      activeEvaluations: s.activeEvaluations,
      totalPasses: s.totalPasses,
      passRate: resolved > 0 ? s.totalPasses / resolved : 0,
      medianPasserReturnPct: s.medianPasserReturnPct,
    });
  } catch (error) {
    console.error("[cohort/stats]", error);
    return NextResponse.json({ available: false });
  }
}
