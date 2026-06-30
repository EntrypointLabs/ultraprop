import { getUsername, setUsername } from "@shared/db";
import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { authenticatePrivyRequest, PrivyAuthError } from "@/lib/privy-server";
import { isUsernameClaimingEnabled } from "@/lib/sui/config";
import {
  mintUsernameSubname,
  normalizeLabel,
  SuiNsError,
} from "@/lib/sui/suins";

export const runtime = "nodejs";

/** Public read: the username (minted subname + backing NFT) an owner has set, or
 * null. Drives the profile header for any wallet, not just the signed-in one. */
export async function GET(req: NextRequest) {
  const owner = (req.nextUrl.searchParams.get("owner") ?? "").trim();
  if (!owner) {
    return NextResponse.json({ error: "Missing owner." }, { status: 400 });
  }
  const db = getDb();
  if (!db) return NextResponse.json({ username: null });
  try {
    return NextResponse.json({ username: await getUsername(db, owner) });
  } catch (error) {
    console.error("[username] read", error);
    return NextResponse.json({ username: null });
  }
}

/**
 * Claim a username: mint `label.<parent>` as a SuiNS subname NFT to the
 * authenticated trader's wallet and record it as their profile name. The firm
 * signs and pays for the mint, so the caller only proves they own the wallet.
 */
export async function POST(req: Request) {
  if (!isUsernameClaimingEnabled()) {
    return NextResponse.json(
      { error: "Username claiming isn't available yet." },
      { status: 503 },
    );
  }

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

  let payload: { suiAddress?: string; label?: string } = {};
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
  if (!trader.suiAddresses.includes(suiAddress)) {
    return NextResponse.json(
      { error: "That wallet is not linked to your account." },
      { status: 403 },
    );
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "Usernames aren't available right now." },
      { status: 503 },
    );
  }

  let label: string;
  try {
    label = normalizeLabel(payload.label ?? "");
  } catch (error) {
    const message =
      error instanceof SuiNsError ? error.message : "Invalid username.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let minted: Awaited<ReturnType<typeof mintUsernameSubname>>;
  try {
    minted = await mintUsernameSubname(suiAddress, label);
  } catch (error) {
    if (error instanceof SuiNsError) {
      // "taken" is the one expected, retryable conflict; everything else is a
      // failed mint the user can retry.
      const status = /taken/i.test(error.message) ? 409 : 422;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[username] mint", error);
    return NextResponse.json(
      { error: "We couldn't mint your username. Please try again." },
      { status: 502 },
    );
  }

  const updated = await setUsername(db, suiAddress, {
    displayName: minted.name,
    subnameNftId: minted.nftId,
  });
  if (updated === 0) {
    // The subname is already minted on-chain; surface that the account is missing
    // rather than silently dropping a successful mint.
    return NextResponse.json(
      {
        error: "Open your trading account first.",
        username: { displayName: minted.name, subnameNftId: minted.nftId },
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    username: { displayName: minted.name, subnameNftId: minted.nftId },
    digest: minted.digest,
  });
}
