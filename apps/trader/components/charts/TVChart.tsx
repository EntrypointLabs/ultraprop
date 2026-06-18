"use client";

import type {
  IChartApi,
  IPriceLine,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { getChartColors } from "@/lib/chart-colors";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export interface TVPoint {
  /** epoch ms */
  t: number;
  v: number;
}

export interface TVSeriesSpec {
  data: TVPoint[];
  type?: "area" | "line";
  /** line / area stroke color */
  color?: string;
  /** area gradient top (defaults derive from color) */
  topColor?: string;
  bottomColor?: string;
  lineWidth?: 1 | 2 | 3;
}

export interface TVPriceLineSpec {
  price: number;
  color: string;
  title: string;
}

export interface TVChartProps {
  series: TVSeriesSpec[];
  priceLines?: TVPriceLineSpec[];
  height?: number | "full";
  /** faint background watermark, TradingView-style (e.g. "BTC / USD") */
  watermark?: string;
  showTimeScale?: boolean;
  showPriceScale?: boolean;
  /** allow scroll/zoom (off by default for compact cards) */
  interactive?: boolean;
  /** price decimal places */
  precision?: number;
  className?: string;
}

const toTime = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;

/**
 * TradingView-style chart (Lightweight Charts v5). Used for the equity curve
 * and the home spotlight price charts so they read like a real terminal: faint
 * grid, magnet crosshair with axis labels, last-value price tag, a soft area
 * gradient, and a faint corner watermark. Colors track the active theme.
 */
export function TVChart({
  series,
  priceLines,
  height = 240,
  watermark,
  showTimeScale = true,
  showPriceScale = true,
  interactive = false,
  precision = 2,
  className,
}: TVChartProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area" | "Line">[]>([]);
  const priceLineRef = useRef<IPriceLine[]>([]);
  // latest colors for the create-once effect (first render correct)
  const colorsRef = useRef(getChartColors(resolvedTheme));
  colorsRef.current = getChartColors(resolvedTheme);
  // latest props for the create-once effect
  const propsRef = useRef({
    series,
    priceLines,
    height,
    showTimeScale,
    showPriceScale,
    interactive,
    precision,
  });
  propsRef.current = {
    series,
    priceLines,
    height,
    showTimeScale,
    showPriceScale,
    interactive,
    precision,
  };

  // Create once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let destroyed = false;
    let ro: ResizeObserver | null = null;

    import("lightweight-charts").then(
      ({ createChart, AreaSeries, LineSeries, CrosshairMode }) => {
        if (destroyed || !containerRef.current) return;
        const p = propsRef.current;
        const c = colorsRef.current;

        const chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height: isNaN(Number(p.height)) ? 0 : Number(p.height),
          autoSize: p.height === "full",
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
            visible: p.showPriceScale,
            borderColor: c.axis,
            scaleMargins: { top: 0.12, bottom: 0.12 },
          },
          timeScale: {
            visible: p.showTimeScale,
            borderColor: c.axis,
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 4,
          },
          localization: {
            priceFormatter: (n: number) =>
              n >= 1000
                ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                : `$${n.toFixed(p.precision)}`,
          },
          handleScroll: p.interactive,
          handleScale: p.interactive,
        });

        chartRef.current = chart;
        seriesRef.current = p.series.map((s) => {
          const color = s.color ?? c.accent;
          if (s.type === "line") {
            const ls = chart.addSeries(LineSeries, {
              color,
              lineWidth: s.lineWidth ?? 2,
              priceLineVisible: false,
              lastValueVisible: true,
              crosshairMarkerVisible: true,
              crosshairMarkerRadius: 3,
            });
            ls.setData(s.data.map((d) => ({ time: toTime(d.t), value: d.v })));
            return ls;
          }
          const as = chart.addSeries(AreaSeries, {
            lineColor: color,
            topColor: s.topColor ?? c.gradientFrom,
            bottomColor: s.bottomColor ?? c.gradientTo,
            lineWidth: s.lineWidth ?? 2,
            priceLineVisible: true,
            priceLineStyle: 2,
            priceLineColor: color,
            lastValueVisible: true,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            crosshairMarkerBorderColor: color,
            crosshairMarkerBackgroundColor: c.markerBg,
          });
          as.setData(s.data.map((d) => ({ time: toTime(d.t), value: d.v })));
          return as;
        });

        if (p.priceLines && seriesRef.current[0]) {
          priceLineRef.current = p.priceLines.map((pl) =>
            seriesRef.current[0].createPriceLine({
              price: pl.price,
              color: pl.color,
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: pl.title,
            }),
          );
        }

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
      seriesRef.current = [];
      priceLineRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recolor an on-screen chart when the theme changes (no remount).
  useEffect(() => {
    const chart = chartRef.current;
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
    series.forEach((s, i) => {
      const api = seriesRef.current[i];
      if (!api) return;
      const color = s.color ?? c.accent;
      if (s.type === "line") {
        api.applyOptions({ color });
        return;
      }
      api.applyOptions({
        lineColor: color,
        topColor: s.topColor ?? c.gradientFrom,
        bottomColor: s.bottomColor ?? c.gradientTo,
        priceLineColor: color,
        crosshairMarkerBorderColor: color,
        crosshairMarkerBackgroundColor: c.markerBg,
      });
    });
    // series colors are reapplied here; the create-once effect owns initial setup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);

  // Stream the latest point of each series.
  useEffect(() => {
    series.forEach((s, i) => {
      const api = seriesRef.current[i];
      if (!api || s.data.length === 0) return;
      const last = s.data[s.data.length - 1];
      api.update({ time: toTime(last.t), value: last.v });
    });
  }, [series]);

  // Keep price lines (DD floor / target) in sync as peak/target shift.
  useEffect(() => {
    const s0 = seriesRef.current[0];
    if (!s0 || !priceLines) return;
    priceLineRef.current.forEach((pl) => s0.removePriceLine(pl));
    priceLineRef.current = priceLines.map((pl) =>
      s0.createPriceLine({
        price: pl.price,
        color: pl.color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: pl.title,
      }),
    );
  }, [priceLines]);

  return (
    <div className={cn("relative h-full", className)} style={{ minHeight: height === "full" ? "100%" : height }}>
      {watermark && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-2 z-10 select-none font-mono text-xs font-semibold uppercase tracking-[0.2em] text-text-faint/50"
        >
          {watermark}
        </span>
      )}
      <div ref={containerRef} style={{ height: height === "full" ? "100%" : height }} aria-label="Price chart" />
    </div>
  );
}
