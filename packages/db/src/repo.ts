import { and, eq } from "drizzle-orm";
import type { Database } from "./client.js";
import {
  accounts,
  idempotencyKeys,
  type NewAccountRow,
  type NewPositionRow,
  type PositionRow,
  positions,
} from "./schema.js";

/**
 * The query layer over the ledger. Routes and the executor call these instead of
 * hand-writing Drizzle, so the position lifecycle (open → claim → close) and the
 * durable idempotency protocol live in exactly one place.
 */

/** Mirror an on-chain account locally so positions can reference it (FK) and the
 * executor can reconcile rules without a live read. Idempotent. */
export async function upsertAccount(
  db: Database,
  row: NewAccountRow,
): Promise<void> {
  await db
    .insert(accounts)
    .values(row)
    .onConflictDoUpdate({
      target: accounts.accountId,
      set: { status: row.status, tier: row.tier, updatedAt: new Date() },
    });
}

export async function accountExists(
  db: Database,
  accountId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.accountId })
    .from(accounts)
    .where(eq(accounts.accountId, accountId))
    .limit(1);
  return Boolean(row);
}

/** Record a freshly opened position (with the server's own fill) and return its id. */
export async function insertOpenPosition(
  db: Database,
  row: NewPositionRow,
): Promise<string> {
  const [inserted] = await db
    .insert(positions)
    .values(row)
    .returning({ id: positions.id });
  return inserted.id;
}

/** The open position a client correlates to its close, by the client's own id. */
export async function findOpenPositionByClientId(
  db: Database,
  accountId: string,
  clientTradeId: string,
): Promise<PositionRow | null> {
  const [row] = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.accountId, accountId),
        eq(positions.clientTradeId, clientTradeId),
        eq(positions.status, "open"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export interface ClosePositionInput {
  id: string;
  exitPrice: string;
  realizedPnl: string;
  closeReason: string;
  onChainDigest?: string;
}

/**
 * Atomically claim and close an open position: the `status = 'open'` guard means
 * only ONE of two concurrent closers (the manual close route and the executor's
 * settlement loop) wins. Returns the row if THIS call closed it, null if it was
 * already closed or never existed — so the caller knows whether to record on-chain.
 */
export async function closeOpenPosition(
  db: Database,
  input: ClosePositionInput,
): Promise<PositionRow | null> {
  const [row] = await db
    .update(positions)
    .set({
      status: "closed",
      closedAt: new Date(),
      exitPrice: input.exitPrice,
      realizedPnl: input.realizedPnl,
      closeReason: input.closeReason,
      onChainDigest: input.onChainDigest,
    })
    .where(and(eq(positions.id, input.id), eq(positions.status, "open")))
    .returning();
  return row ?? null;
}

export interface IdempotencyClaim {
  /** true if THIS request claimed the key (do the work); false if a prior one did. */
  claimed: boolean;
  /** the stored result of the prior completion, if any. */
  result: unknown;
}

/**
 * Durable, cross-instance dedup. The first caller inserts the key and gets
 * `claimed: true`; any duplicate (cold start, second instance, redeploy, retry)
 * finds the row and gets `claimed: false` plus the stored result — so a replayed
 * close never double-writes on-chain, unlike the old in-process `Set`.
 */
export async function claimIdempotency(
  db: Database,
  key: string,
  scope: string,
): Promise<IdempotencyClaim> {
  const inserted = await db
    .insert(idempotencyKeys)
    .values({ key, scope })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });
  if (inserted.length > 0) return { claimed: true, result: null };
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);
  return { claimed: false, result: existing?.result ?? null };
}

/** Store the completed result against a claimed idempotency key. */
export async function completeIdempotency(
  db: Database,
  key: string,
  result: unknown,
): Promise<void> {
  await db
    .update(idempotencyKeys)
    .set({ result })
    .where(eq(idempotencyKeys.key, key));
}
