"use client";

import { TVChart } from "@/components/charts/TVChart";
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
  const ddFloor = peakEquity * (1 - maxDrawdown);
  const target = startingEquity * (1 + profitTarget);

  return (
    <TVChart
      series={[{ data: data.map((p) => ({ t: p.ts, v: p.equity })), type: "area" }]}
      priceLines={[
        { price: ddFloor, color: "#f87171", title: `DD floor $${ddFloor.toFixed(0)}` },
        { price: target, color: "#34d399", title: `Target $${target.toFixed(0)}` },
      ]}
      watermark="Equity"
      height={240}
      precision={2}
      showTimeScale
      showPriceScale
      className={className}
    />
  );
}
