"use client";

import { LogOut, User } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { ThemeControl } from "@/components/settings/ThemeControl";

export function AccountMenu({
  address,
  onSignOut,
}: {
  address: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-sm p-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-violet focus-visible:outline-offset-2"
      >
        <User className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-[var(--radius)] border border-border bg-surface p-2 shadow-lg"
        >
          <Link
            href={`/profile/${address}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-text transition-colors hover:bg-surface-2"
          >
            <User className="h-4 w-4 text-text-muted" aria-hidden="true" />
            Profile
          </Link>

          <div className="my-1 border-border border-t" />

          <div className="px-2 py-1.5">
            <ThemeControl />
          </div>

          <div className="my-1 border-border border-t" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-text transition-colors hover:bg-surface-2"
          >
            <LogOut className="h-4 w-4 text-text-muted" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
