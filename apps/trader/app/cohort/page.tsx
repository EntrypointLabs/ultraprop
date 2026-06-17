import {
  CohortHero,
  CohortPassesByTier,
  CohortStatsStrip,
  DesignPrinciples,
  TierLadderSection,
  WhatIsTheCohort,
  WhatItProves,
} from "@/components/cohort";

export const metadata = {
  title: "v1 Genesis Cohort · Ultraprop",
  description:
    "The first group of traders to earn a verifiable credential by passing live-price evaluations.",
};

export default function CohortPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-10 sm:px-6 lg:py-16">
      {/* Hero — lime pixel block with cohort name */}
      <CohortHero />

      {/* Live cohort health stats */}
      <CohortStatsStrip />

      {/* What the cohort is + no-token statement */}
      <WhatIsTheCohort />

      {/* What the SBT credibly proves */}
      <WhatItProves />

      {/* Tier ladder with authoritative numbers */}
      <TierLadderSection />

      {/* Passes by tier table */}
      <CohortPassesByTier />

      {/* Design principles for future credentialing */}
      <DesignPrinciples />

      {/* Footer disclosure */}
      <footer className="border-t border-border pt-8 text-xs leading-relaxed text-text-faint space-y-2">
        <p>
          <strong className="font-semibold text-text-muted">
            No token. No promise.
          </strong>{" "}
          This page describes a credential issued for passing a calibrated
          trading evaluation. It does not constitute an offer, solicitation, or
          representation regarding any future protocol, digital asset, or
          financial instrument. The v1 Genesis credential has no claim on any
          entity or system beyond what is stated here and independently
          verifiable.
        </p>
        <p>
          All evaluations trade the full Bluefin, DeepBook &amp; Hyperliquid perpetual catalog against live market prices
          with a disclosed +2 bps house tilt applied against the trader on every
          fill. Past evaluation pass rates are not indicative of individual
          future results.
        </p>
      </footer>
    </div>
  );
}
