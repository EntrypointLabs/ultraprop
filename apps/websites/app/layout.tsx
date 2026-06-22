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
  metadataBase: new URL("https://ultraprop.xyz"),
  title: "Ultraprop · the on-chain crypto prop firm",
  description:
    "An on-chain proprietary trading firm. Trade the full Bluefin, DeepBook & Hyperliquid perpetual catalog in simulation against live market prices. Clear the evaluation to earn a funded account.",
  openGraph: {
    title: "Ultraprop · the on-chain crypto prop firm",
    description:
      "An on-chain proprietary trading firm. Trade the full Bluefin, DeepBook & Hyperliquid perpetual catalog in simulation against live market prices. Clear the evaluation to earn a funded account.",
    url: "https://ultraprop.xyz",
    siteName: "Ultraprop",
    images: [
      {
        url: "https://ultraprop.xyz/og-image.png",
        width: 2400,
        height: 1260,
        alt: "Ultraprop — the on-chain crypto prop firm, powered by Sui",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ultraprop · the on-chain crypto prop firm",
    description:
      "An on-chain proprietary trading firm. Trade the full Bluefin, DeepBook & Hyperliquid perpetual catalog in simulation against live market prices. Clear the evaluation to earn a funded account.",
    site: "@ultraprop_xyz",
    images: ["https://ultraprop.xyz/og-image.png"],
  },
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
