"use client";

import { useEffect, useRef } from "react";
import { getMarket } from "@/lib/mock/markets";
import type { MarketId } from "@/lib/mock/types";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const SCRIPT_SRC =
  "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

interface TradingViewChartProps {
  marketId: MarketId;
  /** TradingView resolution, e.g. "60" (1h), "240" (4h), "D" (1d) */
  interval?: string;
  className?: string;
}

/**
 * Real TradingView Advanced Chart, plotting the same Pyth price feed the
 * evaluation marks fills against (PYTH:BTCUSD / ETHUSD / SOLUSD). The widget is
 * an iframe, so it ignores app CSS; we hand it the theme + surface colors and
 * let it autosize to fill its container. Re-mounts on market/theme change.
 */
export function TradingViewChart({
  marketId,
  interval = "60",
  className,
}: TradingViewChartProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const market = getMarket(marketId);
  const tvSymbol = market?.pythTvSymbol;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !tvSymbol) return;

    el.innerHTML =
      '<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';

    const config = {
      autosize: true,
      symbol: tvSymbol,
      interval,
      timezone: "Etc/UTC",
      theme: resolvedTheme,
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      withdateranges: true,
      backgroundColor: resolvedTheme === "dark" ? "#16161a" : "#ffffff",
      gridColor:
        resolvedTheme === "dark"
          ? "rgba(255,255,255,0.05)"
          : "rgba(0,0,0,0.05)",
      support_host: "https://www.tradingview.com",
    };

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify(config);
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [tvSymbol, interval, resolvedTheme]);

  return (
    <div
      ref={containerRef}
      className={cn("tradingview-widget-container h-full w-full", className)}
      aria-label={`${market?.symbol ?? marketId} / USD TradingView chart`}
    />
  );
}
