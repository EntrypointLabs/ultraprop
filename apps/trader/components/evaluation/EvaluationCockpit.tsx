"use client";

import { Maximize2, PauseCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Candle } from "@/components/charts/HLCandleChart";
import { DailyResetCountdown } from "@/components/evaluation/DailyResetCountdown";
import { DrawdownGauge } from "@/components/evaluation/DrawdownGauge";
import { MarketSelector } from "@/components/evaluation/MarketSelector";
import { OrdersPanel } from "@/components/evaluation/OrdersPanel";
import { PositionsTable } from "@/components/evaluation/PositionsTable";
import { RulePills } from "@/components/evaluation/RulePills";
import { TradeHistory } from "@/components/evaluation/TradeHistory";
import { Redirect } from "@/components/Redirect";
import { TradeIntentForm } from "@/components/trade";
import { Badge, Button, ConnectionDot, Modal, Skeleton } from "@/components/ui";
import { DEMO_TRADING_ENABLED } from "@/lib/auth";
import { DEMO_VAULT_ID } from "@/lib/mock/fixtures";
import {
  useConnection,
  useEquityCurve,
  useMarketCatalog,
  usePositions,
  usePrice,
  useSession,
  useTradeHistory,
  useVault,
} from "@/lib/mock/hooks";
import {
  DEFAULT_MARKET_ID,
  decimalsFor,
  getMarket,
  type MarketId,
  parseSide,
  resolveMarketId,
} from "@/lib/mock/markets";
import { useMockStore } from "@/lib/mock/store";
import type { RuleBudget, Side, Tier } from "@/lib/mock/types";
import { usePaperEngine } from "@/lib/sim/usePaperEngine";
import { onchainRuleBudgets, statusFromCode } from "@/lib/sui/onchainRules";
import { usdcToUsd } from "@/lib/sui/propfirm";
import { useOnchainAccountSummary } from "@/lib/sui/useTradingAccount";
import {
  cn,
  formatPct,
  formatUsd,
  formatUsdOrDash,
  VALUE_UNAVAILABLE,
} from "@/lib/utils";

