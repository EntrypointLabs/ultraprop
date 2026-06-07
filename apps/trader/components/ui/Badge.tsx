import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium leading-none",
  {
    variants: {
      variant: {
        default: "bg-surface-3 text-text-muted",
        leverage: "tabular bg-surface-3 text-text-muted font-semibold",
        genesis: "bg-warn/15 text-warn uppercase tracking-wide",
        pending: "bg-warn/15 text-warn uppercase tracking-wide",
        tier: "bg-violet/15 text-violet uppercase tracking-wide",
        up: "bg-up/15 text-up",
        down: "bg-down/15 text-down",
        info: "bg-info/15 text-info",
        outline: "border border-border text-text-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
