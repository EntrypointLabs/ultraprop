"use client";

import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { Candle, Timeframe } from "@/lib/mock/candles";
import { TIMEFRAMES } from "@/lib/mock/candles";
import { cn } from "@/lib/utils";

interface MarketChartProps {
  symbol: string;
  candles: Candle[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  height?: number;
  className?: string;
}

const GRID = "#1c1c22";
const AXIS = "#2a2a30";
const TEXT = "#6b6b73";
const ACCENT = "#e5484d";
const UP = "#34d399";
const DOWN = "#f87171";
const UP_VOL = "rgba(52,211,153,0.4)";
const DOWN_VOL = "rgba(248,113,113,0.4)";

const toTime = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;

export function MarketChart({
  symbol,
  candles,
  timeframe,
  onTimeframeChange,
  height = 460,
  className,
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Keep latest data in a ref so the create-once effect can access it.
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  // Create chart once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined") return;
    let destroyed = false;
    let ro: ResizeObserver | null = null;

    import("lightweight-charts").then(
      ({ createChart, CandlestickSeries, HistogramSeries, CrosshairMode }) => {
        if (destroyed || !containerRef.current) return;

        const chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height,
          autoSize: false,
          layout: {
            background: { color: "transparent" },
            textColor: TEXT,
            fontFamily: "var(--font-mono-face), ui-monospace, monospace",
            fontSize: 11,
            attributionLogo: false,
          },
          grid: {
            vertLines: { color: GRID },
            horzLines: { color: GRID },
          },
          crosshair: {
            mode: CrosshairMode.Magnet,
            vertLine: {
              color: "#3a3a44",
              width: 1,
              style: 3,
              labelBackgroundColor: ACCENT,
            },
            horzLine: {
              color: "#3a3a44",
              width: 1,
              style: 3,
              labelBackgroundColor: ACCENT,
            },
          },
          rightPriceScale: {
            visible: true,
            borderColor: AXIS,
            scaleMargins: { top: 0.08, bottom: 0.22 },
          },
          timeScale: {
            visible: true,
            borderColor: AXIS,
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 4,
          },
          handleScroll: true,
          handleScale: true,
        });

        chartRef.current = chart;

        // Candlestick series.
        const cs = chart.addSeries(CandlestickSeries, {
          upColor: UP,
          downColor: DOWN,
          borderUpColor: UP,
          borderDownColor: DOWN,
          wickUpColor: UP,
          wickDownColor: DOWN,
          priceLineVisible: true,
          priceLineStyle: 2,
          priceLineColor: ACCENT,
          lastValueVisible: true,
        });

        // Volume histogram pinned to bottom of the pane.
        const vs = chart.addSeries(HistogramSeries, {
          priceScaleId: "vol",
          priceFormat: { type: "volume" },
          lastValueVisible: false,
          priceLineVisible: false,
        });
        chart.priceScale("vol").applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });

        candleSeriesRef.current = cs;
        volSeriesRef.current = vs;

        // Seed initial data.
        const data = candlesRef.current;
        cs.setData(
          data.map((c) => ({
            time: toTime(c.t),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          })),
        );
        vs.setData(
          data.map((c) => ({
            time: toTime(c.t),
            value: c.volume,
            color: c.close >= c.open ? UP_VOL : DOWN_VOL,
          })),
        );

        chart.timeScale().fitContent();

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
      candleSeriesRef.current = null;
      volSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-update last candle whenever data changes.
  useEffect(() => {
    const cs = candleSeriesRef.current;
    const vs = volSeriesRef.current;
    if (!cs || !vs || candles.length === 0) return;
    const last = candles[candles.length - 1];
    cs.update({
      time: toTime(last.t),
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    });
    vs.update({
      time: toTime(last.t),
      value: last.volume,
      color: last.close >= last.open ? UP_VOL : DOWN_VOL,
    });
  }, [candles]);

  // Rebuild chart data when timeframe changes (the candles array is a new ref).
  const prevTfRef = useRef(timeframe);
  useEffect(() => {
    if (prevTfRef.current === timeframe) return;
    prevTfRef.current = timeframe;
    const cs = candleSeriesRef.current;
    const vs = volSeriesRef.current;
    if (!cs || !vs || candles.length === 0) return;
    cs.setData(
      candles.map((c) => ({
        time: toTime(c.t),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    vs.setData(
      candles.map((c) => ({
        time: toTime(c.t),
        value: c.volume,
        color: c.close >= c.open ? UP_VOL : DOWN_VOL,
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [timeframe, candles]);

  return (
    <div className={cn("relative flex flex-col", className)}>
      {/* Timeframe pill row + watermark */}
      <div className="flex items-center justify-between px-3 py-2">
        <span
          aria-hidden
          className="select-none font-mono text-xs font-semibold uppercase tracking-[0.2em] text-text-faint/50"
        >
          {symbol} / USD
        </span>
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onTimeframeChange(tf)}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium tabular transition-colors",
                tf === timeframe
                  ? "bg-surface-3 text-text"
                  : "text-text-faint hover:bg-surface-2 hover:text-text-muted",
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} style={{ height }} aria-label="Candlestick chart" />
    </div>
  );
}
