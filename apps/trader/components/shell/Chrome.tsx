"use client";

import { usePathname } from "next/navigation";
import type * as React from "react";
import { Footer } from "@/components/shell/Footer";
import { LoginModal } from "@/components/shell/LoginModal";
import { OnboardingModal } from "@/components/shell/OnboardingModal";
import { PixelTopBorder } from "@/components/shell/PixelTopBorder";
import { StaleFeedBanner } from "@/components/shell/StaleFeedBanner";
import { TopNav } from "@/components/shell/TopNav";

const AUTH_PREFIXES = ["/signup", "/login", "/onboarding"];

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

  return (
    <>
      <PixelTopBorder />
      <TopNav />
      <StaleFeedBanner />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
      <OnboardingModal />
      <LoginModal />
    </>
  );
}
