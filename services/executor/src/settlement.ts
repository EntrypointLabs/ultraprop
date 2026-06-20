import {
  type AccountRow,
  accounts,
  type Database,
  type PositionRow,
  positions,
} from "@shared/db";
import {
  applyFees,
  bracketTrigger,
  closeFill,
  computeEquity,
  detectOutcome,
  evaluateRules,
  liquidationPrice,
  maintenanceMargin,
  type Position,
  realizedOnClose,
  type Side,
  type Tier,
} from "@shared/sim-core";
import { HyperliquidAdapter } from "@shared/venues";
import { and, eq, inArray } from "drizzle-orm";
import { type OnChainWriter, usdToUsdcBaseUnits } from "./onchain.js";

/** Why a position closed in the loop (manual closes come via the intake API). */
type CloseReason = "tp" | "sl" | "liquidation";

/** Re-mark cadence; matches the gateway feed so settlement tracks fast moves. */
const DEFAULT_INTERVAL_MS = 250;

/**
 * The always-on settler. It is the browser-independent half of Phase B: it owns
 * the live mark feed, walks the open-position ledger every tick, and closes a
 * position the moment its bracket fires or it liquidates — writing the close
 * on-chain through the executor key. Manual closes arrive through the intake API
 * (a later brick); this loop owns only the automatic exits the browser used to
 * miss when it was shut.
 *
 * The PnL math is the SAME `@shared/sim-core` the trader app renders with, so the
 * settled equity and the live overlay never disagree.
 */
export class SettlementEngine {
  /** marketId -> latest mark price. */
  private readonly marks = new Map<string, number>();
  /** marketId -> venue max leverage (sets the maintenance-margin fraction). */
  private readonly maxLeverage = new Map<string, number>();
  private unsubscribe: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private settling = false;

  constructor(
    private readonly db: Database,
    private readonly writer: OnChainWriter,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
  ) {}

  async start(): Promise<void> {
    const adapter = new HyperliquidAdapter();
    for (const market of await adapter.listMarkets()) {
      this.maxLeverage.set(market.id, market.maxLeverage);
    }
    this.unsubscribe = adapter.subscribeMarks((ticks) => {
      for (const tick of ticks) this.marks.set(tick.marketId, tick.markPx);
    });
    this.timer = setInterval(() => void this.settleOnce(), this.intervalMs);
    console.log(
      `[settlement] started; ${this.maxLeverage.size} markets, ${this.intervalMs}ms tick`,
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Walk every open position once; settle any that triggered. Non-reentrant. */
  async settleOnce(): Promise<void> {
    if (this.settling) return; // a slow on-chain write must not overlap the next tick
    this.settling = true;
    try {
      const open = await this.db
        .select()
        .from(positions)
        .where(eq(positions.status, "open"));
      for (const row of open) {
        const markPx = this.marks.get(row.marketId);
        if (markPx == null || markPx <= 0) continue;
        const reason = this.triggerFor(row, markPx);
        if (reason) await this.settle(row, markPx, reason);
      }
    } catch (error) {
      console.error("[settlement] settleOnce failed", error);
    } finally {
      this.settling = false;
    }
  }

  /** TP/SL crossing (exact) or a liquidation crossing; null if the position lives. */
  private triggerFor(row: PositionRow, markPx: number): CloseReason | null {
    const pos = toEnginePosition(row, markPx);
    const bracket = bracketTrigger(pos, markPx);
    if (bracket) return bracket;

    const maxLev = this.maxLeverage.get(row.marketId) ?? pos.leverage;
    const isolatedMargin = pos.leverage > 0 ? pos.sizeUsd / pos.leverage : 0;
    // Isolated assumption: liquidation off this position's own margin. Cross liq
    // tracks account-wide value — a refinement once the loop aggregates equity.
    const liq = liquidationPrice({
      entryPrice: pos.entryPrice,
      sizeUsd: pos.sizeUsd,
      side: pos.side,
      maxLeverage: maxLev,
      marginMode: "isolated",
      isolatedMargin,
      accountValue: isolatedMargin,
      maintMarginRequired: maintenanceMargin(pos.sizeUsd, maxLev),
    });
    if (liq > 0) {
      const crossed = pos.side === "long" ? markPx <= liq : markPx >= liq;
      if (crossed) return "liquidation";
    }
    return null;
  }

  /** Book the close: authoritative net PnL → ledger row → on-chain → reconcile. */
  private async settle(
    row: PositionRow,
    markPx: number,
    reason: CloseReason,
  ): Promise<void> {
    const pos = toEnginePosition(row, markPx);
    const exitFill = closeFill(pos, markPx);
    const grossRealized = realizedOnClose(pos, exitFill);
    const exitNotional = (pos.sizeUsd / pos.entryPrice) * exitFill;
    const exitFee = applyFees(exitNotional, "taker");
    // Full lifecycle cost folded in, so on-chain equity reconciles: gross price
    // PnL, minus the exit fee and the still-unrecognized entry fee, plus funding.
    const netRealized = round2(
      grossRealized - exitFee - pos.entryFeeUsd + pos.fundingPaid,
    );

    await this.db
      .update(positions)
      .set({
        status: reason === "liquidation" ? "liquidated" : "closed",
        closedAt: new Date(),
        exitPrice: String(exitFill),
        realizedPnl: String(netRealized),
        closeReason: reason,
      })
      .where(eq(positions.id, row.id));

    const { digest } = await this.writer.logTrade({
      accountId: row.accountId,
      isWin: netRealized >= 0,
      pnl: usdToUsdcBaseUnits(netRealized),
      venue: "hyperliquid",
      market: row.marketId,
    });
    await this.db
      .update(positions)
      .set({ onChainDigest: digest })
      .where(eq(positions.id, row.id));

    console.log(
      `[settlement] ${reason} ${row.marketId} pos=${row.id} net=${netRealized} digest=${digest}`,
    );
    await this.reconcileAccount(row.accountId);
  }

  /**
   * After a close, recompute the account's equity from the ledger and flip it to
   * passed/failed on-chain if a rule resolved. Daily-loss anchoring and the live
   * intent count are simplified here (a refinement brick) — the drawdown/profit
   * gates, which decide most outcomes, are exact.
   */
  private async reconcileAccount(accountId: string): Promise<void> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.accountId, accountId));
    if (!account || account.status !== "evaluating") return;

