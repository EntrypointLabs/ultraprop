import { NextResponse } from "next/server";
import { readJson, requireTrader, serverError } from "@/app/api/_lib/auth";
import { sponsorUserTransaction } from "@/lib/sui/sponsor-server";

export const runtime = "nodejs";

interface SponsorBody {
  suiAddress: string;
  transactionKindBytes: string;
}

/**
 * Sponsors gas for a trader's onboarding transaction (faucet mint, eval-fee
 * payment). A freshly-provisioned embedded wallet holds no SUI, so the firm's
 * admin wallet pays gas while the trader stays the transaction's sender. The
 * caller must own the wallet (proven by their Privy token); the server-side
 * allowlist restricts what calls the firm will cover.
 */
export async function POST(req: Request) {
  const auth = await requireTrader(req);
  if (auth.response) return auth.response;

  const body = await readJson<SponsorBody>(req);
  const suiAddress = (body.suiAddress ?? "").trim().toLowerCase();
  const transactionKindBytes = (body.transactionKindBytes ?? "").trim();
  if (!suiAddress || !transactionKindBytes) {
    return NextResponse.json(
      { error: "Missing transaction to sponsor." },
      { status: 400 },
    );
  }
  if (!auth.trader.suiAddresses.includes(suiAddress)) {
    return NextResponse.json(
      { error: "That wallet is not linked to your account." },
      { status: 403 },
    );
  }

  try {
    const sponsored = await sponsorUserTransaction({
      sender: suiAddress,
      transactionKindBytes,
    });
    return NextResponse.json(sponsored);
  } catch (error) {
    return serverError(error, "We couldn't cover gas for that transaction.");
  }
}
