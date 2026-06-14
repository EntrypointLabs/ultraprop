"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProfileTab {
  value: string;
  label: string;
  icon: LucideIcon;
  /** Shows a small attention dot on the tab (e.g. setup still pending). */
  dot?: boolean;
}

interface ProfileTabNavProps {
  tabs: ProfileTab[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

/** The right-rail section selector for the profile. Vertical list of tabs,
 * each an icon + label, with the active one highlighted. */
export function ProfileTabNav({
  tabs,
  value,
  onValueChange,
  className,
}: ProfileTabNavProps) {
  return (
    <nav
      aria-label="Profile sections"
      className={cn("flex flex-col gap-1", className)}
    >
      {tabs.map(({ value: v, label, icon: Icon, dot }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onValueChange(v)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-[var(--radius)] px-3 py-2.5 text-left text-sm font-medium transition-colors",
              active
                ? "bg-surface-2 text-text"
                : "text-text-muted hover:bg-surface-2/60 hover:text-text",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                active ? "text-violet" : "text-text-faint",
              )}
              aria-hidden="true"
            />
            {label}
            {dot && (
              <span
                role="img"
                aria-label="Setup incomplete"
                className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-warn"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
