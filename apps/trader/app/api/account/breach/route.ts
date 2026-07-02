import { NextResponse } from "next/server";
import {
  isAccountId,
  readJson,
  requireTrader,
  serverError,
} from "@/app/api/_lib/auth";
import { registerBreach } from "@/lib/sui/server";

export const runtime = "nodejs";

/**
 * Suspends the authenticated trader's account on-chain for an off-chain risk
 * event the engine caught outside the realized per-trade gates (e.g. an
 * unrealized-equity drawdown breach).
 */
export async function POST(req: Request) {
  const auth = await requireTrader(req);
  if (auth.response) return auth.response;

  const { accountId } = await readJson<{ accountId: string }>(req);
  if (!isAccountId(accountId)) {
    return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
  }

  try {
    return NextResponse.json(await registerBreach(accountId));
  } catch (error) {
    return serverError(error, "We couldn't register the breach.");
  }
}
