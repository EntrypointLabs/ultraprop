import "server-only";

import { type NewAccountRow, upsertAccount } from "@shared/db";
import { getDb } from "@/lib/db";
import type { TierName } from "@/lib/sui/config";

/**
 * The rule snapshot the executor needs to reconcile an account, keyed by tier.
 * Mirrors the v1 tier seed in the deployed `tier_config` (Starter/Basic/Pro), so
 * the ledger row is self-describing and settlement never needs a live read.
 */
const TIER_PARAMS: Record<
  string,
  {
    startingEquity: number;
    profitTarget: number;
    maxDrawdown: number;
    dailyLoss: number;
    leverageCap: number;
    intentCap: number;
  }
> = {
  starter: {
    startingEquity: 10_000,
    profitTarget: 0.08,
    maxDrawdown: 0.1,
    dailyLoss: 0.05,
    leverageCap: 10,
    intentCap: 200,
  },
  basic: {
    startingEquity: 25_000,
    profitTarget: 0.08,
    maxDrawdown: 0.08,
    dailyLoss: 0.05,
    leverageCap: 8,
    intentCap: 200,
  },
  pro: {
    startingEquity: 50_000,
    profitTarget: 0.1,
    maxDrawdown: 0.08,
    dailyLoss: 0.05,
    leverageCap: 8,
    intentCap: 200,
  },
};

/** The account-mirror row for a tier, with the rule snapshot resolved. */
export function accountMirrorRow(
  accountId: string,
  owner: string,
  tier: TierName,
): NewAccountRow {
  const params = TIER_PARAMS[tier] ?? TIER_PARAMS.starter;
  return {
    accountId,
    owner,
    tier,
    status: "evaluating",
    startingEquity: String(params.startingEquity),
    profitTarget: String(params.profitTarget),
    maxDrawdown: String(params.maxDrawdown),
    dailyLoss: String(params.dailyLoss),
    leverageCap: String(params.leverageCap),
    intentCap: params.intentCap,
  };
}

/**
 * Best-effort mirror of an on-chain account into the ledger so positions can
 * reference it. Never throws into the caller: a mirror failure must not block
 * account creation, and a missing `DATABASE_URL` is a no-op.
 */
export async function mirrorAccount(
  accountId: string,
  owner: string,
  tier: TierName,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await upsertAccount(db, accountMirrorRow(accountId, owner, tier));
  } catch (error) {
    console.error("[ledger] account mirror failed", error);
  }
}
