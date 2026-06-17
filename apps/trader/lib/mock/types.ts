import type { MarketId } from "@/lib/mock/markets";

export type { MarketId } from "@/lib/mock/markets";

export type Side = "long" | "short";

export type ConnectionStatus = "live" | "reconnecting" | "stale";

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
  /** epoch ms of the last funding settlement boundary already charged */
  lastFundedAt: number;
  /** cumulative funding USD booked (negative = paid, positive = earned) */
  fundingPaid: number;
  /** estimated liquidation price off mark; null until first recompute */
  liquidationPrice: number | null;
  /** margin ratio = maintenance margin / equity-at-risk; null until computed */
  marginRatio: number | null;
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
  ts: number;
  /** Sui object/tx digest for "View on Sui Explorer" */
  txDigest: string;
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

export type SbtLevel = 0 | 1 | 2 | 3;

export interface SbtState {
  /** owner wallet address */
  owner: string;
  /** 0 = not yet minted, 1 = Starter passed, 2 = Basic, 3 = Pro */
  level: SbtLevel;
  /** tier names passed, in order */
  passedTiers: string[];
  /** epoch ms of last level-up, null if never minted */
  lastLevelUpAt: number | null;
  /** Sui object id of the SBT, null if not minted */
  objectId: string | null;
  /** cohort label, e.g. "v1 Genesis" */
  cohort: string;
}

export type LeaderboardAxis = "tier" | "shadowPnl" | "passes" | "consistency";

export type LeaderboardWindow = "all" | "weekly" | "daily";

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  displayName: string | null;
  /** highest tier name achieved */
  tier: string;
  sbtLevel: SbtLevel;
  /** shadow PnL in USD over the window */
  shadowPnl: number;
  /** number of evaluations passed */
  passes: number;
  /** consistency score 0..100 */
  consistency: number;
}

export interface Profile {
  wallet: string;
  displayName: string | null;
  /** epoch ms the wallet joined the cohort */
  joinedAt: number;
  sbt: SbtState;
  /** highest tier name achieved */
  highestTier: string;
  evaluations: VaultSummary[];
  /** lifetime shadow PnL in USD */
  shadowPnl: number;
  passes: number;
  fails: number;
  consistency: number;
}

export interface VaultSummary {
  vaultId: string;
  tier: string;
  status: VaultStatus;
  startedAt: number;
  endedAt: number | null;
  /** final/return PnL as percent */
  returnPct: number;
}

export interface CohortStats {
  cohort: string;
  /** total wallets in the cohort */
  members: number;
  /** wallets currently in an active evaluation */
  activeEvaluations: number;
  /** total evaluations passed across the cohort */
  totalPasses: number;
  /** pass rate 0..1 */
  passRate: number;
  /** epoch ms when the current weekly window resets */
  weekResetsAt: number;
  /** median tier-passer return percent at this point in the eval */
  medianPasserReturnPct: number;
}

export interface VaultState {
  vaultId: string;
  tier: Tier;
  status: VaultStatus;
  owner: string;
  /** starting equity in USD */
  startingEquity: number;
  /** current equity in USD */
  equity: number;
  /** peak equity reached, for trailing-drawdown floor */
  peakEquity: number;
  /** open positions */
  positions: Position[];
  /** rule budgets */
  rules: RuleBudget[];
  /** epoch ms of the next daily reset (00:00 UTC) */
  dailyResetAt: number;
  /** epoch ms when an idle vault auto-terminates (7-day) */
  inactiveAt: number;
  startedAt: number;
  /** for terminal states: the trade that triggered fail, if any */
  triggerTrade: TradeRecord | null;
  /** for failed vaults: which rule was violated */
  violatedRule: RuleKind | null;
  /** count of intents submitted */
  intentCount: number;
}

export interface Session {
  /** null when signed out */
  address: string | null;
  /** mock chain label */
  chain: "sui";
  /** USD balance chip value */
  balanceUsd: number;
  /** true when the wallet is on the closed-beta allowlist */
  allowlisted: boolean;
  status: "connected" | "disconnected";
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
