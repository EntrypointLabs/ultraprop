import type * as React from "react";
import { cn } from "@/lib/utils";

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  /** optional delta line, color it via deltaTone */
  delta?: React.ReactNode;
  deltaTone?: "up" | "down" | "muted";
}

export function StatTile({
  label,
  value,
  delta,
  deltaTone = "muted",
  className,
  ...props
}: StatTileProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-border-soft bg-surface px-5 py-4",
        className,
      )}
      {...props}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </div>
      <div className="tabular mt-1.5 text-xl font-semibold text-text">
        {value}
      </div>
      {delta != null && (
        <div
          className={cn(
            "tabular mt-0.5 text-xs",
            deltaTone === "up" && "text-up",
            deltaTone === "down" && "text-down",
            deltaTone === "muted" && "text-text-muted",
          )}
        >
          {delta}
        </div>
      )}
    </div>
  );
}
