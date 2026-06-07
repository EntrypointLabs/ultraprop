import type { ConnectionStatus } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

export interface ConnectionDotProps {
  status: ConnectionStatus;
  /** show the text label next to the dot */
  showLabel?: boolean;
  className?: string;
}

const config: Record<
  ConnectionStatus,
  { color: string; label: string; pulse: boolean }
> = {
  live: { color: "bg-up", label: "Live", pulse: true },
  reconnecting: { color: "bg-warn", label: "Reconnecting", pulse: true },
  stale: { color: "bg-down", label: "Stale", pulse: false },
};

export function ConnectionDot({
  status,
  showLabel = true,
  className,
}: ConnectionDotProps) {
  const c = config[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn("h-2 w-2 rounded-full", c.color, c.pulse && "live-pulse")}
      />
      {showLabel && <span className="text-xs text-text-muted">{c.label}</span>}
    </span>
  );
}
