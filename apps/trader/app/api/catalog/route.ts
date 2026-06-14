// Indexer-fronted catalog surface: the browser hits THIS route, never the venue
// directly. All venue I/O happens server-side via the @shared/venues adapter.
// (The api-gateway Hono service from the plan is deferred to the broader backend
// buildout; the trader app deploys standalone on Next.js.)
import { type Market, HyperliquidAdapter } from "@shared/venues";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** The universe changes slowly — a short server-side cache absorbs FE polling. */
const CACHE_TTL_MS = 60_000;

let cache: { data: Market[]; ts: number } | null = null;

/**
 * GET /api/catalog → the full live Hyperliquid crypto-perp catalog (delisted
 * excluded), served from a 60s in-memory cache. Returns the `@shared/venues`
 * `Market[]` DTO as JSON.
 */
export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }
  try {
    const data = await new HyperliquidAdapter().listMarkets();
    cache = { data, ts: now };
    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/catalog] catalog fetch failed", error);
    return NextResponse.json(
      { error: "catalog fetch failed" },
      { status: 500 },
    );
  }
}
