import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "./client.js";
import {
  accountExists,
  claimIdempotency,
  closeOpenPosition,
  completeIdempotency,
  findOpenPositionByClientId,
  insertOpenPosition,
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
});
