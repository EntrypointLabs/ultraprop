import {
  type AccountRow,
  accounts,
  type Database,
  type PositionRow,
  positions,
} from "@shared/db";
import {
  accrueFunding,
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
import { HyperliquidAdapter, type MarkTick } from "@shared/venues";
import { and, eq, inArray } from "drizzle-orm";
import { type OnChainWriter, usdToUsdcBaseUnits } from "./onchain.js";

/** Why a position closed in the loop (manual closes come via the intake API). */
type CloseReason = "tp" | "sl" | "liquidation";

/** Re-mark cadence; matches the gateway feed so settlement tracks fast moves. */
const DEFAULT_INTERVAL_MS = 250;
/** HL settles funding hourly; a position pays once per boundary it spans. */
const FUNDING_INTERVAL_MS = 3_600_000;

/** Latest venue state per market: mark drives PnL/liq, oracle+rate drive funding. */
interface MarkState {
  markPx: number;
  oraclePx: number;
  fundingRate: number;
  ts: number;
}

export interface SettlementOptions {
  intervalMs?: number;
  /** Injectable clock so funding accrual is deterministic under test. */
  now?: () => number;
}

/**
 * The always-on settler — the browser-independent half of Phase B. It owns the
 * live mark feed, accrues funding on open positions, walks the ledger every tick,
 * and closes a position the moment its bracket fires or it liquidates, writing the
 * close on-chain through the executor key. Manual closes arrive through the intake
 * API; this loop owns the automatic exits the browser used to miss when shut.
 *
 * The PnL math is the SAME `@shared/sim-core` the trader app renders with, so the
 * settled equity and the live overlay never disagree.
 */
export class SettlementEngine {
  /** marketId -> latest venue state. */
  private readonly marks = new Map<string, MarkState>();
  /** marketId -> venue max leverage (sets the maintenance-margin fraction). */
  private readonly maxLeverage = new Map<string, number>();
  private readonly intervalMs: number;
  private readonly now: () => number;
  private unsubscribe: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private settling = false;

  constructor(
    private readonly db: Database,
    private readonly writer: OnChainWriter,
    options: SettlementOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  async start(): Promise<void> {
    const adapter = new HyperliquidAdapter();
    for (const market of await adapter.listMarkets()) {
      this.maxLeverage.set(market.id, market.maxLeverage);
    }
    this.unsubscribe = adapter.subscribeMarks((ticks) => this.ingestTicks(ticks));
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

  /** Update the latest mark/oracle/funding per market. The feed calls this; tests
   * call it directly to drive the loop without a live socket. */
  ingestTicks(ticks: MarkTick[]): void {
    for (const tick of ticks) {
      this.marks.set(tick.marketId, {
        markPx: tick.markPx,
        oraclePx: tick.oraclePx,
        fundingRate: tick.fundingRate,
        ts: tick.ts,
      });
    }
  }

  /** Seed a market's venue max leverage (the catalog does this at start; tests
   * call it directly). */
  setMarketLeverage(marketId: string, maxLeverage: number): void {
    this.maxLeverage.set(marketId, maxLeverage);
  }

  /**
   * Walk every open position once: accrue funding, then settle any that
   * triggered. Cross-margin liquidation is evaluated against account-wide equity
   * (aggregated per account), isolated against the position's own margin.
   * Non-reentrant — a slow on-chain write must not overlap the next tick.
   */
  async settleOnce(): Promise<void> {
    if (this.settling) return;
    this.settling = true;
    try {
      const open = await this.db
        .select()
        .from(positions)
        .where(eq(positions.status, "open"));
      if (open.length === 0) return;

      // Funding first: it changes carry, which changes the cross-margin value the
      // liquidation check reads. Mutates each row in place so this pass is coherent.
      for (const row of open) await this.accrueFunding(row);

      const byAccount = new Map<string, PositionRow[]>();
      for (const row of open) {
        const rows = byAccount.get(row.accountId) ?? [];
        rows.push(row);
        byAccount.set(row.accountId, rows);
      }

      for (const [accountId, rows] of byAccount) {
        const accountValue = await this.accountValue(accountId, rows);
        for (const row of rows) {
          const mark = this.marks.get(row.marketId);
          if (!mark || mark.markPx <= 0) continue;
          const reason = this.triggerFor(row, mark.markPx, accountValue);
          if (reason) await this.settle(row, mark.markPx, reason);
        }
      }
    } catch (error) {
      console.error("[settlement] settleOnce failed", error);
    } finally {
      this.settling = false;
    }
  }

  /**
   * Accrue funding for each settlement boundary the position has spanned since it
   * was last funded (HL funds hourly, on oracle notional, signed so a long pays a
   * positive rate). Persists the new cumulative funding + watermark and mutates
   * the in-memory row so the rest of this pass sees it.
   */
  private async accrueFunding(row: PositionRow): Promise<void> {
    const mark = this.marks.get(row.marketId);
    if (!mark) return;
    const last = (row.lastFundedAt ?? row.openedAt).getTime();
    const elapsed = Math.floor((this.now() - last) / FUNDING_INTERVAL_MS);
    if (elapsed < 1) return;

    const funding = accrueFunding({
      sizeUsd: Number(row.sizeUsd),
      entryPrice: Number(row.entryPrice),
      oraclePx: mark.oraclePx,
      side: row.side as Side,
      fundingRate: mark.fundingRate,
      settlementsElapsed: elapsed,
    });
    const fundingPaid = Number(row.fundingPaid) + funding;
    const lastFundedAt = new Date(last + elapsed * FUNDING_INTERVAL_MS);
    await this.db
      .update(positions)
      .set({ fundingPaid: String(fundingPaid), lastFundedAt })
      .where(eq(positions.id, row.id));
    row.fundingPaid = String(fundingPaid);
    row.lastFundedAt = lastFundedAt;
  }

  /** Account-wide equity for cross-margin liquidation: starting + realized + carry. */
  private async accountValue(
    accountId: string,
    openRows: PositionRow[],
  ): Promise<number> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.accountId, accountId));
    const starting = account ? Number(account.startingEquity) : 0;
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
    const openPositions = openRows.map((row) =>
      toEnginePosition(row, this.marks.get(row.marketId)?.markPx ?? Number(row.entryPrice)),
    );
    return computeEquity(starting, realizedTotal, openPositions);
  }

  /** TP/SL crossing (exact) or a liquidation crossing; null if the position lives. */
  private triggerFor(
    row: PositionRow,
    markPx: number,
    accountValue: number,
  ): CloseReason | null {
    const pos = toEnginePosition(row, markPx);
    const bracket = bracketTrigger(pos, markPx);
    if (bracket) return bracket;

    const maxLev = this.maxLeverage.get(row.marketId) ?? pos.leverage;
    const isolatedMargin = pos.leverage > 0 ? pos.sizeUsd / pos.leverage : 0;
    const liq = liquidationPrice({
      entryPrice: pos.entryPrice,
      sizeUsd: pos.sizeUsd,
      side: pos.side,
      maxLeverage: maxLev,
      marginMode: pos.marginMode,
      isolatedMargin,
      // Cross liq tracks account-wide value; isolated ignores it.
      accountValue,
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
    // Full lifecycle cost folded in so on-chain equity reconciles: gross price
    // PnL, minus the exit fee and the still-unrecognized entry fee, plus funding.
    const netRealized = round2(
      grossRealized - exitFee - pos.entryFeeUsd + pos.fundingPaid,
    );

    // Atomic claim: only settle the row if it's still open, so the manual-close
    // route and this loop can never both book it.
    const claimed = await this.db
      .update(positions)
      .set({
        status: reason === "liquidation" ? "liquidated" : "closed",
        closedAt: new Date(),
        exitPrice: String(exitFill),
        realizedPnl: String(netRealized),
        closeReason: reason,
      })
      .where(and(eq(positions.id, row.id), eq(positions.status, "open")))
      .returning({ id: positions.id });
    if (claimed.length === 0) return; // already closed elsewhere

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
   * intent count are simplified (a refinement brick); the drawdown/profit gates,
   * which decide most outcomes, are exact.
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
      toEnginePosition(row, this.marks.get(row.marketId)?.markPx ?? Number(row.entryPrice)),
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
