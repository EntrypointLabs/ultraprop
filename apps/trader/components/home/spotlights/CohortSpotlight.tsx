"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { useCohortStats } from "@/lib/mock/hooks";
import { useTradeHref } from "@/lib/trade-link";
import { formatPct } from "@/lib/utils";

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Pick a tier",
    body: "Select Starter, Basic, or Pro. Each tier has a defined account size, profit target, max drawdown, and daily loss limit.",
  },
  {
    step: "2",
    title: "Trade the evaluation",
    body: "Submit trade intents across the full Bluefin, DeepBook & Hyperliquid perpetual catalog. Every fill is priced against a live oracle with a disclosed +2 bps house spread.",
  },
  {
    step: "3",
    title: "Rules are enforced automatically",
    body: "A smart contract monitors every rule in real time. Breach any limit and the evaluation closes immediately, no operator override.",
  },
  {
    step: "4",
    title: "Earn your credential",
    body: "Hit the profit target within all constraints and receive a non-transferable Genesis credential: verifiable proof of your trading record.",
  },
];

export function CohortSpotlight() {
  const stats = useCohortStats();
  const tradeHref = useTradeHref();

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
            v1 Genesis Cohort
          </span>
          <Badge variant="genesis">Genesis</Badge>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text">
          A closed-beta prop evaluation
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {stats.members} invited traders. Every pass and fail is verifiable. No
          promises, no tokens.
        </p>
      </div>

      {/* Cohort stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius)] bg-surface-2 px-3 py-3">
          <div className="tabular text-lg font-bold text-text">
            {stats.members}
          </div>
          <div className="mt-0.5 text-xs text-text-muted">Members</div>
        </div>
        <div className="rounded-[var(--radius)] bg-surface-2 px-3 py-3">
          <div className="tabular text-lg font-bold text-up">
            {formatPct(stats.passRate * 100, { sign: false })}
          </div>
          <div className="mt-0.5 text-xs text-text-muted">Pass rate</div>
        </div>
        <div className="rounded-[var(--radius)] bg-surface-2 px-3 py-3">
          <div className="tabular text-lg font-bold text-text">
            {stats.totalPasses}
          </div>
          <div className="mt-0.5 text-xs text-text-muted">Total passes</div>
        </div>
      </div>

      {/* How it works */}
      <div>
        <div className="mb-3 text-xs font-medium uppercase tracking-widest text-text-muted">
          How an evaluation works
        </div>
        <div className="space-y-2.5">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="flex gap-3">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet/20 text-xs font-bold text-violet">
                {step.step}
              </div>
              <div>
                <div className="text-sm font-medium text-text">
                  {step.title}
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-text-muted">
                  {step.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2">
        <Link href={tradeHref()} className="flex-1">
          <Button variant="primary" size="md" className="w-full gap-1.5">
            Get started
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/cohort">
          <Button variant="ghost" size="md" className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Learn more
          </Button>
        </Link>
      </div>
    </div>
  );
}
