"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function Thead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 bg-surface text-xs uppercase tracking-wide text-text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Tbody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function Tr({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-border-soft transition-colors hover:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

export interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  sortable?: boolean;
  sortDir?: "asc" | "desc" | null;
  onSort?: () => void;
}

export function Th({
  className,
  numeric,
  sortable,
  sortDir = null,
  onSort,
  children,
  ...props
}: ThProps) {
  const align = numeric ? "text-right" : "text-left";
  if (sortable) {
    return (
      <th
        className={cn("h-10 px-3 font-medium", align, className)}
        aria-sort={
          sortDir === "asc"
            ? "ascending"
            : sortDir === "desc"
              ? "descending"
              : "none"
        }
        {...props}
      >
        <button
          type="button"
          onClick={onSort}
          className={cn(
            "inline-flex items-center gap-1 transition-colors hover:text-text",
            numeric && "flex-row-reverse",
          )}
        >
          <span>{children}</span>
          {sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3 text-violet" />
          ) : sortDir === "desc" ? (
            <ChevronDown className="h-3 w-3 text-violet" />
          ) : (
            <ChevronDown className="h-3 w-3 opacity-30" />
          )}
        </button>
      </th>
    );
  }
  return (
    <th className={cn("h-10 px-3 font-medium", align, className)} {...props}>
      {children}
    </th>
  );
}

export interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function Td({ className, numeric, ...props }: TdProps) {
  return (
    <td
      className={cn(
        "h-11 px-3 align-middle",
        numeric ? "tabular text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}