    const closed = await this.db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.accountId, accountId),
          inArray(positions.status, ["closed", "liquidated"]),
        ),
      );
    const realizedTotal = closed.reduce(
      (sum, p) => sum + Number(p.realizedPnl ?? 0),
      0,
    );
    const openRows = await this.db
      .select()
      .from(positions)
      .where(
        and(eq(positions.accountId, accountId), eq(positions.status, "open")),
      );
    const openPositions = openRows.map((row) =>
      toEnginePosition(row, this.marks.get(row.marketId) ?? Number(row.entryPrice)),
    );

    const startingEquity = Number(account.startingEquity);
    const equity = computeEquity(startingEquity, realizedTotal, openPositions);
    const rules = evaluateRules({
      startingEquity,
      equity,
      dailyAnchorEquity: startingEquity,
      tier: tierFromAccount(account),
      intentCount: closed.length,
    });
    const outcome = detectOutcome("active", rules, null);
    if (outcome.status === "failed") {
      await this.writer.failEvaluation(accountId);
      await this.markAccount(accountId, "failed");
    } else if (outcome.status === "passed") {
      await this.writer.passEvaluation(accountId);
      await this.markAccount(accountId, "passed");
    }
  }

  private async markAccount(accountId: string, status: string): Promise<void> {
    await this.db
      .update(accounts)
      .set({ status, updatedAt: new Date() })
      .where(eq(accounts.accountId, accountId));
  }
}

const round2 = (n: number): number => Number(n.toFixed(2));

/** Project a ledger row onto the engine's `Position`, marked at `markPx`. */
function toEnginePosition(row: PositionRow, markPx: number): Position {
  const sizeUsd = Number(row.sizeUsd);
  const entryPrice = Number(row.entryPrice);
  const side = row.side as Side;
  const pnlPct = ((markPx - entryPrice) / entryPrice) * (side === "long" ? 1 : -1);
  return {
    id: row.id,
    symbol: row.marketId,
    side,
    sizeUsd,
    entryPrice,
    markPrice: markPx,
    unrealizedPnl: round2(sizeUsd * pnlPct),
    unrealizedPnlPct: round2(pnlPct * 100),
    openedAt: row.openedAt.getTime(),
    marginMode: row.marginMode as "isolated" | "cross",
    leverage: Number(row.leverage),
    entryFeeUsd: Number(row.entryFeeUsd),
    lastFundedAt: (row.lastFundedAt ?? row.openedAt).getTime(),
    fundingPaid: Number(row.fundingPaid),
    liquidationPrice: null,
    marginRatio: null,
    takeProfit: row.takeProfit != null ? Number(row.takeProfit) : null,
    stopLoss: row.stopLoss != null ? Number(row.stopLoss) : null,
  };
}

/** Reconstruct the tier rule shape the engine needs from the account snapshot. */
function tierFromAccount(account: AccountRow): Tier {
  return {
    id: "starter",
    name: account.tier,
    leverage: Number(account.leverageCap),
    profitTarget: Number(account.profitTarget),
    maxDrawdown: Number(account.maxDrawdown),
    dailyLoss: Number(account.dailyLoss),
    shadowAllocation: Number(account.startingEquity),
    intentCap: account.intentCap,
    locked: false,
    unlockedBy: null,
  };
}
