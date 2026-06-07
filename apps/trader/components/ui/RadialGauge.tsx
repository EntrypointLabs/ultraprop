import type * as React from "react";
import { cn } from "@/lib/utils";

export interface RadialGaugeProps {
  /** 0..1 fraction filled (e.g. current DD as % of max DD) */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  /** color ramps by proximity to the limit unless overridden */
  tone?: "safe" | "warn" | "danger";
}

export function RadialGauge({
  value,
  size = 120,
  strokeWidth = 10,
  className,
  label,
  sublabel,
  tone,
}: RadialGaugeProps) {
  const v = Math.max(0, Math.min(1, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - v);

  const resolvedTone =
    tone ?? (v >= 0.9 ? "danger" : v >= 0.7 ? "warn" : "safe");
  const color =
    resolvedTone === "danger"
      ? "var(--color-down)"
      : resolvedTone === "warn"
        ? "var(--color-warn)"
        : "var(--color-up)";

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-3)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label != null && (
          <span className="tabular text-xl font-semibold text-text">
            {label}
          </span>
        )}
        {sublabel != null && (
          <span className="text-xs text-text-muted">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
