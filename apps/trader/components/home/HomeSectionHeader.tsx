import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface HomeSectionHeaderProps {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}

export function HomeSectionHeader({
  title,
  viewAllHref,
  viewAllLabel = "View all",
  className,
}: HomeSectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">
          {title}
        </h2>
        <div className="h-px flex-1 min-w-[40px] bg-border-soft" />
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="inline-flex shrink-0 items-center gap-1 text-xs text-text-faint transition-colors hover:text-text"
        >
          {viewAllLabel}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
