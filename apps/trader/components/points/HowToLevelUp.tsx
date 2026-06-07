import Link from "next/link";
import { Button, Card } from "@/components/ui";

const STEPS = [
  {
    title: "Complete an evaluation",
    body: "Open a Starter, Basic, or Pro evaluation and hit the profit target within the drawdown and daily-loss rules.",
  },
  {
    title: "Pass to advance your credential",
    body: "Each passing evaluation levels up your non-transferable v1 Genesis credential, a verifiable record of your skill.",
  },
  {
    title: "Climb the cohort leaderboard",
    body: "Ranked by highest tier, simulated P&L, passes, and consistency. Your standing is visible to the whole cohort.",
  },
  {
    title: "Build a verifiable track record",
    body: "The credential proves membership in the v1 closed beta and the tiers you passed. Permanent, verifiable, and yours.",
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

      <Card className="p-6">
        <ol className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-text-muted">
                {i + 1}
              </span>
              <div>
                <div className="font-medium text-text">{step.title}</div>
                <p className="mt-0.5 text-pretty text-sm leading-relaxed text-text-muted">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border-soft pt-5">
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
      </Card>
    </section>
  );
}
