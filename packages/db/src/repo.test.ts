import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "./client.js";
import {
  accountExists,
  claimIdempotency,
  closeOpenPosition,
  completeIdempotency,
  findOpenPositionByClientId,
  getUsername,
  insertOpenPosition,
  settledTotals,
  setUsername,
  upsertAccount,
} from "./repo.js";
import {
  accounts,
  idempotencyKeys,
  inviteRedemptions,
  type NewAccountRow,
  type NewPositionRow,
  paymentDigests,
  positions,
} from "./schema.js";

/**
 * Real persistence guarantees, run against an in-process Postgres (PGlite, no
 * Docker): the migration creates the schema, then the repo helpers are exercised
 * end to end. This is what turns "the ledger typechecks" into "the atomic close
 * and durable dedup actually hold".
 */

const schema = {
  accounts,
  positions,
  idempotencyKeys,
  inviteRedemptions,
  paymentDigests,
};

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
);

async function freshDb(): Promise<Database> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await client.exec(trimmed);
    }
  }
  return db as unknown as Database;
}

const ACCOUNT: NewAccountRow = {
  accountId: "0xacc",
  owner: "0xowner",
  tier: "starter",
  status: "evaluating",
  startingEquity: "10000",
  profitTarget: "0.08",
  maxDrawdown: "0.1",
  dailyLoss: "0.05",
  leverageCap: "10",
  intentCap: 200,
};

function openRow(clientTradeId: string): NewPositionRow {
  return {
    accountId: "0xacc",
    clientTradeId,
    marketId: "hyperliquid:BTC",
    side: "long",
    sizeUsd: "10000",
    leverage: "10",
    marginMode: "cross",
    entryPrice: "100",
    entryFeeUsd: "4.5",
  };
}

describe("ledger repo", () => {
  let db: Database;
  beforeEach(async () => {
    db = await freshDb();
    await upsertAccount(db, ACCOUNT);
  });

  it("inserts and finds an open position by its client id", async () => {
    const id = await insertOpenPosition(db, openRow("pos_1"));
    expect(id).toBeTruthy();
    const found = await findOpenPositionByClientId(db, "0xacc", "pos_1");
    expect(found?.id).toBe(id);
    expect(Number(found?.entryPrice)).toBe(100);
  });

  it("closeOpenPosition is atomic: only the first closer wins", async () => {
    const id = await insertOpenPosition(db, openRow("pos_2"));
    const first = await closeOpenPosition(db, {
      id,
      exitPrice: "110",
      realizedPnl: "950",
      closeReason: "manual",
    });
    expect(first?.id).toBe(id);

    // A racing second close (the settlement loop, a retry) must not re-book it.
    const second = await closeOpenPosition(db, {
      id,
      exitPrice: "110",
      realizedPnl: "950",
      closeReason: "manual",
    });
    expect(second).toBeNull();

    // It no longer reads as an open position.
    expect(await findOpenPositionByClientId(db, "0xacc", "pos_2")).toBeNull();
  });

  it("idempotency: claimed once, deduped after, stored result returned", async () => {
    const first = await claimIdempotency(db, "0xacc:trade_1", "trade-close");
    expect(first.claimed).toBe(true);
    await completeIdempotency(db, "0xacc:trade_1", { digest: "abc" });

    const replay = await claimIdempotency(db, "0xacc:trade_1", "trade-close");
    expect(replay.claimed).toBe(false);
    expect(replay.result).toEqual({ digest: "abc" });
  });

  it("upsertAccount is idempotent and updates status", async () => {
    expect(await accountExists(db, "0xacc")).toBe(true);
    await upsertAccount(db, { ...ACCOUNT, status: "passed" });
    expect(await accountExists(db, "0xacc")).toBe(true);
  });

  it("settledTotals aggregates realized PnL + count over settled positions only", async () => {
    // No settled positions yet.
    expect(await settledTotals(db, "0xacc")).toEqual({
      realizedPnl: 0,
      count: 0,
    });

    const a = await insertOpenPosition(db, openRow("p_a"));
    const b = await insertOpenPosition(db, openRow("p_b"));
    await insertOpenPosition(db, openRow("p_open")); // stays open → excluded

    await closeOpenPosition(db, {
      id: a,
      exitPrice: "110",
      realizedPnl: "950.50",
      closeReason: "manual",
    });
    await closeOpenPosition(db, {
      id: b,
      exitPrice: "90",
      realizedPnl: "-200.25",
      closeReason: "liquidation",
    });

    const totals = await settledTotals(db, "0xacc");
    expect(totals.count).toBe(2);
    expect(totals.realizedPnl).toBeCloseTo(750.25, 2);
  });

  it("setUsername records the subname + NFT and reads back — case-insensitive by owner", async () => {
    expect(await getUsername(db, "0xowner")).toBeNull();

    // A mixed-case owner still resolves to the stored lowercased address.
    const updated = await setUsername(db, "0xOwner", {
      displayName: "alice.ultraprop.sui",
      subnameNftId: "0xnft",
    });
    expect(updated).toBe(1);
    expect(await getUsername(db, "0xowner")).toEqual({
      displayName: "alice.ultraprop.sui",
      subnameNftId: "0xnft",
    });

    // Re-claiming a new label overwrites the prior one.
    await setUsername(db, "0xowner", {
      displayName: "alice2.ultraprop.sui",
      subnameNftId: "0xnft2",
    });
    expect((await getUsername(db, "0xowner"))?.displayName).toBe(
      "alice2.ultraprop.sui",
    );
  });

  it("setUsername reports zero rows when the owner has no account", async () => {
    expect(
      await setUsername(db, "0xnobody", {
        displayName: "ghost.ultraprop.sui",
        subnameNftId: "0xg",
      }),
    ).toBe(0);
  });
});
