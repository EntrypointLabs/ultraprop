"use client";

import { useEffect, useRef } from "react";
import type { Symbol } from "@/lib/mock/types";
import { PYTH_TV_SYMBOL } from "@/lib/oracle/pyth";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const SCRIPT_SRC =
  "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

interface TradingViewChartProps {
  symbol: Symbol;
  /** TradingView resolution, e.g. "60" (1h), "240" (4h), "D" (1d) */
  interval?: string;
  className?: string;
}

/**
 * Real TradingView Advanced Chart, plotting the same Pyth price feed the
 * evaluation marks fills against (PYTH:BTCUSD / ETHUSD / SOLUSD). The widget is
 * an iframe, so it ignores app CSS; we hand it the theme + surface colors and
 * let it autosize to fill its container. Re-mounts on symbol/theme change.
 */
export function TradingViewChart({
  symbol,
  interval = "60",
  className,
}: TradingViewChartProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.innerHTML =
      '<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';

    const config = {
      autosize: true,
      symbol: PYTH_TV_SYMBOL[symbol],
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
  }, [symbol, interval, resolvedTheme]);

  return (
    <div
      ref={containerRef}
      className={cn("tradingview-widget-container h-full w-full", className)}
      aria-label={`${symbol} / USD TradingView chart`}
    />
  );
}
