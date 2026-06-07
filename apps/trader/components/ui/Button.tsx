import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] font-medium transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-violet focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-violet text-white hover:bg-violet-hover",
        brand: "bg-violet text-white hover:bg-violet-hover",
        ghost:
          "bg-transparent text-text-muted hover:bg-surface-2 hover:text-text",
        outline:
          "border border-border bg-transparent text-text hover:bg-surface-2",
        long: "bg-up/15 text-up border border-up/30 hover:bg-up/25",
        short: "bg-down/15 text-down border border-down/30 hover:bg-down/25",
        danger: "bg-down text-white hover:brightness-110",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
