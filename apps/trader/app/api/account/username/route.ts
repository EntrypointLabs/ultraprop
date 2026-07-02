import { claimRateLimit, getUsername, setUsername } from "@shared/db";
import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { authenticatePrivyRequest, PrivyAuthError } from "@/lib/privy-server";
import { isUsernameClaimingEnabled } from "@/lib/sui/config";
import {
  isUsernameAvailable,
  mintUsernameSubname,
  normalizeLabel,
  SuiNsError,
} from "@/lib/sui/suins";

export const runtime = "nodejs";

/** One mint attempt per trader per window. Each attempt is a firm-paid on-chain
 * transaction, so this blunts scripted abuse without hindering a real user who
 * claims once. */
const CLAIM_WINDOW_MS = 15_000;

/** HTTP status for a `SuiNsError`, keyed off its kind so a *successful-but-
 * unconfirmed* mint (`pending`) is never mistaken for a real conflict (`taken`)
 * that would push the user toward claiming a different name. */
function statusForSuiNsError(kind: SuiNsError["kind"]): number {
  switch (kind) {
    case "taken":
      return 409;
    case "unavailable":
      return 503;
    case "pending":
      return 202;
    default:
      return 400;
  }
}

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
    // Don't mask a read failure as "no username set" — that would render every
    // trader's fallback handle during a DB blip. Surface it so the client can
    // retry instead of caching a false null.
    console.error("[username] read", error);
    return NextResponse.json(
      { error: "Couldn't read the username." },
      { status: 502 },
    );
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

  // Cap firm-paid mint attempts per trader. Keyed on the Privy user (not the
  // wallet, so switching wallets can't sidestep it) and bucketed into a fixed
  // window; the durable claim holds across serverless instances.
  const claimBucket = Math.floor(Date.now() / CLAIM_WINDOW_MS);
  const withinLimit = await claimRateLimit(
    db,
    `username-claim:${trader.userId}:${claimBucket}`,
  );
  if (!withinLimit) {
    return NextResponse.json(
      { error: "You're doing that too fast — wait a moment and try again." },
      { status: 429 },
    );
  }

  let minted: Awaited<ReturnType<typeof mintUsernameSubname>>;
  try {
    minted = await mintUsernameSubname(suiAddress, label);
  } catch (error) {
    if (error instanceof SuiNsError) {
      // `pending` means the mint LANDED on-chain — the NFT is in the wallet, the
      // DB just hasn't recorded it yet. Flag it so the client shows "finalizing"
      // rather than a failure, and skip the availability re-check below (which
      // would report the user's own fresh name as "taken").
      const body =
        error.kind === "pending"
          ? { pending: true, error: error.message }
          : { error: error.message };
      return NextResponse.json(body, {
        status: statusForSuiNsError(error.kind),
      });
    }
    console.error("[username] mint", error);
    // A concurrent claim (or a double-submit) can win the race between the
    // availability pre-check and this mint; the on-chain abort surfaces as a
    // plain Error. Re-check so the loser gets a clear 409 "taken" instead of a
    // blanket "try again". If the re-check itself fails, fall through to 502.
    const stillFree = await isUsernameAvailable(label).catch(() => true);
    if (!stillFree) {
      return NextResponse.json(
        { error: "That username is taken. Try another." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "We couldn't claim your username. Please try again." },
      { status: 502 },
    );
  }

  let updated: number;
  try {
    updated = await setUsername(db, suiAddress, {
      displayName: minted.name,
      subnameNftId: minted.nftId,
    });
  } catch (error) {
    // The mint already succeeded on-chain (the NFT is in the user's wallet), so a
    // failed DB write must not read as a failed claim. Log the full mint so it can
    // be reconciled, and hand the minted identity back so the client can re-record
    // it without paying to mint again.
    console.error(
      "[username] mint recorded on-chain but DB write failed",
      {
        suiAddress,
        name: minted.name,
        nftId: minted.nftId,
        digest: minted.digest,
      },
      error,
    );
    return NextResponse.json(
      {
        error:
          "Your username is in your wallet but we couldn't save it. Refresh in a moment, and contact support if it doesn't appear.",
        username: { displayName: minted.name, subnameNftId: minted.nftId },
        digest: minted.digest,
      },
      { status: 500 },
    );
  }
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
