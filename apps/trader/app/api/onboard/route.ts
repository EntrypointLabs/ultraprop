import { NextResponse } from "next/server";
import { readJson, requireTrader, serverError } from "@/app/api/_lib/auth";
import { getSuiClient } from "@/lib/sui/client";
import { type TierName } from "@/lib/sui/config";
import {
  onboardWithInvite,
  onboardWithPayment,
  ONBOARDABLE_TIERS,
} from "@/lib/sui/onboard-server";
import { getTradingAccountId } from "@/lib/sui/propfirm";

export const runtime = "nodejs";

interface OnboardBody {
  suiAddress: string;
  tier: string;
  paymentDigest: string;
  inviteCode: string;
}

/**
 * Opens a trader's on-chain account through the fee-first or invite flow. The
 * caller must already own the wallet (proven by their Privy token) and must NOT
 * already have an account — the one-account-per-user check is the primary
 * anti-abuse guard for both paths. PAID verifies the user's on-chain fee payment;
 * INVITE validates a code against the configured allowlist (Starter only). The
 * firm then admin-signs `open_account` and transfers the cap to the trader.
 */
export async function POST(req: Request) {
  const auth = await requireTrader(req);
  if (auth.response) return auth.response;

  const body = await readJson<OnboardBody>(req);
  const suiAddress = (body.suiAddress ?? "").trim().toLowerCase();
  if (!suiAddress) {
    return NextResponse.json(
      { error: "Missing wallet address." },
      { status: 400 },
    );
  }

  if (auth.trader.suiAddresses.length === 0) {
    return NextResponse.json(
      {
        error:
          "Your trading wallet is still being set up. Try again in a moment.",
        code: "wallet_not_ready",
      },
      { status: 409 },
    );
  }
  if (!auth.trader.suiAddresses.includes(suiAddress)) {
    return NextResponse.json(
      { error: "That wallet is not linked to your account." },
      { status: 403 },
    );
  }

  // One account per user: the central guard. A user who already holds an account
  // can neither pay for nor redeem a second one, which is also what makes a
  // replayed payment digest or reused invite code a no-op.
  try {
    const existing = await getTradingAccountId(getSuiClient(), suiAddress);
    if (existing) {
      return NextResponse.json({ accountId: existing, created: false });
    }
  } catch {
    // Fall through; the open path re-checks and is idempotent.
  }

  const inviteCode = (body.inviteCode ?? "").trim();
  const paymentDigest = (body.paymentDigest ?? "").trim();

  try {
    if (inviteCode) {
      const result = await onboardWithInvite({ suiAddress, inviteCode });
      return NextResponse.json(result);
    }

    const tier = body.tier as TierName;
    if (!ONBOARDABLE_TIERS.includes(tier)) {
      return NextResponse.json(
        { error: "Choose a Starter or Basic tier to continue." },
        { status: 400 },
      );
    }
    if (!paymentDigest) {
      return NextResponse.json(
        { error: "Missing payment. Pay your evaluation fee first." },
        { status: 400 },
      );
    }
    const result = await onboardWithPayment({
      suiAddress,
      tier,
      paymentDigest,
    });
    return NextResponse.json(result);
  } catch (error) {
    return serverError(error, "We couldn't open your account. Please try again.");
  }
}
