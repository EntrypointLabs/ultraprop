"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { TVChart } from "@/components/charts/TVChart";
import { AssetIcon, Badge, Button } from "@/components/ui";
import { SEED_NOW } from "@/lib/mock/fixtures";
import { usePrice } from "@/lib/mock/hooks";
import { getMarket } from "@/lib/mock/markets";
import type { MarketId } from "@/lib/mock/types";
import { cn, formatPctOrDash, formatUsdOrDash } from "@/lib/utils";

interface AssetSpotlightProps {
  symbol: MarketId;
}

/** Marketing copy per market — display-only, falls back to a generic line. */
const ASSET_DESC: Record<string, string> = {
  BTC: "The benchmark. BTC/USD is the most-traded pair in the evaluation universe.",
  ETH: "Deep liquidity, distinct from BTC. ETH/USD provides macro-uncorrelated setups.",
  SOL: "Higher volatility, tighter spreads. SOL/USD rewards precise risk management.",
};

export function AssetSpotlight({ symbol }: AssetSpotlightProps) {
  const tick = usePrice(symbol);
  const market = getMarket(symbol);
  const meta = {
    name: market?.name ?? symbol,
    leverage: market?.maxLeverage ?? 10,
    desc: ASSET_DESC[symbol] ?? `${market?.name ?? symbol} / USD spot market.`,
  };

  const sparkData = tick?.spark ?? [];
  const now = SEED_NOW;
  const interval = Math.floor(
    (4 * 60 * 60 * 1000) / Math.max(sparkData.length - 1, 1),
  );

  const chartSeries =
    sparkData.length > 1
      ? [
          {
            data: sparkData.map((v, i) => ({
              t: now - (sparkData.length - 1 - i) * interval,
              v,
            })),
            type: "area" as const,
            color: "#e5484d",
            topColor: "rgba(229,72,77,0.25)",
            bottomColor: "rgba(229,72,77,0.01)",
            lineWidth: 2 as 1 | 2 | 3,
          },
        ]
      : [];

  const price = tick?.price ?? null;
  const change = tick?.change24h ?? null;
  const isUp = (change ?? 0) >= 0;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-widest text-text-muted">
            Live market
          </div>
          <div className="flex items-center gap-2">
            <AssetIcon symbol={symbol} size={28} />
            <h2 className="text-xl font-bold tracking-tight text-text">
              {symbol} / USD
            </h2>
            <Badge variant="leverage" className="tabular">
              {meta.leverage}X
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-text-muted">{meta.desc}</p>
        </div>

        <div className="shrink-0 text-right">
          <div className="tabular text-2xl font-bold text-text">
            {formatUsdOrDash(price, {
              decimals:
                price == null ? 2 : price > 10_000 ? 0 : price > 100 ? 2 : 4,
            })}
          </div>
          <div
            className={cn(
              "tabular mt-0.5 text-sm font-medium",
              change == null
                ? "text-text-faint"
                : isUp
                  ? "text-up"
                  : "text-down",
            )}
          >
            {formatPctOrDash(change, { sign: true })} 24h
          </div>
        </div>
      </div>

      {chartSeries.length > 0 ? (
        <div className="flex-1 min-h-0 rounded-[var(--radius)] overflow-hidden border border-border bg-surface-2">
          <TVChart
            series={chartSeries}
            height={"full"}
            watermark={`${symbol} / USD`}
            showTimeScale={true}
            showPriceScale={true}
            interactive={false}
            precision={(price ?? 0) > 10_000 ? 0 : 2}
          />
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 items-center justify-center rounded-[var(--radius)] border border-border bg-surface-2 text-xs text-text-faint">
          Awaiting live market feed…
        </div>
      )}

      <div className="mt-auto flex items-center gap-2">
        <Link href={`/start?symbol=${symbol}&side=long`} className="flex-1">
          <Button variant="long" size="md" className="w-full gap-1.5">
            Long {symbol}
          </Button>
        </Link>
        <Link href={`/start?symbol=${symbol}&side=short`} className="flex-1">
          <Button variant="short" size="md" className="w-full gap-1.5">
            Short {symbol}
          </Button>
        </Link>
        <Link href="/start">
          <Button variant="ghost" size="icon" aria-label="Start evaluation">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
