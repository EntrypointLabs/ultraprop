// Indexer-fronted candle surface: the browser hits THIS route, never the venue
// directly. All venue I/O happens server-side via the @shared/venues adapter.
// (The api-gateway Hono service from the plan is deferred; the trader app
// deploys standalone on Next.js.)
import { type Candle, fetchCandles } from "@shared/venues";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_INTERVAL = "1h";
const DEFAULT_HISTORY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * GET /api/candles?coin=BTC&interval=1h&start=<ms>&end=<ms> → OHLCV history for
 * one market. `coin` is the BARE ticker; a "hyperliquid:" id prefix is stripped
 * server-side so callers may pass either form.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawCoin = searchParams.get("coin");
  if (!rawCoin) {
    return NextResponse.json({ error: "missing coin" }, { status: 400 });
  }
  const coin = rawCoin.includes(":") ? rawCoin.split(":")[1] : rawCoin;
  const interval = searchParams.get("interval") ?? DEFAULT_INTERVAL;
  const now = Date.now();
  const end = Number(searchParams.get("end")) || now;
  const start =
    Number(searchParams.get("start")) || now - DEFAULT_HISTORY_MS;

  try {
    const candles: Candle[] = await fetchCandles(coin, interval, start, end);
    return NextResponse.json(candles);
  } catch (error) {
    console.error("[api/candles] candle fetch failed", error);
    return NextResponse.json({ error: "candle fetch failed" }, { status: 500 });
  }
}
