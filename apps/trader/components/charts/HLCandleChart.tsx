"use client";

import type {
  CandlestickData,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { getChartColors } from "@/lib/chart-colors";
import { coinOf, getMarket } from "@/lib/mock/markets";
import type { MarketId } from "@/lib/mock/types";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** A single OHLCV bar as returned by our /api/candles route. */
interface Candle {
  t: number;
  T: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Fetch candle history from OUR /api/candles route (which calls Hyperliquid
 * server-side), never the browser → HL directly. `coin` is the bare ticker.
 */
async function fetchCandles(
  coin: string,
  interval: string,
  startMs: number,
  endMs: number,
  signal?: AbortSignal,
): Promise<Candle[]> {
  const params = new URLSearchParams({
    coin,
    interval,
    start: String(startMs),
    end: String(endMs),
  });
  const res = await fetch(`/api/candles?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`/api/candles ${res.status}`);
  return (await res.json()) as Candle[];
}

export interface HLCandleChartProps {
  marketId: MarketId;
  /** HL candle interval, e.g. "1h", "4h", "1d" */
  interval?: string;
  className?: string;
}

const HISTORY_MS = 7 * 24 * 60 * 60 * 1000;
/** How often to poll /api/candles for the latest (in-progress) bar. */
const LIVE_POLL_MS = 5_000;

const toCandlestick = (c: Candle): CandlestickData => ({
  time: Math.floor(c.t / 1000) as UTCTimestamp,
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
});

/**
 * Live candlestick chart fed via OUR `/api/candles` route — the browser never
 * touches Hyperliquid directly (indexer-fronted). Lightweight Charts v5, the
 * same terminal styling as `TVChart`: faint grid, magnet crosshair with axis
 * labels, a faint corner watermark, theme-tracking colors. On mount or market
 * change it loads ~7 days of 1h candles, then POLLS `/api/candles` every few
 * seconds for the latest bar and updates the in-progress bar in place (no
 * browser WebSocket to the venue). SSR-safe — `lightweight-charts` needs the
 * browser, so the cockpit dynamic-imports this with `ssr:false`.
 */
export function HLCandleChart({
  marketId,
  interval = "1h",
  className,
}: HLCandleChartProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const colorsRef = useRef(getChartColors(resolvedTheme));
  colorsRef.current = getChartColors(resolvedTheme);

  // Create the chart once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let destroyed = false;
    let ro: ResizeObserver | null = null;

    import("lightweight-charts").then(
      ({ createChart, CandlestickSeries, CrosshairMode }) => {
        if (destroyed || !containerRef.current) return;
        const c = colorsRef.current;

        const chart = createChart(containerRef.current, {
          autoSize: true,
          layout: {
            background: { color: "transparent" },
            textColor: c.text,
            fontFamily: "var(--font-mono-face), ui-monospace, monospace",
            fontSize: 11,
            attributionLogo: false,
          },
          grid: {
            vertLines: { color: c.grid },
            horzLines: { color: c.grid },
          },
          crosshair: {
            mode: CrosshairMode.Magnet,
            vertLine: {
              color: c.crosshair,
              width: 1,
              style: 3,
              labelBackgroundColor: c.accent,
            },
            horzLine: {
              color: c.crosshair,
              width: 1,
              style: 3,
              labelBackgroundColor: c.accent,
            },
          },
          rightPriceScale: {
            borderColor: c.axis,
            scaleMargins: { top: 0.12, bottom: 0.12 },
          },
          timeScale: {
            borderColor: c.axis,
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 4,
          },
          localization: {
            priceFormatter: (n: number) =>
              n >= 1000
                ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                : `$${n.toFixed(n >= 1 ? 2 : 5)}`,
          },
          handleScroll: true,
          handleScale: true,
        });

        chartRef.current = chart;
        seriesRef.current = chart.addSeries(CandlestickSeries, {
          upColor: c.up,
          downColor: c.down,
          wickUpColor: c.up,
          wickDownColor: c.down,
          borderVisible: false,
        });

        ro = new ResizeObserver(() => {
          if (containerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width: containerRef.current.clientWidth,
            });
          }
        });
        ro.observe(containerRef.current);
      },
    );

    return () => {
      destroyed = true;
      ro?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Load history, then poll /api/candles for the latest bar — on mount and
  // whenever the market or interval changes. The `coin` is the bare HL ticker
  // (incl. "kPEPE"). No browser WebSocket to the venue: live updates are polled
  // through our own route so the FE stays indexer-fronted.
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const coin = coinOf(marketId);

    const pollLatest = async () => {
      if (cancelled) return;
      const now = Date.now();
      try {
        // A short tail window keeps the in-progress + just-closed bars fresh.
        const recent = await fetchCandles(
          coin,
          interval,
          now - 4 * 60 * 60 * 1000,
          now,
        );
        if (cancelled) return;
        for (const bar of recent) seriesRef.current?.update(toCandlestick(bar));
      } catch {
        // transient poll failure — the next tick refreshes the bar
      }
    };

    const start = async () => {
      // Wait for the create-once effect to attach the series.
      let tries = 0;
      while (!seriesRef.current && tries < 50 && !cancelled) {
        await new Promise((r) => setTimeout(r, 20));
        tries += 1;
      }
      const series = seriesRef.current;
      if (!series || cancelled) return;

      const now = Date.now();
      try {
        const candles = await fetchCandles(
          coin,
          interval,
          now - HISTORY_MS,
          now,
        );
        if (cancelled) return;
        series.setData(candles.map(toCandlestick));
        chartRef.current?.timeScale().fitContent();
      } catch {
        // history fetch failed — the live poll still backfills as bars arrive
      }
      if (cancelled) return;

      pollTimer = setInterval(pollLatest, LIVE_POLL_MS);
    };

    start();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [marketId, interval]);

  // Recolor on theme change without remounting.
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart) return;
    const c = getChartColors(resolvedTheme);
    chart.applyOptions({
      layout: { textColor: c.text },
      grid: {
        vertLines: { color: c.grid },
        horzLines: { color: c.grid },
      },
      crosshair: {
        vertLine: { color: c.crosshair, labelBackgroundColor: c.accent },
        horzLine: { color: c.crosshair, labelBackgroundColor: c.accent },
      },
      rightPriceScale: { borderColor: c.axis },
      timeScale: { borderColor: c.axis },
    });
    series?.applyOptions({
      upColor: c.up,
      downColor: c.down,
      wickUpColor: c.up,
      wickDownColor: c.down,
    });
  }, [resolvedTheme]);

  const market = getMarket(marketId);

  return (
    <div className={cn("relative h-full w-full", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-2 z-10 select-none font-mono text-xs font-semibold uppercase tracking-[0.2em] text-text-faint/50"
      >
        {market?.symbol ?? marketId} / USD
      </span>
      <div
        ref={containerRef}
        className="h-full w-full"
        aria-label={`${market?.symbol ?? marketId} / USD candlestick chart`}
      />
    </div>
  );
}
