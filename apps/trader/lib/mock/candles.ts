import { BASE_PRICES, SEED_NOW } from "@/lib/mock/fixtures";
import type { Symbol } from "@/lib/mock/types";

export interface Candle {
  /** epoch ms of the candle open */
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** notional traded in the candle, USD */
  volume: number;
}

export type Timeframe = "1H" | "4H" | "1D";

export const TIMEFRAMES: Timeframe[] = ["1H", "4H", "1D"];

const TF_MS: Record<Timeframe, number> = {
  "1H": 60 * 60 * 1000,
  "4H": 4 * 60 * 60 * 1000,
  "1D": 24 * 60 * 60 * 1000,
};

const CANDLE_COUNT = 140;

/** Per-symbol candle body volatility as a fraction of price. */
const VOL_FACTOR: Record<Symbol, number> = {
  BTC: 0.006,
  ETH: 0.009,
  SOL: 0.016,
};

/** Deterministic PRNG (mulberry32) so candles are identical every render/SSR. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(symbol: Symbol, tf: Timeframe): number {
  const s = `${symbol}-${tf}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic OHLC series ending near the symbol's base price, with a mild
 * upward drift and a per-symbol volatility profile. Pure: no clocks, no
 * `Math.random` at call time, so it is SSR-stable and identical across renders.
 */
export function buildCandles(symbol: Symbol, tf: Timeframe): Candle[] {
  const base = BASE_PRICES[symbol];
  const step = TF_MS[tf];
  const vol = VOL_FACTOR[symbol] * (tf === "1D" ? 1.8 : tf === "4H" ? 1.3 : 1);
  const rand = mulberry32(seedFor(symbol, tf));
  const start = SEED_NOW - (CANDLE_COUNT - 1) * step;

  const candles: Candle[] = [];
  let price = base * 0.82;

  for (let i = 0; i < CANDLE_COUNT; i++) {
    const open = price;
    const range = open * vol;
    const drift = (rand() - 0.46) * range * 1.6;
    const close = Math.max(open * 0.7, open + drift);
    const wickUp = rand() * range * 0.7;
    const wickDn = rand() * range * 0.7;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDn;
    const volume = base * (0.4 + rand() * 1.6) * (tf === "1D" ? 6 : 1);

    candles.push({
      t: start + i * step,
      open,
      high,
      low,
      close,
      volume: Math.round(volume),
    });
    price = close;
  }

  // Anchor the series so the final close lands on the symbol's base price,
  // so the live last-candle override is a seamless step (no end-of-series spike).
  const lastClose = candles[candles.length - 1].close;
  const factor = base / lastClose;
  return candles.map((c) => ({
    ...c,
    open: round(c.open * factor, base),
    high: round(c.high * factor, base),
    low: round(c.low * factor, base),
    close: round(c.close * factor, base),
  }));
}

function round(n: number, base: number): number {
  const dp = base > 1000 ? 1 : base > 100 ? 2 : 3;
  return Number(n.toFixed(dp));
}
