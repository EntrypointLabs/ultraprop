"use client";

import { RadialGauge } from "@/components/ui";
import { formatPct } from "@/lib/utils";

interface DrawdownGaugeProps {
  /** current drawdown in USD from peak */
  currentDd: number;
  /** max drawdown limit in USD */
  maxDd: number;
  /** current DD as % of max DD, 0..1 */
  fraction: number;
  className?: string;
}

export function DrawdownGauge({
  currentDd,
  maxDd,
  fraction,
  className,
}: DrawdownGaugeProps) {
  const pct = fraction * 100;

  return (
    <div className={className}>
      <RadialGauge
        value={fraction}
        size={120}
        strokeWidth={10}
        label={formatPct(pct, { sign: false, decimals: 1 })}
        sublabel="of max DD"
      />
    </div>
  );
}
