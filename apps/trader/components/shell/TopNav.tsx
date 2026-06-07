"use client";

import { ChevronDown, Gift, HelpCircle, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/shell/Logo";
import { Button } from "@/components/ui/Button";
import { Identicon } from "@/components/ui/Identicon";
import { useSession } from "@/lib/mock/hooks";
import { useMockStore } from "@/lib/mock/store";
import { cn, formatUsd, shortAddress } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/points", label: "Points" },
  { href: "/docs", label: "Docs" },
];

export function TopNav() {
  const pathname = usePathname();
  const { session, signOut, hydrated } = useSession();
  const resetOnboarding = useMockStore((s) => s.resetOnboarding);
  const openLogin = useMockStore((s) => s.openLogin);
  const signedIn = session.status === "connected";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "text-text" : "text-text-muted hover:text-text",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={resetOnboarding}
            className="hidden items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-text-muted transition-colors hover:text-text sm:inline-flex"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            How it works?
          </button>

          <Link
            href="/points"
            aria-label="Points"
            className="rounded-sm p-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-brand"
          >
            <Gift className="h-4 w-4" />
          </Link>

          <button
            type="button"
            className="hidden items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface-3 sm:inline-flex"
          >
            <span className="tabular">
              {formatUsd(session.balanceUsd, { decimals: 0 })}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </button>

          {!hydrated ? (
            <div className="h-9 w-24 animate-pulse rounded-[var(--radius)] bg-surface-2" />
          ) : signedIn ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-1.5 text-sm transition-colors hover:bg-surface-3"
              >
                <Identicon address={session.address ?? ""} size={18} />
                <span className="tabular hidden sm:inline">
                  {shortAddress(session.address ?? "")}
                </span>
              </button>
              <Link
                href={`/profile/${session.address}`}
                aria-label="Profile"
                className="rounded-sm p-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <User className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <Button variant="primary" size="sm" onClick={openLogin}>
              Sign in
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
