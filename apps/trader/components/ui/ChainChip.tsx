import type * as React from "react";
import { cn } from "@/lib/utils";

export interface ChainChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  chain?: "sui";
  showLabel?: boolean;
}

export function ChainChip({
  chain = "sui",
  showLabel = true,
  className,
  ...props
}: ChainChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-text-muted",
        className,
      )}
      {...props}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M12 2C8 6 5 9 5 13a7 7 0 0014 0c0-4-3-7-7-11z"
          fill="var(--color-info)"
        />
      </svg>
      {showLabel && <span className="uppercase tracking-wide">{chain}</span>}
    </span>
  );
}
