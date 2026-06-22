import { TierGrid } from "@/components/tiers";
import { StartPageClient } from "@/components/tiers/StartPageClient";
import { Badge } from "@/components/ui";

export const metadata = {
  title: "Start an evaluation · Ultraprop",
  description:
    "Pick a tier and open your evaluation. Trade the full Bluefin, DeepBook & Hyperliquid perpetual catalog in simulation against live market prices with automatic rule enforcement.",
};

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{
    symbol?: string | string[];
    side?: string | string[];
  }>;
}) {
  // Carry the optional deep-link intent (?symbol=&side=) from /markets or a
  // spotlight CTA through the tier picker into the cockpit. Absent → unchanged.
  const sp = await searchParams;
  const symbol = Array.isArray(sp.symbol) ? sp.symbol[0] : sp.symbol;
  const side = Array.isArray(sp.side) ? sp.side[0] : sp.side;
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
      {/* Hero intro */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="genesis">v1 Genesis cohort</Badge>
          <Badge variant="outline">Closed beta</Badge>
        </div>

        <h1 className="text-balance text-4xl font-bold tracking-tight text-text mb-3">
          Start your evaluation
        </h1>

        <p className="text-base text-text-muted max-w-2xl leading-relaxed">
          Trade the full Bluefin, DeepBook &amp; Hyperliquid perpetual catalog
          in simulation against live market prices. Every rule (drawdown, daily
          loss, profit target) is enforced automatically in real time and emits
          verifiable pass/fail events. Pass an evaluation to level your
          non-transferable Genesis credential: proof of trading skill earned in
          the closed beta.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <FactChip label="Assets" value="Multi-venue perps" />
          <FactChip label="Settlement" value="Simulation" />
          <FactChip label="Fill model" value="Market mid + slippage + 2 bps" />
          <FactChip label="Daily reset" value="00:00 UTC" />
        </div>
      </div>

      {/* Divergence halt notice — client-driven */}
      <StartPageClient />

      {/* Tier cards */}
      <section aria-label="Tier selection">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">Choose a tier</h2>
          <span className="text-xs text-text-faint tabular">
            One evaluation account per trader
          </span>
        </div>

        <TierGrid symbol={symbol} side={side} />
      </section>

      {/* Footer note */}
      <div className="mt-8 rounded-[var(--radius)] bg-surface border border-border-soft px-5 py-4">
        <h3 className="text-sm font-semibold text-text mb-2">How it works</h3>
        <ol className="space-y-2 text-sm text-text-muted">
          <li className="flex gap-3">
            <span className="tabular font-mono text-violet font-semibold shrink-0">
              01
            </span>
            <span>
              Sign in. Your account must be on the closed-beta allowlist.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="tabular font-mono text-violet font-semibold shrink-0">
              02
            </span>
            <span>
              Pick a tier. Starter opens with an invite or a paid evaluation
              fee. Basic requires paying its evaluation fee up front. You hold
              one evaluation account at a time.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="tabular font-mono text-violet font-semibold shrink-0">
              03
            </span>
            <span>
              Trade the full Bluefin, DeepBook &amp; Hyperliquid perpetual
              catalog in simulation against live market prices. Every fill is
              shown pre-submit with market mid, slippage, and the +2 bps house
              tilt, with no hidden math.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="tabular font-mono text-violet font-semibold shrink-0">
              04
            </span>
            <span>
              Hit the profit target before breaching the drawdown or daily-loss
              rules. A Passed event is emitted and your Genesis credential is
              permanently recorded.
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}

function FactChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-sm bg-surface border border-border px-3 py-1.5">
      <span className="text-xs text-text-muted uppercase tracking-wide">
        {label}
      </span>
      <span className="text-xs text-text-faint">·</span>
      <span className="tabular text-xs font-medium text-text">{value}</span>
    </div>
  );
}
