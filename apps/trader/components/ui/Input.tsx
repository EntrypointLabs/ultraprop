import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** render numerics in the mono tabular face */
  mono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, mono, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-[var(--radius)] border border-border bg-surface-2 px-3 text-sm text-text placeholder:text-text-faint transition-colors focus-visible:border-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 disabled:opacity-50",
        mono && "tabular",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
