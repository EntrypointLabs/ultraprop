"use client";

import { useEffect, useState } from "react";
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
  // Count down to the next 00:00 UTC, computed on the client so it stays live
  // regardless of the seeded fixture timestamp (which is in the past).
  const [target, setTarget] = useState(resetAt);
  useEffect(() => {
    const now = new Date();
    setTarget(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      ),
    );
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col items-end text-xs text-text-muted",
        className,
      )}
    >
      <span>Daily reset in</span>
      <Countdown
        target={target}
        format="hms"
        className="font-semibold text-text"
      />
    </div>
  );
}
