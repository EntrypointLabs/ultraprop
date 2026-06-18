import { cn } from "@/lib/utils";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  /** override the auto up/down color; defaults to up if last >= first */
  tone?: "up" | "down" | "neutral";
  strokeWidth?: number;
  /** fill the area under the line */
  fill?: boolean;
}

export function Sparkline({
  data,
  width = 96,
  height = 28,
  className,
  tone,
  strokeWidth = 1.5,
  fill = false,
}: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden />
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y =
      height - ((v - min) / range) * (height - strokeWidth * 2) - strokeWidth;
    return [x, y] as const;
  });

  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  const resolvedTone =
    tone ?? (data[data.length - 1] >= data[0] ? "up" : "down");
  const color =
    resolvedTone === "up"
      ? "var(--color-up)"
      : resolvedTone === "down"
        ? "var(--color-down)"
        : "var(--color-text-muted)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      {fill && <path d={area} fill={color} fillOpacity={0.12} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
