import type { Metadata, Viewport } from "next";
import {
  Geist,
  Hanken_Grotesk,
  JetBrains_Mono,
  Newsreader,
} from "next/font/google";
import "@/app/globals.css";

const PAGE_BACKGROUND = "#f6f7f5";

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

const editorial = Newsreader({
  subsets: ["latin"],
  variable: "--font-editorial-face",
  weight: ["300", "400"],
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ultraprop.xyz"),
  title: "Ultraprop · the on-chain crypto prop firm",
  description:
    "A crypto proprietary trading evaluation platform. Trade the Hyperliquid perpetual catalog in simulation against live market prices and clear transparent evaluation rules.",
  openGraph: {
    title: "Ultraprop · the on-chain crypto prop firm",
    description:
      "A crypto proprietary trading evaluation platform. Trade the Hyperliquid perpetual catalog in simulation against live market prices and clear transparent evaluation rules.",
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
      "A crypto proprietary trading evaluation platform. Trade the Hyperliquid perpetual catalog in simulation against live market prices and clear transparent evaluation rules.",
    site: "@ultraprop_xyz",
    images: ["https://ultraprop.xyz/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ultraprop",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: PAGE_BACKGROUND,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${sans.variable} ${display.variable} ${mono.variable} ${editorial.variable}`}
      style={{ backgroundColor: PAGE_BACKGROUND, colorScheme: "light" }}
    >
      <body
        className="text-text antialiased"
        style={{ backgroundColor: PAGE_BACKGROUND }}
      >
        {children}
      </body>
    </html>
  );
}
