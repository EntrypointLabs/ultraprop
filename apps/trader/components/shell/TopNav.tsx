"use client";

import { Gift, HelpCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { Logo } from "@/components/shell/Logo";
import { Button } from "@/components/ui/Button";
import { Identicon } from "@/components/ui/Identicon";
import { userVaultId } from "@/lib/auth";
import { accountHandle } from "@/lib/identity";
import { useSession } from "@/lib/mock/hooks";
import { useMockStore } from "@/lib/mock/store";
import { useAccountSetup } from "@/lib/sui/useTradingAccount";
import { cn } from "@/lib/utils";

const NAV_LINKS: { href: string; label: string; external?: boolean }[] = [
  { href: "/markets", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/points", label: "Points" },
  { href: "https://docs.ultraprop.xyz", label: "Docs", external: true },
];

const NAV_LINK_CLASS =
  "rounded-sm px-3 py-1.5 text-sm font-medium transition-[color,background-color] duration-150 ease-out hover:bg-surface-2";

export function TopNav() {
  const pathname = usePathname();
  const { session, signOut, hydrated } = useSession();
  const resetOnboarding = useMockStore((s) => s.resetOnboarding);
  const openLogin = useMockStore((s) => s.openLogin);
  const signedIn = session.status === "connected";

  // Once the trader has paid for and opened their on-chain account, surface a
  // direct route to their cockpit so trading is one click from anywhere — no
  // detour back through the tier picker.
  const { hasAccount, suiAddress } = useAccountSetup();
  const tradeHref =
    hasAccount && suiAddress ? `/evaluation/${userVaultId(suiAddress)}` : null;
  const tradeActive = pathname.startsWith("/evaluation");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <nav className="flex h-14 w-full items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {tradeHref && (
            <Link
              href={tradeHref}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-semibold transition-[color,background-color] duration-150 ease-out",
                tradeActive
                  ? "bg-brand/10 text-brand"
                  : "text-text hover:bg-brand/10 hover:text-brand",
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-brand"
                aria-hidden="true"
              />
              Trade
            </Link>
          )}
          {NAV_LINKS.map((l) => {
            if (l.external) {
              return (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    NAV_LINK_CLASS,
                    "text-text-muted hover:text-text",
                  )}
                >
                  {l.label}
                </a>
              );
            }
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  NAV_LINK_CLASS,
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
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            How it works?
          </button>

          <Link
            href="/points"
            aria-label="Points"
            className="rounded-sm p-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-brand"
          >
            <Gift className="h-4 w-4" aria-hidden="true" />
          </Link>

          {!hydrated ? (
            <div className="h-9 w-24 animate-pulse rounded-[var(--radius)] bg-surface-2" />
          ) : signedIn ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/profile/${session.address}`}
                className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-1.5 text-sm transition-colors hover:bg-surface-3"
              >
                <Identicon address={session.address ?? ""} size={18} />
                <span className="tabular hidden sm:inline">
                  {accountHandle(session.address ?? "")}
                </span>
              </Link>
              <AccountMenu
                address={session.address ?? ""}
                onSignOut={signOut}
              />
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
