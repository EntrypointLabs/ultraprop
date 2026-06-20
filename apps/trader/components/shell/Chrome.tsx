"use client";

import { usePathname } from "next/navigation";
import type * as React from "react";
import { Footer } from "@/components/shell/Footer";
import { LoginModal } from "@/components/shell/LoginModal";
import { OnboardingModal } from "@/components/shell/OnboardingModal";
import { PixelTopBorder } from "@/components/shell/PixelTopBorder";
import { StaleFeedBanner } from "@/components/shell/StaleFeedBanner";
import { TopNav } from "@/components/shell/TopNav";
import { cn } from "@/lib/utils";

const AUTH_PREFIXES = ["/signup", "/login", "/onboarding"];

/**
 * The live cockpit (`/evaluation/<vaultId>`, not its terminal sub-screens) runs
 * as a full-viewport trading shell: no footer, no welcome modal, and the page
 * itself never scrolls — its two columns scroll on their own.
 */
function isCockpitPath(pathname: string): boolean {
  return /^\/evaluation\/[^/]+$/.test(pathname);
}

/**
 * Renders the app chrome (nav, footer, global modals) on normal routes and
 * steps out of the way on the full-page auth flow, which owns its own layout.
 */
export function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isAuth) return <>{children}</>;

  const isCockpit = isCockpitPath(pathname);

  return (
    <>
      <PixelTopBorder />
      <TopNav />
      <StaleFeedBanner />
      <main
        id="main-content"
        className={cn(
          "flex-1",
          // Desktop cockpit: a definite height (viewport minus the 8px pixel
          // border + 50px sticky nav) makes this a height-bounded flex column,
          // so the trading grid fills the screen and its columns own their own
          // scroll while the page itself never scrolls.
          isCockpit &&
            "lg:flex lg:h-[calc(100dvh-58px)] lg:flex-none lg:flex-col lg:overflow-hidden",
        )}
      >
        {children}
      </main>
      {!isCockpit && <Footer />}
      {!isCockpit && <OnboardingModal />}
      <LoginModal />
    </>
  );
}
