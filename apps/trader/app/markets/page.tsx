import { GenesisBanner } from "@/components/markets/GenesisBanner";
import { MarketsBrowser } from "@/components/markets/MarketsBrowser";
import { StartEvalHero } from "@/components/markets/StartEvalHero";

export const metadata = {
  title: "Markets · Ultraprop",
  description:
    "Trade the full Bluefin, DeepBook & Hyperliquid perpetual catalog in simulation against live market prices.",
};

export default function MarketsPage() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-1.5">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-text">
          Markets
        </h1>
        <p className="max-w-prose text-pretty text-sm leading-relaxed text-text-muted">
          Trade the full Bluefin, DeepBook &amp; Hyperliquid perpetual catalog in simulation against
          live market prices, with a 2 bps house spread shown on every fill.
        </p>
      </header>

      <GenesisBanner />
      <StartEvalHero />
      <MarketsBrowser />
    </div>
  );
}
