"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DailyResetCountdown } from "@/components/evaluation/DailyResetCountdown";
import { DrawdownGauge } from "@/components/evaluation/DrawdownGauge";
import { PositionsTable } from "@/components/evaluation/PositionsTable";
import { RulePills } from "@/components/evaluation/RulePills";
import { TradeHistory } from "@/components/evaluation/TradeHistory";
import { TradeIntentForm } from "@/components/trade";
import { AssetIcon, Badge, ConnectionDot, Skeleton } from "@/components/ui";
import type { Timeframe } from "@/lib/mock/candles";
import {
  useCandles,
  useConnection,
  useEquityCurve,
  useMarkets,
  usePositions,
  usePrice,
  useTradeHistory,
  useVault,
} from "@/lib/mock/hooks";
import type { Symbol } from "@/lib/mock/types";
import { usePaperEngine } from "@/lib/sim/usePaperEngine";
import { cn, formatPct, formatUsd } from "@/lib/utils";

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

const MarketChart = dynamic(
  () =>
    import("@/components/charts/MarketChart").then((m) => ({
      default: m.MarketChart,
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
/* Asset pill (market strip selector)                                          */
/* -------------------------------------------------------------------------- */

function AssetPill({
  symbol,
  active,
  onClick,
}: {
  symbol: Symbol;
  active: boolean;
  onClick: () => void;
}) {
  const tick = usePrice(symbol);
  const price = tick?.price ?? 0;
  const change = tick?.change24h ?? 0;
  const up = change >= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-1.5 transition-colors",
        active
          ? "border-border bg-surface-3 text-text"
          : "border-transparent text-text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      <AssetIcon symbol={symbol} size={14} />
      <span className="text-xs font-semibold">{symbol}</span>
      <span className={cn("tabular text-xs", up ? "text-up" : "text-down")}>
        {formatUsd(price, { decimals: price > 100 ? 0 : 2 })}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Market stats strip                                                           */
/* -------------------------------------------------------------------------- */

function MarketStrip({
  symbol,
  onSymbolChange,
  vaultId,
}: {
  symbol: Symbol;
  onSymbolChange: (s: Symbol) => void;
  vaultId: string;
}) {
  const markets = useMarkets();
  const tick = usePrice(symbol);
  const vault = useVault(vaultId);
  const connStatus = useConnection();

  const price = tick?.price ?? 0;
  const change24h = tick?.change24h ?? 0;
  const up = change24h >= 0;
  const changeTone = up ? "text-up" : "text-down";

  // Derive 24h volume + range from the mock data (base price ± change).
  const basePrice = price / (1 + change24h / 100);
  const absChange = price - basePrice;
  const vol24h =
    price * (symbol === "BTC" ? 18_400 : symbol === "ETH" ? 92_000 : 1_240_000);

  // 24h high / low approximated from the daily candle
  const dailyRange24hLow = Math.min(basePrice, price) * 0.992;
  const dailyRange24hHigh = Math.max(basePrice, price) * 1.008;

  const returnPct =
    ((vault.equity - vault.startingEquity) / vault.startingEquity) * 100;
  const returnTone = returnPct >= 0 ? "text-up" : "text-down";

  return (
    <div className="border-b border-border bg-surface">
      {/* Asset selector row */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        {(["BTC", "ETH", "SOL"] as Symbol[]).map((s) => (
          <AssetPill
            key={s}
            symbol={s}
            active={symbol === s}
            onClick={() => onSymbolChange(s)}
          />
        ))}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5">
        {/* Pair + leverage */}
        <div className="flex items-center gap-2.5">
          <span className="text-base font-semibold text-text">
            {symbol} / USD
          </span>
          <Badge variant="leverage">{vault.tier.leverage}×</Badge>
        </div>

        {/* Mark price */}
        <div className="flex flex-col">
          <span className="text-xs text-text-faint">Mark</span>
          <span className="tabular text-sm font-semibold text-text">
            {formatUsd(price, { decimals: price > 100 ? 1 : 2 })}
          </span>
        </div>

        {/* 24h change */}
        <div className="flex flex-col">
          <span className="text-xs text-text-faint">24h Change</span>
          <span className={cn("tabular text-sm font-semibold", changeTone)}>
            {up ? "+" : ""}
            {formatUsd(absChange, { decimals: price > 100 ? 1 : 2 })}{" "}
            <span className="text-xs font-normal">
              ({up ? "+" : ""}
              {change24h.toFixed(2)}%)
            </span>
          </span>
        </div>

        {/* 24h volume */}
        <div className="flex flex-col">
          <span className="text-xs text-text-faint">24h Volume</span>
          <span className="tabular text-sm font-medium text-text-muted">
            {vol24h >= 1_000_000_000
              ? `$${(vol24h / 1_000_000_000).toFixed(2)}B`
              : `$${(vol24h / 1_000_000).toFixed(1)}M`}
          </span>
        </div>

        {/* 24h range */}
        <div className="flex flex-col">
          <span className="text-xs text-text-faint">24h Range</span>
          <span className="tabular text-sm font-medium text-text-muted">
            {formatUsd(dailyRange24hLow, { decimals: price > 100 ? 0 : 2 })}
            {" – "}
            {formatUsd(dailyRange24hHigh, { decimals: price > 100 ? 0 : 2 })}
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

  const [symbol, setSymbol] = useState<Symbol>("BTC");
  const [timeframe, setTimeframe] = useState<Timeframe>("1H");
  const [activeTab, setActiveTab] = useState<BottomTab>("positions");

  const candles = useCandles(symbol, timeframe);

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
        symbol={symbol}
        onSymbolChange={setSymbol}
        vaultId={vaultId}
      />

      {/* ── Main trading grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* LEFT: chart + risk strip */}
        <div className="flex flex-col border-r border-border">
          {/* Candlestick chart */}
          <div className="border-b border-border bg-surface">
            <MarketChart
              symbol={symbol}
              candles={candles}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              height={460}
            />
          </div>

          {/* Risk / compliance strip — always visible beside the chart */}
          <div className="border-b border-border bg-surface px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
                Compliance
              </span>
              <span className="text-xs text-text-faint">click to inspect</span>
            </div>
            <RulePills rules={rules} />
          </div>
        </div>

        {/* RIGHT: order entry */}
        <div className="flex flex-col border-b border-border bg-surface">
          <TradeIntentForm
            vaultId={vaultId}
            symbol={symbol}
            onSymbolChange={setSymbol}
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
