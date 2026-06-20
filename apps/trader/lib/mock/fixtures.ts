import type {
  CohortStats,
  EquityPoint,
  LeaderboardEntry,
  MarketId,
  Position,
  PriceTick,
  Profile,
  RuleBudget,
  SbtState,
  Session,
  Tier,
  TradeRecord,
  VaultState,
  VaultSummary,
} from "@/lib/mock/types";
import { evaluateRules } from "@/lib/sim/engine";

/**
 * Fixed reference epoch used to seed all time-based fixtures so server render
 * and first client render are identical (no hydration drift). Live jitter is
 * introduced only inside client effects/intervals, never here.
 */
export const SEED_NOW = 1_749_312_000_000; // 2025-06-07T16:00:00Z

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Deterministic mulberry32 PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededSpark(
  seed: number,
  base: number,
  count: number,
  vol: number,
): number[] {
  const r = rng(seed);
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < count; i++) {
    v = v * (1 + (r() - 0.5) * vol);
    out.push(Number(v.toFixed(base > 1000 ? 1 : 4)));
  }
  return out;
}

export const BASE_PRICES: Record<MarketId, number> = {
  "hyperliquid:BTC": 68_420.5,
  "hyperliquid:ETH": 3_512.18,
  "hyperliquid:SOL": 168.42,
};

/**
 * Seed marks for SSR / first client paint. The live HL marks query replaces
 * these post-hydration; until then `usePaperEngine` marks against this snapshot.
 */
export const INITIAL_PRICES: PriceTick[] = [
  {
    symbol: "hyperliquid:BTC",
    markPx: BASE_PRICES["hyperliquid:BTC"],
    oraclePx: BASE_PRICES["hyperliquid:BTC"],
    midPx: BASE_PRICES["hyperliquid:BTC"],
    fundingRate: 0,
    change24h: 2.14,
    spark: seededSpark(101, BASE_PRICES["hyperliquid:BTC"], 32, 0.01),
    high24h: null,
    low24h: null,
    ts: SEED_NOW,
  },
  {
    symbol: "hyperliquid:ETH",
    markPx: BASE_PRICES["hyperliquid:ETH"],
    oraclePx: BASE_PRICES["hyperliquid:ETH"],
    midPx: BASE_PRICES["hyperliquid:ETH"],
    fundingRate: 0,
    change24h: -1.42,
    spark: seededSpark(202, BASE_PRICES["hyperliquid:ETH"], 32, 0.014),
    high24h: null,
    low24h: null,
    ts: SEED_NOW,
  },
  {
    symbol: "hyperliquid:SOL",
    markPx: BASE_PRICES["hyperliquid:SOL"],
    oraclePx: BASE_PRICES["hyperliquid:SOL"],
    midPx: BASE_PRICES["hyperliquid:SOL"],
    fundingRate: 0,
    change24h: 4.83,
    spark: seededSpark(303, BASE_PRICES["hyperliquid:SOL"], 32, 0.02),
    high24h: null,
    low24h: null,
    ts: SEED_NOW,
  },
];

export const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    leverage: 10,
    profitTarget: 0.08,
    maxDrawdown: 0.1,
    dailyLoss: 0.05,
    shadowAllocation: 10_000,
    intentCap: 200,
    locked: false,
    unlockedBy: null,
  },
  {
    id: "basic",
    name: "Basic",
    leverage: 8,
    profitTarget: 0.08,
    maxDrawdown: 0.08,
    dailyLoss: 0.05,
    shadowAllocation: 25_000,
    intentCap: 200,
    locked: true,
    unlockedBy: "starter",
  },
  {
    id: "pro",
    name: "Pro",
    leverage: 8,
    profitTarget: 0.1,
    maxDrawdown: 0.08,
    dailyLoss: 0.05,
    shadowAllocation: 50_000,
    intentCap: 200,
    locked: true,
    unlockedBy: "basic",
  },
];

export const DEMO_WALLET =
  "0x9a4f2c1e7b8d3056af19e2c4b7d8f0a1c3e5d7b9f1a2c4e6d8b0f2a4c6e8d0b2";

export const MOCK_SESSION_SIGNED_OUT: Session = {
  address: null,
  chain: "sui",
  balanceUsd: 0,
  allowlisted: false,
  status: "disconnected",
};

export const MOCK_SESSION_SIGNED_IN: Session = {
  address: DEMO_WALLET,
  chain: "sui",
  balanceUsd: 0,
  allowlisted: true,
  status: "connected",
};

