import type { Metadata, Viewport } from "next";
import { Geist, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "@/app/globals.css";

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-face",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Display face: Geist, a clean geometric sans.
const display = Geist({
  subsets: ["latin"],
  variable: "--font-display-face",
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
  title: "Ultraprop · the on-chain crypto prop firm",
  description:
    "An on-chain proprietary trading firm. Trade the full Bluefin, DeepBook & Hyperliquid perpetual catalog in simulation against live market prices. Clear the evaluation to earn a funded account.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
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
      style={{ colorScheme: "dark" }}
    >
      <body className="bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
