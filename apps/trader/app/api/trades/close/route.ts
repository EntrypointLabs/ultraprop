import { NextResponse } from "next/server";
import {
  isAccountId,
  readJson,
  requireTrader,
  serverError,
} from "@/app/api/_lib/auth";
import { logTrade } from "@/lib/sui/server";

export const runtime = "nodejs";

interface CloseBody {
  accountId: string;
  isWin: boolean;
  pnl: number | string;
  venue: string;
  market: string;
}

/**
 * Records a closed trade's realized PnL on-chain via the firm's executor cap.
 * `pnl` is the absolute realized PnL in USDC base units (6 dp), a non-negative
 * integer; the sign is carried by `isWin`. Authenticated.
 */
export async function POST(req: Request) {
  const auth = await requireTrader(req);
  if (auth.response) return auth.response;

  const body = await readJson<CloseBody>(req);
  if (!isAccountId(body.accountId)) {
    return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
  }
  if (typeof body.isWin !== "boolean") {
    return NextResponse.json(
      { error: "Missing or invalid `isWin`." },
      { status: 400 },
    );
  }

  let pnl: bigint;
  try {
    pnl = BigInt(body.pnl as number | string);
  } catch {
    return NextResponse.json(
      { error: "`pnl` must be an integer in USDC base units (6 dp)." },
      { status: 400 },
    );
  }
  if (pnl < 0n) {
    return NextResponse.json(
      { error: "`pnl` must be non-negative; the sign is carried by `isWin`." },
      { status: 400 },
    );
  }

  const venue = (body.venue ?? "").trim();
  const market = (body.market ?? "").trim();
  if (!venue || !market) {
    return NextResponse.json(
      { error: "Missing `venue` or `market`." },
      { status: 400 },
    );
  }

  try {
    const result = await logTrade({
      accountId: body.accountId,
      isWin: body.isWin,
      pnl,
      venue,
      market,
    });
    return NextResponse.json(result);
  } catch (error) {
    return serverError(error, "We couldn't record the trade on-chain.");
  }
}