function buildEquityCurve(
  seed: number,
  start: number,
  points: number,
): EquityPoint[] {
  const r = rng(seed);
  const out: EquityPoint[] = [];
  let equity = start;
  for (let i = 0; i < points; i++) {
    const drift = 0.0008;
    equity = equity * (1 + drift + (r() - 0.48) * 0.01);
    out.push({
      ts: SEED_NOW - (points - 1 - i) * (15 * MINUTE),
      equity: Number(equity.toFixed(2)),
    });
  }
  return out;
}

export const DEMO_VAULT_ID = "vault_starter_001";

const STARTER = TIERS[0];

export const DEMO_EQUITY_CURVE: EquityPoint[] = buildEquityCurve(
  7,
  STARTER.shadowAllocation,
  96,
);

const lastEquity = DEMO_EQUITY_CURVE[DEMO_EQUITY_CURVE.length - 1].equity;
const peakEquity = Math.max(...DEMO_EQUITY_CURVE.map((p) => p.equity));

export const DEMO_POSITIONS: Position[] = [
  {
    id: "pos_1",
    symbol: "hyperliquid:BTC",
    side: "long",
    sizeUsd: 4200,
    entryPrice: 67_980.0,
    markPrice: BASE_PRICES["hyperliquid:BTC"],
    unrealizedPnl: 27.18,
    unrealizedPnlPct: 0.65,
    openedAt: SEED_NOW - 2 * HOUR,
    marginMode: "cross",
    leverage: 5,
    entryFeeUsd: 0,
    lastFundedAt: SEED_NOW - 2 * HOUR,
    fundingPaid: 0,
    liquidationPrice: null,
    marginRatio: null,
  },
  {
    id: "pos_2",
    symbol: "hyperliquid:SOL",
    side: "short",
    sizeUsd: 1500,
    entryPrice: 171.2,
    markPrice: BASE_PRICES["hyperliquid:SOL"],
    unrealizedPnl: 24.36,
    unrealizedPnlPct: 1.62,
    openedAt: SEED_NOW - 40 * MINUTE,
    marginMode: "isolated",
    leverage: 3,
    entryFeeUsd: 0,
    lastFundedAt: SEED_NOW - 40 * MINUTE,
    fundingPaid: 0,
    liquidationPrice: null,
    marginRatio: null,
  },
];

export const DEMO_TRADES: TradeRecord[] = [
  {
    id: "trd_1",
    symbol: "hyperliquid:BTC",
    side: "long",
    sizeUsd: 4200,
    oracleMid: 67_980.0,
    fill: 67_993.6,
    slippageBps: 0.0,
    feeUsd: 1.89,
    venue: "hyperliquid",
    realizedPnl: 24.6,
    ts: SEED_NOW - 2 * HOUR,
    txDigest: "9Xh2bQ7Lm4Tz1Rk8Pv3Nc6Wd4Fj5Hs2Ay9Bx4Cq7Er",
    closedBy: "manual",
  },
  {
    id: "trd_2",
    symbol: "hyperliquid:ETH",
    side: "long",
    sizeUsd: 2000,
    oracleMid: 3_488.4,
    fill: 3_489.1,
    slippageBps: 0.0,
    feeUsd: 0.9,
    venue: "hyperliquid",
    realizedPnl: 13.42,
    ts: SEED_NOW - 90 * MINUTE,
    txDigest: "3Kf7nR2Wp9Lv5Tz1Bx8Cq4Hs4Aj6Em2Yd9Fk3Nc7Pr",
    closedBy: "tp",
  },
  {
    id: "trd_3",
    symbol: "hyperliquid:SOL",
    side: "short",
    sizeUsd: 1500,
    oracleMid: 171.2,
    fill: 171.16,
    slippageBps: 0.0,
    feeUsd: 0.68,
    venue: "hyperliquid",
    realizedPnl: -8.3,
    ts: SEED_NOW - 40 * MINUTE,
    txDigest: "5Pq3wT8Nm1Kz6Rv2Bx9Cs4Hd4Aj7Ef3Yk9Lc5Nr2Wp",
    closedBy: "sl",
  },
];

/**
 * Build the rule budgets for the seed vault. Delegates to the engine's
 * canonical static-drawdown rule logic so the SSR seed and the live engine
 * never disagree. `peakEquity` is accepted for back-compat but no longer used
 * (drawdown is a static floor off starting equity).
 */
