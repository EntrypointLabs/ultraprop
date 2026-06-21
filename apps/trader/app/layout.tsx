import type { Metadata, Viewport } from "next";
import {
  Hanken_Grotesk,
  JetBrains_Mono,
  Space_Grotesk,
} from "next/font/google";
import { cookies } from "next/headers";
import "@/app/globals.css";
import {
  Chrome,
  Providers,
  StoreHydration,
  ThemeScript,
} from "@/components/shell";
import { isTheme, THEME_COOKIE } from "@/lib/theme-shared";

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
    "A proprietary trading firm. Trade the full Bluefin, DeepBook & Hyperliquid perpetual catalog in simulation against live market prices.",
  openGraph: {
    title: "Ultraprop · proprietary trading firm",
    description:
      "A proprietary trading firm. Trade the full Bluefin, DeepBook & Hyperliquid perpetual catalog in simulation against live market prices.",
    url: "https://app.ultraprop.xyz",
    siteName: "Ultraprop",
    images: [
      {
        url: "https://app.ultraprop.xyz/og-image.png",
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
    title: "Ultraprop · proprietary trading firm",
    description:
      "A proprietary trading firm. Trade the full Bluefin, DeepBook & Hyperliquid perpetual catalog in simulation against live market prices.",
    site: "@ultraprop_xyz",
    images: ["https://app.ultraprop.xyz/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieValue = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(cookieValue) ? cookieValue : "system";
  const isDark = theme === "dark";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${isDark ? "dark " : ""}${sans.variable} ${display.variable} ${mono.variable}`}
      style={{ colorScheme: isDark ? "dark" : "light" }}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col bg-bg text-text antialiased">
        <Providers initialTheme={theme}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-text focus:outline-2 focus:outline-violet"
          >
            Skip to main content
          </a>
          <StoreHydration />
          <Chrome>{children}</Chrome>
        </Providers>
      </body>
    </html>
  );
}