// SSR-safe: Lightweight Charts requires the browser canvas API
const EquityCurve = dynamic(
  () =>
    import("@/components/evaluation/EquityCurve").then((m) => ({
      default: m.EquityCurve,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-60 w-full rounded-[var(--radius)]" />,
  },
);

const HLCandleChart = dynamic(
  () =>
    import("@/components/charts/HLCandleChart").then((m) => ({
      default: m.HLCandleChart,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[460px] w-full rounded-none" />,
  },
);

/* -------------------------------------------------------------------------- */
/* Bottom tab labels                                                            */
/* -------------------------------------------------------------------------- */

type BottomTab = "positions" | "orders" | "history" | "account";

const BOTTOM_TABS: { id: BottomTab; label: string }[] = [
  { id: "positions", label: "Positions" },
  { id: "orders", label: "Orders" },
  { id: "history", label: "Trade history" },
  { id: "account", label: "Account" },
];

/* -------------------------------------------------------------------------- */
/* Market stats strip                                                           */
/* -------------------------------------------------------------------------- */

function MarketStrip({
  marketId,
  onMarketChange,
  vaultId,
  onPause,
  canPause,
  range24h,
  onchainEquityUsd,
  liveUnrealizedUsd,
}: {
  marketId: MarketId;
  onMarketChange: (id: MarketId) => void;
  vaultId: string;
  onPause: () => void;
  canPause: boolean;
  /** Trailing-24h high/low derived from the chart's candles (null until loaded). */
  range24h: { high: number | null; low: number | null };
  /** Verifiable on-chain REALIZED equity in USD; null when no on-chain account. */
  onchainEquityUsd: number | null;
  /** Engine's live unrealized PnL overlay in USD (open positions only). */
  liveUnrealizedUsd: number;
}) {
  const tick = usePrice(marketId);
  const vault = useVault(vaultId);
  const connStatus = useConnection();

  // Authoritative displayed equity = on-chain realized equity + the engine's
  // live unrealized overlay. Falls back to the engine equity when there is no
  // on-chain account (signed-out demo / unconfigured package).
  const displayedEquity =
    onchainEquityUsd != null
      ? onchainEquityUsd + liveUnrealizedUsd
      : vault.equity;
  const equityIsVerified = onchainEquityUsd != null;

  const market = getMarket(marketId);
  const priceDecimals = decimalsFor(market);

  // EFFECTIVE per-market leverage cap = min(venue max, tier flat cap) — the same
  // ceiling the trade form enforces. A market whose venue max sits below the tier
  // cap shows its real usable limit, not the flat tier number.
  const effectiveLeverageCap = Math.min(
    market?.maxLeverage ?? vault.tier.leverage,
    vault.tier.leverage,
  );

  const price = tick?.markPx ?? null;
  const change24h = tick?.change24h ?? null;
  const up = (change24h ?? 0) >= 0;
  const changeTone =
    change24h == null ? "text-text-faint" : up ? "text-up" : "text-down";

  // Absolute 24h move, derived from spot and the percent change (both nullable).
  const absChange =
    price != null && change24h != null
      ? price - price / (1 + change24h / 100)
      : null;

  // Trailing-24h high / low. HL's per-coin mark feed carries none, so prefer the
  // values derived from the chart's loaded candles; fall back to the tick if a
  // richer feed ever supplies them.
  const dailyRange24hLow = range24h.low ?? tick?.low24h ?? null;
  const dailyRange24hHigh = range24h.high ?? tick?.high24h ?? null;

  const returnPct =
    ((displayedEquity - vault.startingEquity) / vault.startingEquity) * 100;
  const returnTone = returnPct >= 0 ? "text-up" : "text-down";

  return (
    <div className="rounded-t-[calc(var(--radius-lg)-1px)] border-b border-border bg-surface">
      {/* Mobile: two-row layout to prevent wrapping chaos.
          Row 1: selector + primary price stats (mark + 24h change).
          Row 2: scrollable secondary stats (range + account + controls).
          md+: single row, flex-wrap allowed — enough space to lay flat. */}

      {/* Row 1 — always visible, no scroll */}
      <div className="flex items-center justify-between gap-x-4 px-4 pt-2.5 pb-0 md:hidden">
        <div className="flex items-center gap-2">
          <MarketSelector marketId={marketId} onMarketChange={onMarketChange} />
          <Badge variant="leverage">{effectiveLeverageCap}×</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs text-text-faint">Mark</span>
            <span className="tabular text-sm font-semibold text-text">
              {formatUsdOrDash(price, { decimals: priceDecimals })}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-text-faint">24h</span>
            <span className={cn("tabular text-sm font-semibold", changeTone)}>
              {change24h != null ? (
                <>
                  {up ? "+" : ""}
                  {change24h.toFixed(2)}%
                </>
              ) : (
                VALUE_UNAVAILABLE
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Row 2 — secondary stats; scrolls horizontally, last item gets right
          padding so it's never flush against the viewport edge. No ml-auto
          inside a scroll container (it can't push past the scroll boundary). */}
      <div className="flex items-center gap-x-5 overflow-x-auto py-2 pl-4 pr-4 md:hidden [&::-webkit-scrollbar]:hidden">
        <div className="flex shrink-0 flex-col">
          <span className="text-xs text-text-faint">24h Range</span>
          <span className="tabular whitespace-nowrap text-xs font-medium text-text-muted">
            {formatUsdOrDash(dailyRange24hLow, { decimals: priceDecimals })}
            {" – "}
            {formatUsdOrDash(dailyRange24hHigh, { decimals: priceDecimals })}
          </span>
        </div>
        <div className="flex shrink-0 flex-col">
          <span className="flex items-center gap-1 text-xs text-text-faint">
            Equity
            {equityIsVerified && (
              <span
                title="Realized equity verified on-chain; live PnL overlaid"
                className="rounded-sm bg-brand/15 px-1 text-[9px] font-semibold uppercase leading-tight tracking-wide text-brand"
              >
                on-chain
              </span>
            )}
          </span>
          <span className="tabular text-xs font-semibold text-text">
            {formatUsd(displayedEquity, { decimals: 0 })}
          </span>
        </div>
        <div className="flex shrink-0 flex-col">
          <span className="text-xs text-text-faint">Return</span>
          <span className={cn("tabular text-xs font-semibold", returnTone)}>
            {formatPct(returnPct)}
          </span>
        </div>
        <div className="flex shrink-0 flex-col">
          <span className="text-xs text-text-faint">Orders</span>
          <span className="tabular text-xs font-semibold text-text">
            {vault.intentCount}/{vault.tier.intentCap}
          </span>
        </div>
        {/* Controls — not ml-auto; sit naturally at the end of the scroll track */}
        <div className="flex shrink-0 items-center gap-2 border-l border-border pl-4">
          <DailyResetCountdown resetAt={vault.dailyResetAt} />
          <ConnectionDot status={connStatus} />
          {canPause && (
            <button
              type="button"
              onClick={onPause}
              aria-label="Pause evaluation"
              title="Pause evaluation"
              className="flex h-7 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Pause
            </button>
          )}
        </div>
      </div>

      {/* md+ single-row layout — unchanged desktop behaviour */}
      <div className="hidden items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 md:flex md:flex-wrap">
        {/* Pair selector + leverage */}
        <div className="flex items-center gap-2.5">
          <MarketSelector marketId={marketId} onMarketChange={onMarketChange} />
          <Badge variant="leverage">{effectiveLeverageCap}×</Badge>
        </div>

        {/* Mark price */}
        <div className="flex flex-col">
          <span className="text-xs text-text-faint">Mark</span>
          <span className="tabular text-sm font-semibold text-text">
            {formatUsdOrDash(price, { decimals: priceDecimals })}
          </span>
        </div>

        {/* 24h change */}
        <div className="flex flex-col">
          <span className="text-xs text-text-faint">24h Change</span>
          <span className={cn("tabular text-sm font-semibold", changeTone)}>
            {absChange != null && change24h != null ? (
              <>
                {up ? "+" : ""}
                {formatUsd(absChange, { decimals: priceDecimals })}{" "}
                <span className="text-xs font-normal">
                  ({up ? "+" : ""}
                  {change24h.toFixed(2)}%)
                </span>
              </>
            ) : (
              VALUE_UNAVAILABLE
            )}
          </span>
        </div>

        {/* 24h range */}
        <div className="flex flex-col">
          <span className="text-xs text-text-faint">24h Range</span>
          <span className="tabular text-sm font-medium text-text-muted">
            {formatUsdOrDash(dailyRange24hLow, { decimals: priceDecimals })}
            {" – "}
            {formatUsdOrDash(dailyRange24hHigh, { decimals: priceDecimals })}
          </span>
        </div>

        {/* Right: account readout + connection */}
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden items-center gap-4 sm:flex">
            <div className="flex flex-col items-end">
              <span className="flex items-center gap-1 text-xs text-text-faint">
                Equity
                {equityIsVerified && (
                  <span
                    title="Realized equity verified on-chain; live PnL overlaid"
                    className="rounded-sm bg-brand/15 px-1 text-[9px] font-semibold uppercase leading-tight tracking-wide text-brand"
                  >
                    on-chain
                  </span>
                )}
              </span>
              <span className="tabular text-xs font-semibold text-text">
                {formatUsd(displayedEquity, { decimals: 0 })}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-text-faint">Return</span>
              <span className={cn("tabular text-xs font-semibold", returnTone)}>
                {formatPct(returnPct)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-text-faint">Orders</span>
              <span className="tabular text-xs font-semibold text-text">
                {vault.intentCount}/{vault.tier.intentCap}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DailyResetCountdown resetAt={vault.dailyResetAt} />
            <ConnectionDot status={connStatus} />
            {canPause && (
              <button
                type="button"
                onClick={onPause}
                aria-label="Pause evaluation"
                title="Pause evaluation"
                className="flex h-7 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <PauseCircle className="h-3.5 w-3.5" />
                Pause
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main cockpit                                                                 */
/* -------------------------------------------------------------------------- */

interface EvaluationCockpitProps {
  vaultId: string;
  /** Tier the evaluation opens AT on first creation (carried from onboarding). */
  tier?: Tier;
  /** Deep-link `?symbol=` (a bare ticker or a full MarketId) to pre-select. */
  initialSymbol?: string;
  /** Deep-link `?side=` to pre-fill the trade form ("long" | "short"). */
  initialSide?: string;
}

export function EvaluationCockpit({
  vaultId,
  tier: initialTier,
  initialSymbol,
  initialSide,
}: EvaluationCockpitProps) {
  // Resolve the deep-link market against the LIVE catalog so a bare ticker like
  // "BTC" maps to "hyperliquid:BTC" across the full universe; matching the
  // reactive catalog (not the module snapshot) means a deep-link to a market
  // outside the 3-market seed still resolves once the universe lands. The side
  // narrows to a valid literal. Both fall back to defaults when absent/invalid.
  const catalog = useMarketCatalog();
  const presetMarketId = useMemo(() => {
    const want = initialSymbol?.trim().toLowerCase();
    if (!want) return null;
    const hit = catalog.find(
      (m) => m.id.toLowerCase() === want || m.symbol.toLowerCase() === want,
    );
    return hit ? hit.id : resolveMarketId(initialSymbol);
  }, [catalog, initialSymbol]);
  const presetSide: Side | null = parseSide(initialSide);
  const { submitOrder, closePosition, setBracket, cancelBracket, pause } =
    usePaperEngine(vaultId, initialTier);
  const vault = useVault(vaultId);
  // The verifiable on-chain account state (realized equity + rule floors +
  // status), polled so it tracks the executor's writes. Null until the trader
  // has an on-chain account and the package is configured; the engine remains
  // the live overlay either way.
  const { summary: onchainSummary } = useOnchainAccountSummary();
  const equityCurve = useEquityCurve(vaultId);
  const positions = usePositions(vaultId);
  const trades = useTradeHistory(vaultId);
  const { session } = useSession();
  const openLogin = useMockStore((s) => s.openLogin);
  // A signed-out visitor may VIEW the shared demo vault read-only (the seeded
  // tabs/positions render — never the "Sign in to view" stub), but TRADING still
  // requires auth: an evaluation is identity-attributable, so the order form keeps
  // its sign-in gate. `DEMO_TRADING_ENABLED` is a dev/test-only bypass, off by default.
  const isDemoVault = vaultId === DEMO_VAULT_ID;
  const showSignInWall = !session.address && !isDemoVault;

  // Authoritative outcome = the ON-CHAIN status the executor set, when an
  // on-chain account exists; the engine's `detectOutcome` is the TRIGGER that
  // drives the executor (already wired in the bridge), but the chain is the
  // source of truth for the terminal screen. Fall back to the engine status for
  // the signed-out demo / unconfigured package. A local pause ("inactive") has
  // no on-chain notion, so it's preserved while the chain still reads Evaluating.
  const chainStatus =
    onchainSummary != null ? statusFromCode(onchainSummary.statusCode) : null;
  const authoritativeStatus =
    chainStatus == null
      ? vault.status
      : chainStatus === "active" && vault.status === "inactive"
        ? "inactive"
        : chainStatus;

  const [marketId, setMarketId] = useState<MarketId>(
    presetMarketId ?? DEFAULT_MARKET_ID,
  );
  const [activeTab, setActiveTab] = useState<BottomTab>("positions");
  const [expanded, setExpanded] = useState(false);

  // A deep-link to a market outside the 3-market seed resolves only once the
  // live universe lands; apply it then — but only while the user hasn't yet
  // touched the selector (still on the default), so we never override a manual
  // pick. Runs at most once, when the preset first becomes resolvable.
  const presetApplied = useRef(false);
  useEffect(() => {
    if (presetApplied.current || !presetMarketId) return;
    presetApplied.current = true;
    setMarketId((cur) => (cur === DEFAULT_MARKET_ID ? presetMarketId : cur));
  }, [presetMarketId]);

  // Trailing-24h high/low for the selected market, derived from the candles the
  // chart already loaded — HL's per-coin mark feed gives no 24h range, so this
  // reuses fetched data rather than issuing a second per-market request.
  const [candles, setCandles] = useState<Candle[]>([]);
  const onChartHistory = useCallback((next: Candle[]) => setCandles(next), []);
  // Clear the prior market's candles on switch so its 24h range never shows
  // against the new pair while the new history loads.
  const onMarketChange = useCallback((id: MarketId) => {
    setCandles([]);
    setMarketId(id);
  }, []);
  const range24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = candles.filter((c) => c.T >= cutoff);
    const window = recent.length > 0 ? recent : candles;
    if (window.length === 0) return { high: null, low: null };
    let high = window[0].high;
    let low = window[0].low;
    for (const c of window) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
    }
    return { high, low };
  }, [candles]);

  const { tier, startingEquity, peakEquity, rules: engineRules } = vault;

  // Live overlay — open positions' carrying value: unrealized PnL net of each
  // position's still-unrecognized lifecycle cost (minus entry fee, plus signed
  // funding), matching the engine's `computeEquity`. This is the clearly-live
  // layer painted on top of the on-chain REALIZED equity; it is never written to
  // chain (only realized closes move on-chain equity), and on-chain realized +
  // this overlay equals the engine equity when the two realized figures agree.
  const liveUnrealizedUsd = positions.reduce(
    (sum, p) => sum + p.unrealizedPnl - p.entryFeeUsd + p.fundingPaid,
    0,
  );
  const onchainEquityUsd =
    onchainSummary != null ? usdcToUsd(onchainSummary.equity) : null;

  // Drawdown / daily-loss / profit-target read off the verifiable on-chain
  // AccountState when present; the intent-count budget stays engine-only (the
  // chain tracks no per-eval intents). The engine's day-loss figure rides along
  // as the daily pill's "used" since the chain doesn't expose its day baseline.
  const rules = useMemo<RuleBudget[]>(() => {
    if (onchainSummary == null) return engineRules;
    const intentRule = engineRules.find((r) => r.kind === "intentCount");
    const engineDaily = engineRules.find((r) => r.kind === "dailyLoss");
    const onchain = onchainRuleBudgets(onchainSummary, {
      dailyUsedUsd: engineDaily?.current ?? 0,
    });
    return intentRule ? [...onchain, intentRule] : onchain;
  }, [onchainSummary, engineRules]);

  const ddRule = rules.find((r) => r.kind === "drawdown");
  const ddFraction = ddRule ? ddRule.used : 0;
  const ddCurrentUsd = ddRule ? ddRule.current : 0;
  const ddLimitUsd = ddRule ? ddRule.limit : 0;

  const activeTabLabel =
    BOTTOM_TABS.find((t) => t.id === activeTab)?.label ?? "";

  // Armed legs across all open positions — TP and SL count independently.
  const activeBracketCount = positions.reduce(
    (n, p) => n + (p.takeProfit != null ? 1 : 0) + (p.stopLoss != null ? 1 : 0),
    0,
  );

  // The active tab's body, reused by the inline panel and the expanded modal.
  const activeTabBody = (
    <>
      {activeTab === "positions" && (
        <PositionsTable
          positions={positions}
          onClose={closePosition}
          onSetBracket={setBracket}
          onCancelBracket={cancelBracket}
        />
      )}

      {activeTab === "orders" && (
        <OrdersPanel
          positions={positions}
          onSetBracket={setBracket}
          onCancelBracket={cancelBracket}
        />
      )}

      {activeTab === "history" && <TradeHistory trades={trades} />}

      {activeTab === "account" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_160px]">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-faint">
              Equity curve
            </div>
            <EquityCurve
              data={equityCurve}
              startingEquity={startingEquity}
              peakEquity={peakEquity}
              maxDrawdown={tier.maxDrawdown}
              profitTarget={tier.profitTarget}
              className="w-full"
            />
          </div>
          <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-border bg-surface-2 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-faint">
              Drawdown
            </div>
            <DrawdownGauge
              currentDd={ddCurrentUsd}
              maxDd={ddLimitUsd}
              fraction={ddFraction}
            />
            <div className="mt-3 space-y-1 text-center text-xs text-text-muted">
              <div>
                <span className="tabular font-semibold text-text">
                  {formatUsd(ddCurrentUsd)}
                </span>{" "}
                used
              </div>
              <div>
                limit{" "}
                <span className="tabular font-semibold text-text">
                  {formatUsd(ddLimitUsd)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Route to the matching terminal screen on a terminal authoritative status.
  // Render-time redirect (not an effect) so a terminal vault never flashes the
  // live cockpit before navigating; placed after all hooks, before the return.
  if (authoritativeStatus === "passed")
    return <Redirect href={`/evaluation/${vaultId}/passed`} />;
  if (authoritativeStatus === "failed")
    return <Redirect href={`/evaluation/${vaultId}/failed`} />;
  if (authoritativeStatus === "inactive")
    return <Redirect href={`/evaluation/${vaultId}/inactive`} />;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-6 sm:py-8">
      <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg">
        {/* ── Market stats strip ─────────────────────────────────────────── */}
        <MarketStrip
          marketId={marketId}
          onMarketChange={onMarketChange}
          vaultId={vaultId}
          onPause={pause}
          canPause={!showSignInWall && authoritativeStatus === "active"}
          range24h={range24h}
          onchainEquityUsd={onchainEquityUsd}
          liveUnrealizedUsd={liveUnrealizedUsd}
        />

        {/* ── Main trading grid ──────────────────────────────────────────────
            Mobile (<md):   single column, everything stacks
            Tablet (md):    2-col [1fr 320px] — chart+compliance left, order right
            Desktop (lg+):  2-col [1fr 360px] — same structure, wider order rail  */}
        <div className="grid grid-cols-1 overflow-hidden md:grid-cols-[1fr_320px] md:grid-rows-[auto_auto] lg:grid-cols-[1fr_360px]">
          {/* LEFT TOP: chart + compliance strip */}
          <div className="flex min-w-0 flex-col border-b border-border bg-surface md:col-start-1 md:row-start-1 md:border-r">
            {/* Live Hyperliquid candle feed for the selected market */}
            <div className="h-[300px] border-b border-border sm:h-[380px] lg:h-[460px]">
              <HLCandleChart marketId={marketId} onHistory={onChartHistory} />
            </div>

            {/* Risk / compliance strip */}
            <div className="px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
                  Compliance
                </span>
                <span className="text-xs text-text-faint">
                  click to inspect
                </span>
              </div>
              <RulePills rules={rules} />
            </div>
          </div>

          {/* RIGHT: order entry rail — spans the full height of the left column */}
          <div className="flex min-w-0 flex-col border-b border-border bg-surface md:col-start-2 md:row-span-2 md:row-start-1 md:border-b-0 md:overflow-y-auto">
            <TradeIntentForm
              vaultId={vaultId}
              marketId={marketId}
              onMarketChange={onMarketChange}
              onSubmitOrder={submitOrder}
              isGuestAllowed={isDemoVault && DEMO_TRADING_ENABLED}
              initialSide={presetSide ?? undefined}
            />
          </div>

          {/* LEFT BOTTOM: positions / trade history / account tabs */}
          <div className="flex min-w-0 flex-col border-border bg-surface md:col-start-1 md:row-start-2 md:border-r">
            {/* Tab strip + expand control */}
            <div className="flex items-center justify-between border-b border-border pr-2">
              <div className="flex items-center gap-0 overflow-x-auto">
                {BOTTOM_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "shrink-0 border-b-2 px-4 py-3 text-xs font-medium transition-colors sm:px-5",
                      activeTab === tab.id
                        ? "border-brand text-text"
                        : "border-transparent text-text-muted hover:text-text",
                    )}
                  >
                    {tab.label}
                    {tab.id === "positions" &&
                      !showSignInWall &&
                      positions.length > 0 && (
                        <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-3 px-1 text-xs text-text-faint">
                          {positions.length}
                        </span>
                      )}
                    {tab.id === "orders" &&
                      !showSignInWall &&
                      activeBracketCount > 0 && (
                        <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-3 px-1 text-xs text-text-faint">
                          {activeBracketCount}
                        </span>
                      )}
                    {tab.id === "history" &&
                      !showSignInWall &&
                      trades.length > 0 && (
                        <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-3 px-1 text-xs text-text-faint">
                          {trades.length}
                        </span>
                      )}
                  </button>
                ))}
              </div>

              {!showSignInWall && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  aria-label={`Expand ${activeTabLabel.toLowerCase()}`}
                  title="Expand"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Tab content — scrolls both axes so wide tables don't blow out the
                container on narrow viewports. Desktop gets a fixed height cap. */}
            <div className="overflow-x-auto overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 md:h-[220px]">
              {showSignInWall ? (
                <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-3 text-center">
                  <p className="max-w-xs text-sm text-text-muted">
                    Sign in to view your positions, trade history, and account.
                  </p>
                  <Button variant="primary" onClick={openLogin}>
                    Sign in
                  </Button>
                </div>
              ) : (
                activeTabBody
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={expanded}
        onClose={() => setExpanded(false)}
        title={activeTabLabel}
        className="max-w-5xl"
      >
        <div className="max-h-[70vh] overflow-y-auto">{activeTabBody}</div>
      </Modal>
    </div>
  );
}
