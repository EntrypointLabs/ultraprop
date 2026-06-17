"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DailyResetCountdown } from "@/components/evaluation/DailyResetCountdown";
import { DrawdownGauge } from "@/components/evaluation/DrawdownGauge";
import { MarketSelector } from "@/components/evaluation/MarketSelector";
import { PositionsTable } from "@/components/evaluation/PositionsTable";
import { RulePills } from "@/components/evaluation/RulePills";
import { TradeHistory } from "@/components/evaluation/TradeHistory";
import { TradeIntentForm } from "@/components/trade";
import { Badge, ConnectionDot, Skeleton } from "@/components/ui";
import {
  useConnection,
  useEquityCurve,
  usePositions,
  usePrice,
  useTradeHistory,
  useVault,
} from "@/lib/mock/hooks";
import {
  DEFAULT_MARKET_ID,
  decimalsFor,
  getMarket,
  type MarketId,
} from "@/lib/mock/markets";
import { usePaperEngine } from "@/lib/sim/usePaperEngine";
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

type BottomTab = "positions" | "history" | "account";

const BOTTOM_TABS: { id: BottomTab; label: string }[] = [
  { id: "positions", label: "Positions" },
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
}: {
  marketId: MarketId;
  onMarketChange: (id: MarketId) => void;
  vaultId: string;
}) {
  const tick = usePrice(marketId);
  const vault = useVault(vaultId);
  const connStatus = useConnection();

  const market = getMarket(marketId);
  const priceDecimals = decimalsFor(market);

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

  // Real trailing-24h high / low straight from the oracle history.
  const dailyRange24hLow = tick?.low24h ?? null;
  const dailyRange24hHigh = tick?.high24h ?? null;

  const returnPct =
    ((vault.equity - vault.startingEquity) / vault.startingEquity) * 100;
  const returnTone = returnPct >= 0 ? "text-up" : "text-down";

  return (
    <div className="border-b border-border bg-surface">
      {/* Stats row */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5">
        {/* Pair selector + leverage */}
        <div className="flex items-center gap-2.5">
          <MarketSelector marketId={marketId} onMarketChange={onMarketChange} />
          <Badge variant="leverage">{vault.tier.leverage}×</Badge>
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
              <span className="text-xs text-text-faint">Equity</span>
              <span className="tabular text-xs font-semibold text-text">
                {formatUsd(vault.equity, { decimals: 0 })}
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
}

export function EvaluationCockpit({ vaultId }: EvaluationCockpitProps) {
  const router = useRouter();
  const { submitOrder, closePosition } = usePaperEngine(vaultId);
  const vault = useVault(vaultId);
  const equityCurve = useEquityCurve(vaultId);
  const positions = usePositions(vaultId);
  const trades = useTradeHistory(vaultId);

  // The engine flips status on breach/pass — route to the matching terminal screen.
  useEffect(() => {
    if (vault.status === "passed")
      router.replace(`/evaluation/${vaultId}/passed`);
    else if (vault.status === "failed")
      router.replace(`/evaluation/${vaultId}/failed`);
    else if (vault.status === "inactive")
      router.replace(`/evaluation/${vaultId}/inactive`);
  }, [vault.status, vaultId, router]);

  const [marketId, setMarketId] = useState<MarketId>(DEFAULT_MARKET_ID);
  const [activeTab, setActiveTab] = useState<BottomTab>("positions");

  const { tier, startingEquity, peakEquity, rules } = vault;

  const ddRule = rules.find((r) => r.kind === "drawdown");
  const ddFraction = ddRule ? ddRule.used : 0;
  const ddCurrentUsd = ddRule ? ddRule.current : 0;
  const ddLimitUsd = ddRule ? ddRule.limit : 0;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg">
        {/* ── Market stats strip ─────────────────────────────────────────── */}
        <MarketStrip
          marketId={marketId}
          onMarketChange={setMarketId}
          vaultId={vaultId}
        />

        {/* ── Main trading grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px]">
          {/* LEFT: chart + risk strip */}
          <div className="flex flex-col border-r border-border">
            {/* Live Hyperliquid candle feed for the selected market */}
            <div className="h-[460px] border-b border-border bg-surface">
              <HLCandleChart marketId={marketId} />
            </div>

            {/* Risk / compliance strip — always visible beside the chart */}
            <div className="border-b border-border bg-surface px-4 py-3">
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

          {/* RIGHT: order entry */}
          <div className="flex flex-col border-b border-border bg-surface">
            <TradeIntentForm
              vaultId={vaultId}
              marketId={marketId}
              onMarketChange={setMarketId}
              onSubmitOrder={submitOrder}
            />
          </div>
        </div>

        {/* ── Bottom tab strip ───────────────────────────────────────────── */}
        <div className="border-b border-border bg-surface">
          <div className="flex items-center gap-0">
            {BOTTOM_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "border-b-2 px-5 py-3 text-xs font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-brand text-text"
                    : "border-transparent text-text-muted hover:text-text",
                )}
              >
                {tab.label}
                {tab.id === "positions" && positions.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-3 px-1 text-xs text-text-faint">
                    {positions.length}
                  </span>
                )}
                {tab.id === "history" && trades.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-3 px-1 text-xs text-text-faint">
                    {trades.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Bottom panel content ───────────────────────────────────────── */}
        <div className="min-h-[220px] bg-surface px-4 py-4">
          {activeTab === "positions" && (
            <PositionsTable positions={positions} onClose={closePosition} />
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
        </div>
      </div>
    </div>
  );
}
