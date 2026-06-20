/**
 * The trading-domain types the pure engine operates on, shared verbatim between
 * the trader app (the live overlay) and the executor service (the authoritative
 * settler) so both compute identical PnL. Venue-qualified market identity is an
 * opaque `string` here; the catalog (depth, leverage, decimals) is passed in as
 * data, never imported — that is what keeps this package free of app coupling.
 */

export type MarketId = string;

export type Side = "long" | "short";

export type VaultStatus = "active" | "passed" | "failed" | "inactive";

export interface PriceTick {
  symbol: MarketId;
  /** venue mark price — drives PnL / equity / liquidation AND the headline display number. NEVER mid. */
  markPx: number;
  /** venue spot oracle price — funding notional basis (carried for funding accrual). */
  oraclePx: number;
  /** venue mid — drives FILL pricing (entry/exit, mid ± slippage) and is otherwise display-only. Never PnL/liq. */
  midPx: number;
  /** current per-interval funding rate, carried through; no accrual math here. */
  fundingRate: number;
  /** 24h percent change; null until the 24h history loads or if unavailable */
  change24h: number | null;
  /** recent closes for the sparkline, oldest -> newest; empty when unknown */
  spark: number[];
  /** trailing-24h high in USD; null when unknown */
  high24h: number | null;
  /** trailing-24h low in USD; null when unknown */
  low24h: number | null;
  /** epoch ms of this tick; 0 when there is no live data */
  ts: number;
}

export interface Tier {
  id: "starter" | "basic" | "pro";
  name: string;
  /** leverage multiplier shown on the lime badge, e.g. "10X" derives from this */
  leverage: number;
  /** profit target as fraction, e.g. 0.08 = 8% */
  profitTarget: number;
  /** max drawdown as fraction, e.g. 0.10 = 10% */
  maxDrawdown: number;
  /** daily loss limit as fraction */
  dailyLoss: number;
  /** shadow allocation in USD */
  shadowAllocation: number;
  /** intent cap (max trades) */
  intentCap: number;
  /** unlocked only after passing the previous tier */
  locked: boolean;
  /** id of the tier that must be passed to unlock this one */
  unlockedBy: Tier["id"] | null;
}

export interface EquityPoint {
  /** epoch ms */
  ts: number;
  /** account equity in USD */
  equity: number;
}

export interface Position {
  id: string;
  symbol: MarketId;
  side: Side;
  /** position size in USD */
  sizeUsd: number;
  entryPrice: number;
  markPrice: number;
  /** unrealized PnL in USD */
  unrealizedPnl: number;
  /** unrealized PnL as percent of size */
  unrealizedPnlPct: number;
  openedAt: number;
  /** margin mode for liquidation math — cross uses account-wide collateral */
  marginMode: "isolated" | "cross";
  /** leverage SET at open; isolated liq depends on it, cross does not */
  leverage: number;
  /** taker fee (USD, positive) paid to OPEN this position. Carried as an
   * unrecognized cost while open (subtracted from equity), then folded into the
   * close trade's realized PnL so on-chain `log_trade` sees the full lifecycle
   * cost and equity reconciles. */
  entryFeeUsd: number;
  /** epoch ms of the last funding settlement boundary already charged */
  lastFundedAt: number;
  /** cumulative funding USD booked (negative = paid, positive = earned) */
  fundingPaid: number;
  /** estimated liquidation price off mark; null until first recompute */
  liquidationPrice: number | null;
  /** margin ratio = maintenance margin / equity-at-risk; null until computed */
  marginRatio: number | null;
  /** take-profit trigger price (mark-crossing); null/undefined = no TP leg armed */
  takeProfit?: number | null;
  /** stop-loss trigger price (mark-crossing); null/undefined = no SL leg armed */
  stopLoss?: number | null;
  /** epoch ms after which an armed bracket is cancelled (not fired); null = never expires */
  bracketExpiresAt?: number | null;
}

export interface TradeRecord {
  id: string;
  symbol: MarketId;
  side: Side;
  sizeUsd: number;
  /** oracle mid at submit */
  oracleMid: number;
  /** modeled fill (mid + size impact) */
  fill: number;
  slippageBps: number;
  /** venue taker fee in USD charged on this fill */
  feeUsd: number;
  /** venue the fill was modeled against, e.g. "hyperliquid" */
  venue: string;
  /** realized PnL in USD (0 for entries that remain open) */
  realizedPnl: number;
  /** position entry price; set on close trades so the on-chain bridge can
   * recompute price PnL server-side. Undefined on the opening entry trade. */
  entryPrice?: number;
  /** leverage the closed position carried; set on close trades for the bridge. */
  leverage?: number;
  ts: number;
  /** Sui object/tx digest for "View on Sui Explorer" */
  txDigest: string;
  /** true when this close was a forced liquidation (mark crossed liq price) */
  liquidated?: boolean;
  /** why this position closed; undefined for the entry trade that opened it */
  closedBy?: "manual" | "tp" | "sl" | "liquidation";
}

export type RuleKind =
  | "drawdown"
  | "dailyLoss"
  | "profitTarget"
  | "intentCount";

export type RuleZone = "safe" | "warn" | "danger";

export interface RuleBudget {
  kind: RuleKind;
  label: string;
  /** current value in the rule's native unit (USD for loss rules, count for intents) */
  current: number;
  /** the limit / target */
  limit: number;
  /** 0..1 fraction of budget used toward the breach/target */
  used: number;
  /** 0..1 fraction of budget remaining */
  remaining: number;
  zone: RuleZone;
  /** human-readable rule text shown in the rule modal */
  description: string;
  unit: "usd" | "count" | "pct";
}

export interface SlippagePreview {
  oracleMid: number;
  slippageBps: number;
  /** the resulting fill price */
  fill: number;
  /** total notional cost at the worse fill */
  totalCost: number;
  /** venue taker fee in USD for this fill */
  feeUsd: number;
  /** venue the fill is modeled against, e.g. "hyperliquid" */
  venue: string;
}
