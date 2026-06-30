import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The executor's source of truth. Phase A made trade *recording* trustworthy
 * (the server recomputes PnL against the real mark); this ledger closes the rest
 * of the gap — the server now OWNS each position from open to close, so entry
 * price, size, leverage, fees, and funding are never taken from the client, and
 * settlement survives the browser being closed.
 *
 * Money/price columns are `numeric` (exact, never float) and surface as strings;
 * the engine parses them to numbers at the edge, exactly as the client does.
 */

/** Lifecycle mirror of the on-chain account the executor settles against. */
export const accounts = pgTable("accounts", {
  /** Sui AccountState object id (0x…) — the on-chain identity. */
  accountId: text("account_id").primaryKey(),
  /** Sui address that owns the AccountCap. */
  owner: text("owner").notNull(),
  /** Optional self-chosen username: a SuiNS subname (e.g. `gifted.ultraprop.sui`)
   * minted to the owner. Null falls back to the generated handle. */
  displayName: text("display_name"),
  /** The `SuinsRegistration` NFT object id minted for `displayName`, so the
   * username can be linked to its on-chain entity. Null when no username is set. */
  subnameNftId: text("subname_nft_id"),
  tier: text("tier").notNull(),
  /** evaluating | passed | failed | suspended — mirrors the on-chain statusCode. */
  status: text("status").notNull().default("evaluating"),
  /** Equity the evaluation opened at (USD), the static floor for the rules. */
  startingEquity: numeric("starting_equity", {
    precision: 20,
    scale: 8,
  }).notNull(),
  /** Tier rule snapshot taken at open, so settlement never depends on a live read. */
  profitTarget: numeric("profit_target", { precision: 10, scale: 6 }).notNull(),
  maxDrawdown: numeric("max_drawdown", { precision: 10, scale: 6 }).notNull(),
  dailyLoss: numeric("daily_loss", { precision: 10, scale: 6 }).notNull(),
  leverageCap: numeric("leverage_cap", { precision: 10, scale: 2 }).notNull(),
  intentCap: integer("intent_cap").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * The server-owned position ledger. A row is created when the trader opens a
 * position (with the executor's OWN fill, not the client's), marked against the
 * live feed, and settled on-chain when it closes / a bracket fires / it liquidates.
 */
export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.accountId),
    /** Idempotency correlation: the client's intent id for this open. */
    clientTradeId: text("client_trade_id"),
    marketId: text("market_id").notNull(),
    /** long | short */
    side: text("side").notNull(),
    /** notional/exposure in USD = collateral × leverage. */
    sizeUsd: numeric("size_usd", { precision: 20, scale: 8 }).notNull(),
    leverage: numeric("leverage", { precision: 10, scale: 2 }).notNull(),
    /** isolated | cross */
    marginMode: text("margin_mode").notNull(),
    /** The executor's own modeled fill — authoritative, never client-asserted. */
    entryPrice: numeric("entry_price", { precision: 20, scale: 8 }).notNull(),
    entryFeeUsd: numeric("entry_fee_usd", {
      precision: 20,
      scale: 8,
    }).notNull(),
    fundingPaid: numeric("funding_paid", { precision: 20, scale: 8 })
      .notNull()
      .default("0"),
    takeProfit: numeric("take_profit", { precision: 20, scale: 8 }),
    stopLoss: numeric("stop_loss", { precision: 20, scale: 8 }),
    /** open | closed | liquidated */
    status: text("status").notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastFundedAt: timestamp("last_funded_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    exitPrice: numeric("exit_price", { precision: 20, scale: 8 }),
    realizedPnl: numeric("realized_pnl", { precision: 20, scale: 8 }),
    /** manual | tp | sl | liquidation */
    closeReason: text("close_reason"),
    /** the on-chain `log_trade` digest once the close is recorded. */
    onChainDigest: text("on_chain_digest"),
  },
  (table) => ({
    openByAccount: index("positions_open_by_account_idx").on(
      table.accountId,
      table.status,
    ),
  }),
);

/**
 * Durable, cross-instance idempotency — replaces the in-process `Set` in
 * `/api/trades/close`. A handler claims a key before doing work; a duplicate
 * request finds the row and returns the stored result instead of double-settling.
 */
export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  scope: text("scope").notNull(),
  result: jsonb("result"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

/** Single-use invite redemption (Starter-only, firm-sponsored). */
export const inviteRedemptions = pgTable("invite_redemptions", {
  code: text("code").primaryKey(),
  redeemedBy: text("redeemed_by").notNull(),
  accountId: text("account_id"),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Single-use payment transaction digests, so one fee transfer opens one account. */
export const paymentDigests = pgTable("payment_digests", {
  digest: text("digest").primaryKey(),
  owner: text("owner").notNull(),
  accountId: text("account_id"),
  amount: numeric("amount", { precision: 20, scale: 8 }),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
export type PositionRow = typeof positions.$inferSelect;
export type NewPositionRow = typeof positions.$inferInsert;
