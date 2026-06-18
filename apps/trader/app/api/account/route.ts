import { NextResponse } from "next/server";
import { authenticatePrivyRequest, PrivyAuthError } from "@/lib/privy-server";
import { TIER_NAMES, type TierName } from "@/lib/sui/config";
import { openTradingAccount } from "@/lib/sui/server";

export const runtime = "nodejs";

/**
 * Opens (or returns) the authenticated trader's on-chain trading account. The
 * firm signs and sponsors creation, transferring the account cap to the
 * trader's own Sui wallet. Authenticated and idempotent.
 */
export async function POST(req: Request) {
  let trader: Awaited<ReturnType<typeof authenticatePrivyRequest>>;
  try {
    trader = await authenticatePrivyRequest(req);
  } catch (error) {
    if (error instanceof PrivyAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Could not verify your session." },
      { status: 401 },
    );
  }

  let payload: { suiAddress?: string; tier?: string } = {};
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    // Treated as missing fields below.
  }
  const suiAddress = (payload.suiAddress ?? "").trim().toLowerCase();
  if (!suiAddress) {
    return NextResponse.json(
      { error: "Missing wallet address." },
      { status: 400 },
    );
  }

  if (trader.suiAddresses.length === 0) {
    return NextResponse.json(
      {
        error:
          "Your trading wallet is still being set up. Try again in a moment.",
        code: "wallet_not_ready",
      },
      { status: 409 },
    );
  }
  if (!trader.suiAddresses.includes(suiAddress)) {
    return NextResponse.json(
      { error: "That wallet is not linked to your account." },
      { status: 403 },
    );
  }

  const tier = TIER_NAMES.includes(payload.tier as TierName)
    ? (payload.tier as TierName)
    : undefined;

  try {
    const result = await openTradingAccount(suiAddress, tier);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "We couldn't open your account. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
