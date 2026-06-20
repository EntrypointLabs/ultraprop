import { PGlite } from "@electric-sql/pglite";
import {
  accounts,
  type Database,
  idempotencyKeys,
  insertOpenPosition,
  inviteRedemptions,
  type NewAccountRow,
  type NewPositionRow,
  paymentDigests,
  positions,
  upsertAccount,
} from "@shared/db";
import type { MarkTick } from "@shared/venues";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { LogTradeParams, OnChainResult, OnChainWriter } from "./onchain.js";
import { SettlementEngine } from "./settlement.js";

/**
 * Proves the always-on settler end to end against an in-process Postgres: an open
 * position whose stop crosses is settled, written on-chain exactly once (atomic),
 * and funding accrues across hourly boundaries. No live feed and no real chain —
 * marks are injected, the writer is a spy.
 */

const schema = {
  accounts,
  positions,
  idempotencyKeys,
  inviteRedemptions,
  paymentDigests,
};

const require = createRequire(import.meta.url);
const migrationsDir = join(
  dirname(require.resolve("@shared/db/package.json")),
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

class SpyWriter implements OnChainWriter {
  readonly logTrades: LogTradeParams[] = [];
  readonly passed: string[] = [];
  readonly failed: string[] = [];

  async logTrade(params: LogTradeParams): Promise<OnChainResult> {
    this.logTrades.push(params);
    return { digest: `log-${this.logTrades.length}` };
  }
  async passEvaluation(accountId: string): Promise<OnChainResult> {
    this.passed.push(accountId);
    return { digest: "pass" };
  }
  async failEvaluation(accountId: string): Promise<OnChainResult> {
    this.failed.push(accountId);
    return { digest: "fail" };
  }
  async registerBreach(): Promise<OnChainResult> {
    return { digest: "breach" };
  }
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

const MARKET = "hyperliquid:BTC";

function tick(markPx: number, oraclePx: number, fundingRate: number): MarkTick {
  return {
    marketId: MARKET,
    markPx,
    oraclePx,
    midPx: markPx,
    fundingRate,
    change24h: null,
    nextFundingTime: 0,
    ts: 0,
  };
}

describe("SettlementEngine", () => {
  let db: Database;
  let writer: SpyWriter;
  beforeEach(async () => {
    db = await freshDb();
    writer = new SpyWriter();
    await upsertAccount(db, ACCOUNT);
  });

  it("settles a stop-loss crossing exactly once and books it on-chain", async () => {
    const row: NewPositionRow = {
      accountId: "0xacc",
      clientTradeId: "pos_sl",
      marketId: MARKET,
      side: "long",
      sizeUsd: "10000",
      leverage: "10",
      marginMode: "isolated",
      entryPrice: "100",
      entryFeeUsd: "4.5",
      stopLoss: "95",
    };
    const id = await insertOpenPosition(db, row);

    const engine = new SettlementEngine(db, writer);
    engine.setMarketLeverage(MARKET, 40);
    engine.ingestTicks([tick(94, 94, 0)]); // below the 95 stop

    await engine.settleOnce();

    const [closed] = await db
      .select()
      .from(positions)
      .where(eq(positions.id, id));
    expect(closed.status).toBe("closed");
    expect(closed.closeReason).toBe("sl");
    expect(writer.logTrades).toHaveLength(1);
    expect(writer.logTrades[0]?.isWin).toBe(false); // a long stopped below entry

    // A second pass must not re-book the now-closed position.
    await engine.settleOnce();
    expect(writer.logTrades).toHaveLength(1);
  });

  it("accrues funding across the hourly boundaries a position spans", async () => {
    const openedAt = new Date(0);
    const row: NewPositionRow = {
      accountId: "0xacc",
      clientTradeId: "pos_fund",
      marketId: MARKET,
      side: "long",
      sizeUsd: "10000",
      leverage: "2",
      marginMode: "isolated",
      entryPrice: "100",
      entryFeeUsd: "4.5",
      openedAt,
      lastFundedAt: openedAt,
    };
    const id = await insertOpenPosition(db, row);

    const twoHours = 2 * 3_600_000;
    const engine = new SettlementEngine(db, writer, {
      now: () => twoHours,
    });
    engine.setMarketLeverage(MARKET, 40);
    engine.ingestTicks([tick(100, 100, 0.01)]); // at entry: no close, positive rate

    await engine.settleOnce();

    const [position] = await db
      .select()
      .from(positions)
      .where(eq(positions.id, id));
    // Still open (mark is at entry), but a long pays funding on a positive rate.
    expect(position.status).toBe("open");
    expect(Number(position.fundingPaid)).toBeLessThan(0);
    expect(writer.logTrades).toHaveLength(0);
  });
});
