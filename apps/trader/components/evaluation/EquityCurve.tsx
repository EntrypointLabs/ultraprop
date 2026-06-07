"use client";

import type { IChartApi, UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { EquityPoint } from "@/lib/mock/types";

interface EquityCurveProps {
  data: EquityPoint[];
  startingEquity: number;
  peakEquity: number;
  maxDrawdown: number;
  profitTarget: number;
  className?: string;
}

export function EquityCurve({
  data,
  startingEquity,
  peakEquity,
  maxDrawdown,
  profitTarget,
  className,
}: EquityCurveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);

  // Initialise chart once on mount (client-only via dynamic import)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let destroyed = false;
    let ro: ResizeObserver | null = null;

    import("lightweight-charts").then(
      ({ createChart, LineStyle, AreaSeries }) => {
        if (destroyed || !containerRef.current) return;

        const chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height: 240,
          layout: {
            background: { color: "transparent" },
            textColor: "#A1A1AA",
            fontFamily: "var(--font-mono-face), monospace",
            fontSize: 11,
          },
          grid: {
            vertLines: { color: "#2A2A30" },
            horzLines: { color: "#2A2A30" },
          },
          crosshair: {
            vertLine: { color: "#6a6ae0", labelBackgroundColor: "#6a6ae0" },
            horzLine: { color: "#6a6ae0", labelBackgroundColor: "#6a6ae0" },
          },
          rightPriceScale: { borderColor: "#2A2A30", textColor: "#A1A1AA" },
          timeScale: {
            borderColor: "#2A2A30",
            timeVisible: true,
            secondsVisible: false,
          },
          handleScroll: false,
          handleScale: false,
        });

        const series = chart.addSeries(AreaSeries, {
          lineColor: "#6a6ae0",
          topColor: "rgba(109,93,252,0.25)",
          bottomColor: "rgba(109,93,252,0.02)",
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBorderColor: "#6a6ae0",
          crosshairMarkerBackgroundColor: "#0A0A0C",
          priceLineVisible: false,
          lastValueVisible: true,
        });

        chartRef.current = chart;
        seriesRef.current = series;

        // DD floor annotation: peak * (1 - maxDd)
        const ddFloor = peakEquity * (1 - maxDrawdown);
        series.createPriceLine({
          price: ddFloor,
          color: "#F87171",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `DD floor $${ddFloor.toFixed(0)}`,
        });

        // Profit target ceiling: start * (1 + target)
        const targetEquity = startingEquity * (1 + profitTarget);
        series.createPriceLine({
          price: targetEquity,
          color: "#34d399",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `Target $${targetEquity.toFixed(0)}`,
        });

        // Seed initial data
        series.setData(
          data.map((p) => ({
            time: Math.floor(p.ts / 1000) as UTCTimestamp,
            value: p.equity,
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
      seriesRef.current = null;
    };
    // Intentionally run once; live updates via the data effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDrawdown, startingEquity, profitTarget, peakEquity, data.map]);

  // Stream new points as data changes
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || data.length === 0) return;
    const last = data[data.length - 1];
    series.update({
      time: Math.floor(last.ts / 1000) as UTCTimestamp,
      value: last.equity,
    });
  }, [data]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ minHeight: 240 }}
      aria-label="Equity curve chart"
    />
  );
}
