import { and, eq, gte, inArray, sql } from "drizzle-orm";
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

export interface SettledTotals {
  /** Summed realized PnL (USD) over closed + liquidated positions. */
  realizedPnl: number;
  /** Number of settled positions (the simplified intent count). */
  count: number;
}

/**
 * Realized-PnL sum and settled-position count for an account, computed in the
 * database in one row. The settlement loop needs these every tick; aggregating
 * in SQL returns a single row instead of re-transferring the account's entire
 * closed-trade history on each pass — the difference between bytes and gigabytes
 * of egress over a day of ticking. Uses the `(account_id, status)` index.
 */
export async function settledTotals(
  db: Database,
  accountId: string,
): Promise<SettledTotals> {
  const [row] = await db
    .select({
      realizedPnl: sql<string>`coalesce(sum(${positions.realizedPnl}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(positions)
    .where(
      and(
        eq(positions.accountId, accountId),
        inArray(positions.status, ["closed", "liquidated"]),
      ),
    );
  return { realizedPnl: Number(row?.realizedPnl ?? 0), count: row?.count ?? 0 };
}

export interface Username {
  /** The minted SuiNS subname, e.g. `gifted.ultraprop.sui`. */
  displayName: string;
  /** The `SuinsRegistration` NFT object id backing it. */
  subnameNftId: string;
}

/**
 * Record a freshly minted username (the subname + its NFT id) across every
 * account the owner holds. Matches on the lowercased owner address so it's
 * agnostic to hex casing, the same way the rest of the write path lowercases.
 * Returns the number of account rows updated — 0 means the owner has no account
 * yet, which the caller surfaces as "open your account first".
 */
export async function setUsername(
  db: Database,
  owner: string,
  username: Username,
): Promise<number> {
  const updated = await db
    .update(accounts)
    .set({
      displayName: username.displayName,
      subnameNftId: username.subnameNftId,
      updatedAt: new Date(),
    })
    .where(eq(accounts.owner, owner.toLowerCase()))
    .returning({ accountId: accounts.accountId });
  return updated.length;
}

/** The owner's current username + backing NFT, or null if unset (or no account). */
export async function getUsername(
  db: Database,
  owner: string,
): Promise<Username | null> {
  const [row] = await db
    .select({
      displayName: accounts.displayName,
      subnameNftId: accounts.subnameNftId,
    })
    .from(accounts)
    .where(eq(accounts.owner, owner.toLowerCase()))
    .limit(1);
  if (!row?.displayName) return null;
  return { displayName: row.displayName, subnameNftId: row.subnameNftId ?? "" };
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

/** Aggregate cohort figures, read straight from the account/position ledger. */
export interface CohortStatsRow {
  members: number;
  activeEvaluations: number;
  totalPasses: number;
  totalFails: number;
  /** median realized-return % across passed accounts (0 when there are none) */
  medianPasserReturnPct: number;
}

/**
 * Real cohort stats from the ledger: account counts by lifecycle status, and the
 * median realized return of passed accounts (summed closed-position PnL over
 * their starting equity). No fixtures — every figure is a row count.
 */
export async function getCohortStats(db: Database): Promise<CohortStatsRow> {
  const statusRows = await db
    .select({ status: accounts.status, n: sql<number>`count(*)::int` })
    .from(accounts)
    .groupBy(accounts.status);

  let members = 0;
  let activeEvaluations = 0;
  let totalPasses = 0;
  let totalFails = 0;
  for (const row of statusRows) {
    members += row.n;
    if (row.status === "evaluating") activeEvaluations += row.n;
    else if (row.status === "passed") totalPasses += row.n;
    else if (row.status === "failed" || row.status === "suspended")
      totalFails += row.n;
  }

  const passers = await db
    .select({
      startingEquity: accounts.startingEquity,
      pnl: sql<string>`coalesce(sum(${positions.realizedPnl}) filter (where ${positions.status} = 'closed'), 0)`,
    })
    .from(accounts)
    .leftJoin(positions, eq(positions.accountId, accounts.accountId))
    .where(eq(accounts.status, "passed"))
    .groupBy(accounts.accountId, accounts.startingEquity);

  const returns = passers
    .map((p) => {
      const equity = Number(p.startingEquity);
      return equity > 0 ? (Number(p.pnl) / equity) * 100 : 0;
    })
    .sort((a, b) => a - b);
  const mid = Math.floor(returns.length / 2);
  const medianPasserReturnPct =
    returns.length === 0
      ? 0
      : returns.length % 2 === 1
        ? returns[mid]
        : (returns[mid - 1] + returns[mid]) / 2;

  return {
    members,
    activeEvaluations,
    totalPasses,
    totalFails,
    medianPasserReturnPct,
  };
}

/** One trader's standing on the leaderboard, read from the ledger. */
export interface LeaderboardRow {
  /** the Sui address that owns the account (the trader identity) */
  owner: string;
  /** the owner's claimed SuiNS username, or null to fall back to the handle */
  displayName: string | null;
  tier: string;
  status: string;
  /** realized PnL (USD) summed over closed positions within the window */
  shadowPnl: number;
  /** evaluations passed (0 or 1 in v1 — one account per owner) */
  passes: number;
}

/**
 * Per-trader standings from the ledger: realized PnL summed over each account's
 * closed positions, plus tier and pass status straight from the account row. No
 * fixtures — every number is an aggregate of real rows. `sinceMs` (when given)
 * windows the PnL to positions closed at or after that instant; tier and pass
 * status are always the current snapshot. Ordering and ranking are the caller's
 * job, so one query serves every axis.
 */
export async function getLeaderboard(
  db: Database,
  opts: { sinceMs?: number } = {},
): Promise<LeaderboardRow[]> {
  const closedInWindow =
    opts.sinceMs !== undefined
      ? and(
          eq(positions.status, "closed"),
          gte(positions.closedAt, new Date(opts.sinceMs)),
        )
      : eq(positions.status, "closed");

  const rows = await db
    .select({
      owner: accounts.owner,
      displayName: accounts.displayName,
      tier: accounts.tier,
      status: accounts.status,
      pnl: sql<string>`coalesce(sum(${positions.realizedPnl}) filter (where ${closedInWindow}), 0)`,
    })
    .from(accounts)
    .leftJoin(positions, eq(positions.accountId, accounts.accountId))
    .groupBy(
      accounts.accountId,
      accounts.owner,
      accounts.displayName,
      accounts.tier,
      accounts.status,
    );

  return rows.map((row) => ({
    owner: row.owner,
    displayName: row.displayName,
    tier: row.tier,
    status: row.status,
    shadowPnl: Number(row.pnl),
    passes: row.status === "passed" ? 1 : 0,
  }));
}