export function buildRuleBudgets(vault: {
  startingEquity: number;
  equity: number;
  peakEquity?: number;
  dailyAnchorEquity?: number;
  tier: Tier;
  intentCount: number;
}): RuleBudget[] {
  return evaluateRules({
    startingEquity: vault.startingEquity,
    equity: vault.equity,
    dailyAnchorEquity: vault.dailyAnchorEquity ?? vault.startingEquity,
    tier: vault.tier,
    intentCount: vault.intentCount,
  });
}

export const DEMO_VAULT: VaultState = {
  vaultId: DEMO_VAULT_ID,
  tier: STARTER,
  status: "active",
  owner: DEMO_WALLET,
  startingEquity: STARTER.shadowAllocation,
  equity: lastEquity,
  peakEquity,
  positions: DEMO_POSITIONS,
  rules: buildRuleBudgets({
    startingEquity: STARTER.shadowAllocation,
    equity: lastEquity,
    peakEquity,
    tier: STARTER,
    intentCount: 3,
  }),
  dailyResetAt: SEED_NOW + 8 * HOUR,
  inactiveAt: SEED_NOW + 7 * DAY,
  startedAt: SEED_NOW - DAY,
  triggerTrade: null,
  violatedRule: null,
  intentCount: 3,
};

export const DEMO_SBT: SbtState = {
  owner: DEMO_WALLET,
  level: 1,
  passedTiers: ["Starter"],
  lastLevelUpAt: SEED_NOW - 3 * DAY,
  objectId:
    "0x7c2e9a4f1b6d8053ae12c4b7d9f0a2c3e5d7b8f1a3c5e7d9b1f3a5c7e9d1b3a5",
  cohort: "v1 Genesis",
};

const LEADERBOARD_NAMES = [
  "satoshi.sui",
  "vega",
  "0xMomentum",
  "quietalpha",
  "delta_one",
  "ronin",
  "tabula",
  "nordic",
  "carrytrade",
  "mecha",
  "lowbeta",
  "orbit",
];

export const DEMO_LEADERBOARD: LeaderboardEntry[] = Array.from(
  { length: 12 },
  (_, i) => {
    const r = rng(900 + i);
    const sbtLevel = (
      i < 2 ? 3 : i < 6 ? 2 : 1
    ) as LeaderboardEntry["sbtLevel"];
    return {
      rank: i + 1,
      wallet:
        `0x${(0xa0 + i).toString(16).padStart(2, "0")}${"f3c7d9b1a5e2".repeat(5)}`.slice(
          0,
          66,
        ),
      displayName: LEADERBOARD_NAMES[i] ?? null,
      tier: sbtLevel === 3 ? "Pro" : sbtLevel === 2 ? "Basic" : "Starter",
      sbtLevel,
      shadowPnl: Number((18_000 * (1 - i / 14) * (0.9 + r() * 0.2)).toFixed(2)),
      passes: Math.max(1, 6 - Math.floor(i / 2)),
      consistency: Number((96 - i * 3.4 + r() * 4).toFixed(1)),
    };
  },
);

export const DEMO_PROFILE_EVALS: VaultSummary[] = [
  {
    vaultId: "vault_starter_001",
    tier: "Starter",
    status: "passed",
    startedAt: SEED_NOW - 21 * DAY,
    endedAt: SEED_NOW - 14 * DAY,
    returnPct: 8.4,
  },
  {
    vaultId: "vault_basic_001",
    tier: "Basic",
    status: "active",
    startedAt: SEED_NOW - DAY,
    endedAt: null,
    returnPct: 2.1,
  },
  {
    vaultId: "vault_starter_000",
    tier: "Starter",
    status: "failed",
    startedAt: SEED_NOW - 40 * DAY,
    endedAt: SEED_NOW - 38 * DAY,
    returnPct: -6.2,
  },
];

export function buildProfile(wallet: string): Profile {
  return {
    wallet,
    displayName: wallet === DEMO_WALLET ? "satoshi.sui" : null,
    joinedAt: SEED_NOW - 45 * DAY,
    sbt: { ...DEMO_SBT, owner: wallet },
    highestTier: "Basic",
    evaluations: DEMO_PROFILE_EVALS,
    shadowPnl: 14_280.42,
    passes: 1,
    fails: 1,
    consistency: 87.3,
  };
}

export const DEMO_COHORT: CohortStats = {
  cohort: "v1 Genesis",
  members: 248,
  activeEvaluations: 73,
  totalPasses: 41,
  passRate: 0.31,
  weekResetsAt: SEED_NOW + 3 * DAY + 4 * HOUR,
  medianPasserReturnPct: 5.2,
};
