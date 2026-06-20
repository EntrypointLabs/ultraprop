import { EvaluationCockpit } from "@/components/evaluation/EvaluationCockpit";
import { EvaluationGuard } from "@/components/evaluation/EvaluationGuard";
import { TIERS } from "@/lib/mock/fixtures";
import type { Tier } from "@/lib/mock/types";

/** Resolve the `?tier=` selection to a Tier; falls back to Starter when absent/unknown. */
function resolveTier(raw: string | string[] | undefined): Tier {
  const id = Array.isArray(raw) ? raw[0] : raw;
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}

function first(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

export default async function EvaluationPage({
  params,
  searchParams,
}: {
  params: Promise<{ vaultId: string }>;
  searchParams: Promise<{
    tier?: string | string[];
    symbol?: string | string[];
    side?: string | string[];
  }>;
}) {
  const { vaultId } = await params;
  const { tier, symbol, side } = await searchParams;
  // The deep-link market/side (?symbol=&side=) is forwarded raw — the cockpit
  // resolves the symbol against the LIVE catalog client-side (a bare ticker like
  // "BTC" → "hyperliquid:BTC"), which the seed-only server catalog can't always
  // do. A null/garbage value leaves the cockpit on its defaults.
  return (
    <EvaluationGuard vaultId={vaultId}>
      <EvaluationCockpit
        vaultId={vaultId}
        tier={resolveTier(tier)}
        initialSymbol={first(symbol)}
        initialSide={first(side)}
      />
    </EvaluationGuard>
  );
}
