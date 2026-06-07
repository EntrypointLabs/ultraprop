import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" className={`dark ${inter.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col bg-bg text-text antialiased">
        <Providers>
          <StoreHydration />
          <PixelTopBorder />
          <TopNav />
          <StaleFeedBanner />
          <main className="flex-1">{children}</main>
          <Footer />
          <OnboardingModal />
          <LoginModal />
        </Providers>
      </body>
    </html>
  );
}
