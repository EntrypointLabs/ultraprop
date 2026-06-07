import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative inline-flex w-full">
      <select
        ref={ref}
        className={cn(
          "h-9 w-full appearance-none rounded-[var(--radius)] border border-border bg-surface-2 pl-3 pr-8 text-sm text-text transition-colors focus-visible:border-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
    </div>
  ),
);
Select.displayName = "Select";
