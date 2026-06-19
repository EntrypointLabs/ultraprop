import type { RuleBudget } from "@/lib/mock/types";
import { type AccountSummary, usdcToUsd } from "@/lib/sui/propfirm";

/**
 * Verifiable rule budgets derived from the on-chain `AccountState` rather than
 * the engine's local math. The chain is the source of truth for REALIZED equity
 * and the rule floors the executor's writes enforce, so the drawdown / daily-loss
 * / profit-target pills read straight off `getAccountSummary`. The intent-count
 * pill stays engine-only (the chain doesn't track per-eval order intents), so
 * it's left to the engine's `evaluateRules` and merged in by the caller.
 *
 * Drawdown is a STATIC floor (`max_dd_floor`) off the funded size — identical to
 * the engine's static drawdown model — so used = (fundedSize − equity), limit =
 * (fundedSize − maxDdFloor). Daily-loss can't be reconstructed verbatim from a
 * point-in-time read (the chain rolls its `day_start_equity` baseline internally
 * and doesn't expose it), so the on-chain daily pill reports the limit and a
 * conservative day-loss proxy off the funded size; the authoritative daily gate
 * still lives on-chain in `log_trade`.
 */

const round2 = (n: number): number => Number(n.toFixed(2));

const zoneOf = (used: number): RuleBudget["zone"] =>
  used >= 0.9 ? "danger" : used >= 0.7 ? "warn" : "safe";

export interface OnchainRuleOptions {
  /** engine-tracked day-loss in USD (from day-anchor), shown against the on-chain limit */
  dailyUsedUsd?: number;
}

/**
 * The three on-chain-verifiable rule budgets (drawdown, daily-loss, profit
 * target), in the same `RuleBudget` shape the pills render. `dailyUsedUsd` lets
 * the caller pass the engine's live day-loss figure (the chain's day baseline
 * isn't exposed) while the LIMIT remains the verifiable on-chain value.
 */
export function onchainRuleBudgets(
  summary: AccountSummary,
  opts: OnchainRuleOptions = {},
): RuleBudget[] {
  const equity = usdcToUsd(summary.equity);
  const fundedSize = usdcToUsd(summary.fundedSize);
  const maxDdFloor = usdcToUsd(summary.maxDdFloor);
  const dailyLossLimit = usdcToUsd(summary.dailyLossLimit);
  const profitTarget = usdcToUsd(summary.profitTarget);

  const ddLimit = Math.max(0, fundedSize - maxDdFloor);
  const ddUsed = Math.max(0, fundedSize - equity);
  const ddFrac = ddLimit > 0 ? Math.min(1, ddUsed / ddLimit) : 0;

  const dailyUsed = Math.max(0, opts.dailyUsedUsd ?? 0);
  const dailyFrac =
    dailyLossLimit > 0 ? Math.min(1, dailyUsed / dailyLossLimit) : 0;

  const targetGain = Math.max(0, profitTarget - fundedSize);
  const gainSoFar = Math.max(0, equity - fundedSize);
  const targetFrac = targetGain > 0 ? Math.min(1, gainSoFar / targetGain) : 0;

  return [
    {
      kind: "drawdown",
      label: "Max drawdown",
      current: round2(ddUsed),
      limit: round2(ddLimit),
      used: ddFrac,
      remaining: 1 - ddFrac,
      zone: zoneOf(ddFrac),
      unit: "usd",
      description: `On-chain: equity may not fall below the funded floor of $${maxDdFloor.toFixed(0)}. Verified against AccountState.`,
    },
    {
      kind: "dailyLoss",
      label: "Daily loss",
      current: round2(dailyUsed),
      limit: round2(dailyLossLimit),
      used: dailyFrac,
      remaining: 1 - dailyFrac,
      zone: zoneOf(dailyFrac),
      unit: "usd",
      description: `On-chain: daily realized loss may not exceed $${dailyLossLimit.toFixed(0)} from the day's start equity. Enforced in log_trade.`,
    },
    {
      kind: "profitTarget",
      label: "Profit target",
      current: round2(gainSoFar),
      limit: round2(targetGain),
      used: targetFrac,
      remaining: 1 - targetFrac,
      zone: targetFrac >= 1 ? "safe" : targetFrac >= 0.5 ? "warn" : "danger",
      unit: "usd",
      description: `On-chain: reach $${profitTarget.toFixed(0)} equity to pass. Verified against AccountState.`,
    },
  ];
}

/** Maps the on-chain `status_code` to the UI's `VaultStatus` terminal routing. */
export function statusFromCode(
  code: AccountSummary["statusCode"],
): "active" | "passed" | "failed" | "inactive" {
  switch (code) {
    case 1:
      return "passed";
    case 2:
      return "failed";
    case 3:
      // Suspended (an executor-registered breach) routes to the failed terminal.
      return "failed";
    default:
      return "active";
  }
}
