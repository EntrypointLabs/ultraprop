import Link from "next/link";
import { Button } from "@/components/ui";

const STEPS = [
  {
    num: "01",
    title: "Complete an evaluation",
    body: "Open a Starter, Basic, or Pro evaluation and hit the profit target within the drawdown and daily-loss rules.",
  },
  {
    num: "02",
    title: "Pass to advance your credential",
    body: "Each passing evaluation levels up your non-transferable v1 Genesis credential — a verifiable record of your skill.",
  },
  {
    num: "03",
    title: "Climb the cohort leaderboard",
    body: "Ranked by highest tier, simulated P&L, passes, and consistency score. Your standing is visible to the entire cohort.",
  },
  {
    num: "04",
    title: "Build a verifiable track record",
    body: "The credential proves membership in the v1 closed beta and the tiers you passed. It is permanent, verifiable, and yours.",
  },
];

export function HowToLevelUp() {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">
          How to level up
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {STEPS.map((step) => (
          <div
            key={step.num}
            className="flex gap-4 rounded-lg border border-border bg-surface p-4"
          >
            <span className="tabular shrink-0 text-2xl font-bold text-brand/40 leading-none mt-0.5">
              {step.num}
            </span>
            <div>
              <div className="mb-1 font-semibold text-text">{step.title}</div>
              <p className="text-sm text-text-muted leading-relaxed">
                {step.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA row */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href="/leaderboard">
          <Button variant="brand" size="md">
            Go to leaderboard
          </Button>
        </Link>
        <Link href="/cohort">
          <Button variant="ghost" size="md">
            What the Genesis credential proves →
          </Button>
        </Link>
      </div>
    </section>
  );
}
