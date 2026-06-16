import type { Metadata, Viewport } from "next";
import { Geist, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "@/app/globals.css";

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-face",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Display face: a clean geometric sans in the spirit of Octant's PP Mori
// (which is a licensed typeface we can't bundle). Geist is OFL-licensed.
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
  title: "Ultraprop · The on-chain crypto prop firm",
  description:
    "Trade BTC, ETH and SOL perpetuals against live market prices. Prove your edge in simulation, clear the evaluation, and trade a funded account, fully on-chain.",
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
