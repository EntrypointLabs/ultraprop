import { Badge } from "@/components/ui";

export function WhatIsTheCohort() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <Badge variant="genesis" className="text-xs">
          v1 Genesis
        </Badge>
        <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          What the v1 Genesis cohort is
        </h2>
      </div>

      <div className="prose-custom space-y-4 text-sm leading-relaxed text-text-muted max-w-3xl">
        <p>
          The v1 Genesis cohort is the first group of traders invited into the
          closed beta of Ultraprop, a proprietary trading firm that runs
          evaluations with automatic rule enforcement. Cohort members select an
          evaluation tier and trade in simulation using BTC, ETH, and SOL
          against live market prices. The evaluation contract records every
          trade and enforces every rule. No human decision enters the pass or
          fail determination.
        </p>
        <p>
          Membership is by invitation only. The cohort size is fixed at the time
          of the beta launch. There is no secondary mechanism to join v1
          Genesis; the set of eligible traders was determined before the first
          evaluation opened.
        </p>
        <p>
          Traders who pass an evaluation tier receive a non-transferable
          credential issued to their account. The credential records the tier
          passed, the cohort label, and the timestamp of the level-up
          transaction. It cannot be replicated. Passing higher tiers raises the
          credential level on the same record — a single credential that
          accumulates provenance.
        </p>
        <p className="font-medium text-text">
          There is no token. There is no promise of a token. The value of the
          credential rests entirely on what it demonstrably proves: that the
          holder met the criteria of a calibrated, rule-governed evaluation
          against real market prices.
        </p>
      </div>

      {/* Key facts strip */}
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3 overflow-hidden rounded-lg border border-border">
        {[
          {
            label: "Evaluation type",
            value: "Simulated trading against live market prices",
          },
          {
            label: "Rule enforcement",
            value: "Automatic · no human override",
          },
          {
            label: "Credential type",
            value: "Non-transferable · issued once per trader",
          },
        ].map((fact) => (
          <div
            key={fact.label}
            className="flex flex-col gap-1 bg-surface px-4 py-4"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {fact.label}
            </span>
            <span className="text-sm font-semibold text-text">
              {fact.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
