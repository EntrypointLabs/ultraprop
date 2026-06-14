"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/** Card wrapper that groups a set of `SettingRow`s with hairline dividers. */
export function SettingsList({ children }: { children: React.ReactNode }) {
  return (
    <Card className="divide-y divide-border-soft overflow-hidden">
      {children}
    </Card>
  );
}

interface SettingRowProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  /** Right-aligned value or control. */
  value?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}

/**
 * One row in a `SettingsList`: an icon and label on the left, an optional value
 * on the right, and a chevron when the row navigates or acts.
 */
export function SettingRow({
  icon: Icon,
  label,
  description,
  value,
  href,
  onClick,
  danger,
}: SettingRowProps) {
  const interactive = Boolean(href || onClick);

  const inner = (
    <>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-2",
          danger ? "text-down" : "text-text-muted",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm font-medium",
            danger ? "text-down" : "text-text",
          )}
        >
          {label}
        </span>
        {description && (
          <span className="block text-xs text-text-muted">{description}</span>
        )}
      </span>
      {value != null && (
        <span className="shrink-0 text-sm text-text-muted">{value}</span>
      )}
      {interactive && (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-text-faint"
          aria-hidden="true"
        />
      )}
    </>
  );

  const base =
    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors";

  if (href) {
    return (
      <Link href={href} className={cn(base, "hover:bg-surface-2")}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(base, "hover:bg-surface-2")}
      >
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}
