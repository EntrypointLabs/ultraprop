import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "@/app/globals.css";
import {
  Footer,
  LoginModal,
  OnboardingModal,
  PixelTopBorder,
  Providers,
  StaleFeedBanner,
  StoreHydration,
  TopNav,
} from "@/components/shell";

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-face",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-face",
  weight: ["500", "600", "700"],
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ultraprop · proprietary trading firm",
  description:
    "A proprietary trading firm. Trade BTC, ETH and SOL in simulation against live market prices, with the fill math shown before every order.",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0C",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <body className="flex min-h-dvh flex-col bg-bg text-text antialiased">
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-text focus:outline-2 focus:outline-violet"
          >
            Skip to main content
          </a>
          <StoreHydration />
          <PixelTopBorder />
          <TopNav />
          <StaleFeedBanner />
          <main id="main-content" className="flex-1">{children}</main>
          <Footer />
          <OnboardingModal />
          <LoginModal />
        </Providers>
      </body>
    </html>
  );
}
