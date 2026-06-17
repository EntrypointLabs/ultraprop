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
