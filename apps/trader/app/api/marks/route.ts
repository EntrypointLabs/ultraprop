// Indexer-fronted live-marks surface: the browser hits THIS route, never the
// venue directly. All venue I/O happens server-side via the @shared/venues
// adapter. (The api-gateway Hono service from the plan is deferred; the trader
// app deploys standalone on Next.js.)
import { type AssetCtx, fetchAssetCtxs } from "@shared/venues";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Live feed — never cache; each request reflects the latest venue marks.
export const dynamic = "force-dynamic";

/**
 * GET /api/marks → live marks for the full universe, keyed by BARE symbol
 * ("BTC"). The FE maps these onto `hyperliquid:<symbol>` ids and builds its
 * `PriceTick[]`. No cache: this is the live mark feed.
 */
export async function GET() {
  try {
    const marks: Record<string, AssetCtx> = await fetchAssetCtxs();
    return NextResponse.json(marks);
  } catch (error) {
    console.error("[api/marks] marks fetch failed", error);
    return NextResponse.json({ error: "marks fetch failed" }, { status: 500 });
  }
}
