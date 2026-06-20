import { NextResponse } from "next/server";
import {
  isAccountId,
  readJson,
  requireTrader,
  serverError,
} from "@/app/api/_lib/auth";
import { getGraphQLClient } from "@/lib/sui/client";
import { publicSuiConfig } from "@/lib/sui/config";
import { getTradingAccountId } from "@/lib/sui/propfirm";
import { reactivate } from "@/lib/sui/server";

export const runtime = "nodejs";

/** True when one of the caller's linked Sui wallets owns `accountId` on-chain. */
async function callerOwnsAccount(
  suiAddresses: string[],
  accountId: string,
): Promise<boolean> {
  const reader = getGraphQLClient();
  const { packageId } = publicSuiConfig();
  const target = accountId.trim().toLowerCase();
  for (const owner of suiAddresses) {
    const owned = await getTradingAccountId(reader, owner, packageId);
    if (owned && owned.toLowerCase() === target) return true;
  }
  return false;
}

/**
 * Firm-sponsored re-entry for the authenticated trader: puts their
 * Failed/Suspended account back into evaluation on its existing tier. The caller
 * must own the account (verified against their linked Sui wallets on-chain); the
 * AdminCap-gated `reactivate` itself is signed server-side by the firm key.
 */
export async function POST(req: Request) {
  const auth = await requireTrader(req);
  if (auth.response) return auth.response;

  const { accountId } = await readJson<{ accountId: string }>(req);
  if (!isAccountId(accountId)) {
    return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
  }

  try {
    if (!(await callerOwnsAccount(auth.trader.suiAddresses, accountId))) {
      return NextResponse.json(
        { error: "That account is not linked to your wallet." },
        { status: 403 },
      );
    }
    return NextResponse.json(await reactivate({ accountId }));
  } catch (error) {
    return serverError(error, "We couldn't re-enter the evaluation on-chain.");
  }
}
