import type * as React from "react";
import { cn } from "@/lib/utils";

export interface PixelBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  height?: number;
}

/**
 * The lime pixel block used in the onboarding modal. Uses the `.pixel-banner`
 * checkerboard background defined in globals.css.
 */
export function PixelBanner({
  height = 96,
  className,
  children,
  ...props
}: PixelBannerProps) {
  return (
    <div
      className={cn(
        "pixel-banner flex items-center justify-center rounded-[var(--radius)] text-brand-ink",
        className,
      )}
      style={{ height }}
      {...props}
    >
      {children}
    </div>
  );
}
