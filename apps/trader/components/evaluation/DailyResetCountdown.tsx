"use client";

import { Countdown } from "@/components/ui";
import { cn } from "@/lib/utils";

interface DailyResetCountdownProps {
  resetAt: number;
  className?: string;
}

export function DailyResetCountdown({
  resetAt,
  className,
}: DailyResetCountdownProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs text-text-muted",
        className,
      )}
    >
      <span>Daily reset in</span>
      <Countdown
        target={resetAt}
        format="hms"
        className="font-semibold text-text"
      />
    </div>
  );
}
