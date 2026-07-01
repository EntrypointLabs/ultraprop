export const SCHEMA_VERSION = 1;

// Shape of the on-chain `propfirm::user_account::TradeLogged` event.
// venue/market are event-only paper-trade attribution (REQ-07).
export type TradeLoggedEvent = {
  account_id: string;
  seq: string;
  is_win: boolean;
  pnl: string;
  venue: string;
  market: string;
  equity_after: string;
  reputation_after: string;
  timestamp_ms: string;
};

export const TRADE_LOGGED_FIELDS = [
  "account_id",
  "seq",
  "is_win",
  "pnl",
  "venue",
  "market",
  "equity_after",
  "reputation_after",
  "timestamp_ms",
] as const;

// Shape of the on-chain `propfirm::user_account::TradeSettled` event: the
// full-detail companion to TradeLogged that lets an indexer reconstruct a
// trader's realized history from events alone. u64 fields arrive as decimal
// strings; u8 fields (`side`, `close_reason`) as numbers. All USD/price/leverage
// values are fixed-point at 1e6. `pnl`/`funding_paid` are magnitudes whose signs
// are in `is_win`/`funding_is_credit`.
export type TradeSettledEvent = {
  account_id: string;
  seq: string;
  is_win: boolean;
  pnl: string;
  side: number; // 0 = long, 1 = short
  venue: string;
  market: string;
  size_usd: string;
  leverage: string;
  entry_price: string;
  exit_price: string;
  entry_fee: string;
  funding_paid: string;
  funding_is_credit: boolean;
  close_reason: number; // 0 = manual, 1 = tp, 2 = sl, 3 = liquidation
  equity_after: string;
  reputation_after: string;
  timestamp_ms: string;
};

export const TRADE_SETTLED_FIELDS = [
  "account_id",
  "seq",
  "is_win",
  "pnl",
  "side",
  "venue",
  "market",
  "size_usd",
  "leverage",
  "entry_price",
  "exit_price",
  "entry_fee",
  "funding_paid",
  "funding_is_credit",
  "close_reason",
  "equity_after",
  "reputation_after",
  "timestamp_ms",
] as const;
