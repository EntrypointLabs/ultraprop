// Sui Move call target + value-arg order for
// `propfirm::user_account::log_trade`. Object refs (ExecutorCap,
// AccessRegistry, AccountRegistry, Clock) are resolved at tx-build
// time; the value args below carry the trade payload, including
// event-only venue/market attribution (REQ-07).
export const LOG_TRADE_TARGET = "user_account::log_trade" as const;

export const LOG_TRADE_VALUE_ARGS = [
  "account_id", // ID
  "is_win", // bool
  "pnl", // u64
  "venue", // String
  "market", // String
] as const;
