"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CountdownProps {
  /** target epoch ms to count down to */
  target: number;
  /** label format: "hms" => 2h 14m 03s, "compact" => 02:14:03 */
  format?: "hms" | "compact";
  className?: string;
  onComplete?: () => void;
}

function fmt(ms: number, format: "hms" | "compact"): string {
  const clamped = Math.max(0, ms);
  const total = Math.floor(clamped / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (format === "compact") {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  if (h > 0) return `${h}h ${m}m ${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function Countdown({
  target,
  format = "hms",
  className,
  onComplete,
}: CountdownProps) {
  // Initial value is rendered identically on server and first client paint by
  // anchoring to `target` without reading the clock during render.
  const [remaining, setRemaining] = React.useState(() =>
    Math.max(0, target - target),
  );
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    firedRef.current = false;
    const update = () => {
      const r = target - Date.now();
      setRemaining(Math.max(0, r));
      if (r <= 0 && !firedRef.current) {
        firedRef.current = true;
        onComplete?.();
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [target, onComplete]);

  return (
    <span className={cn("tabular", className)}>{fmt(remaining, format)}</span>
  );
}
