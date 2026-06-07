import type * as React from "react";
import { cn } from "@/lib/utils";

export type PillZone = "safe" | "warn" | "danger";

export interface PillProps extends React.HTMLAttributes<HTMLButtonElement> {
  label: string;
  /** value text shown on the right, e.g. remaining budget */
  value: React.ReactNode;
  zone: PillZone;
  /** 0..1 fraction of the track to fill */
  progress: number;
  as?: "button" | "div";
}

const zoneText: Record<PillZone, string> = {
  safe: "text-up",
  warn: "text-warn",
  danger: "text-down",
};

const zoneFill: Record<PillZone, string> = {
  safe: "bg-up",
  warn: "bg-warn",
  danger: "bg-down",
};

export function Pill({
  label,
  value,
  zone,
  progress,
  className,
  as = "button",
  ...props
}: PillProps) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {label}
        </span>
        <span className={cn("tabular text-sm font-semibold", zoneText[zone])}>
          {value}
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            zoneFill[zone],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </>
  );

  const base =
    "block w-full rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-left transition-colors duration-150";

  if (as === "div") {
    return (
      <div
        className={cn(base, className)}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      >
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={cn(base, "hover:bg-surface-2", className)}
      {...props}
    >
      {content}
    </button>
  );
}
