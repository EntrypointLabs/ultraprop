import { cn } from "@/lib/utils";

export interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

/** Lime pixel "E" mark for Entrypoint. */
export function Logo({ size = 24, withWordmark = true, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 10 10"
        aria-label="Entrypoint"
        shapeRendering="crispEdges"
      >
        <rect width="10" height="10" rx="1.5" fill="var(--color-brand)" />
        <g fill="var(--color-brand-ink)">
          <rect x="2" y="2" width="6" height="1.6" />
          <rect x="2" y="2" width="1.6" height="6" />
          <rect x="2" y="4.2" width="4" height="1.6" />
          <rect x="2" y="6.4" width="6" height="1.6" />
        </g>
      </svg>
      {withWordmark && (
        <span className="text-sm font-semibold tracking-tight text-text">
          Entrypoint
        </span>
      )}
    </span>
  );
}
