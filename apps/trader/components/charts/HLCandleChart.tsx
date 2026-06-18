"use client";

import type {
  CandlestickData,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getChartColors } from "@/lib/chart-colors";
import { coinOf, getMarket } from "@/lib/mock/markets";
import type { MarketId } from "@/lib/mock/types";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** A single OHLCV bar as returned by our /api/candles route. */
export interface Candle {
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
  /**
   * Fired with the loaded history whenever it (re)loads. The cockpit uses this
   * to derive the selected market's trailing-24h high/low from data the chart
   * already fetched — HL's per-coin mark feed carries no 24h range, so reusing
   * these candles avoids a second per-market request.
   */
  onHistory?: (candles: Candle[]) => void;
}

/** Chart data lifecycle, drives the loading / error / empty overlays. */
type ChartStatus = "loading" | "ready" | "empty" | "error";

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
 * labels, theme-tracking colors. On mount or market change it loads ~7 days of
 * 1h candles, then POLLS `/api/candles` every few seconds for the latest bar
 * and updates the in-progress bar in place (no browser WebSocket to the venue).
 * SSR-safe — `lightweight-charts` needs the browser, so the cockpit
 * dynamic-imports this with `ssr:false`.
 *
 * Sizing is `autoSize: true` ONLY — Lightweight Charts owns its own
 * ResizeObserver, so a second manual `applyOptions({ width })` observer would
 * fight it and spam the "turn autoSize off" warning every frame. One strategy.
 *
 * When history fails or comes back empty (gateway/HL down), the chart surfaces
 * an explicit overlay with a retry instead of leaving a silent blank canvas.
 */
export function HLCandleChart({
  marketId,
  interval = "1h",
  className,
  onHistory,
}: HLCandleChartProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const colorsRef = useRef(getChartColors(resolvedTheme));
  colorsRef.current = getChartColors(resolvedTheme);

  const [status, setStatus] = useState<ChartStatus>("loading");
  // Bumping this re-runs the data effect to retry after a failed history load.
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }, []);

  // Create the chart once. autoSize handles resizes natively (no manual RO).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let destroyed = false;

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
      },
    );

    return () => {
      destroyed = true;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Load history, then poll /api/candles for the latest bar — on mount and
  // whenever the market or interval changes (or a retry). The `coin` is the
  // bare HL ticker (incl. "kPEPE"). No browser WebSocket to the venue: live
  // updates are polled through our own route so the FE stays indexer-fronted.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is intentionally a dep — the retry button bumps it to re-run this effect; it's not read in the body, so Biome reads it as redundant.
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
        if (candles.length === 0) {
          setStatus("empty");
          onHistory?.([]);
          return;
        }
        series.setData(candles.map(toCandlestick));
        chartRef.current?.timeScale().fitContent();
        setStatus("ready");
        onHistory?.(candles);
      } catch {
        // The history fetch failed (gateway/HL down). Surface it instead of
        // leaving a silent blank canvas; the user can retry.
        if (!cancelled) setStatus("error");
        return;
      }
      if (cancelled) return;

      pollTimer = setInterval(pollLatest, LIVE_POLL_MS);
    };

    start();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [marketId, interval, reloadKey, onHistory]);

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
  const pairLabel = `${market?.symbol ?? marketId} / USD`;

  return (
    <div className={cn("relative h-full w-full", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-2 z-10 select-none font-mono text-xs font-semibold uppercase tracking-[0.2em] text-text-faint/50"
      >
        {pairLabel}
      </span>
      <div
        ref={containerRef}
        role="img"
        className="h-full w-full"
        aria-label={`${pairLabel} candlestick chart`}
      />

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 text-text-faint">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="text-xs">Loading {pairLabel} chart…</span>
        </div>
      )}

      {(status === "error" || status === "empty") && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-surface/80 text-center backdrop-blur-sm">
          <AlertTriangle
            className="h-6 w-6 text-text-faint"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-muted">
              {status === "empty"
                ? "No chart data for this market"
                : "Chart data unavailable"}
            </p>
            <p className="text-xs text-text-faint">
              {status === "empty"
                ? "The venue returned no candles for this pair."
                : "Couldn’t reach the market data feed."}
            </p>
          </div>
          <button
            type="button"
            onClick={retry}
            className="rounded-(--radius-sm) border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
