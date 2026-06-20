"use client";

import { ArrowRight, BarChart2, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { useTradeHref } from "@/lib/trade-link";

export function StartEvalHero() {
  const tradeHref = useTradeHref();
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface px-6 py-8 sm:px-8 sm:py-10">
      {/* decorative pixel block top-right */}
      <div
        className="pixel-banner absolute -right-6 -top-6 h-32 w-32 rounded-full opacity-20"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="leverage">NEW</Badge>
            <span className="text-xs uppercase tracking-wider text-text-muted">
              Prop firm evaluation
            </span>
          </div>

          <h2 className="text-2xl font-bold leading-tight tracking-tight text-text sm:text-3xl">
            Start your evaluation
          </h2>
          <p className="max-w-md text-sm text-text-muted">
            Trade the full Bluefin, DeepBook &amp; Hyperliquid perpetual catalog
            in simulation against live market prices. Hit your profit target to
            pass — every fill is shown pre-submit.
          </p>

          <div className="flex flex-wrap gap-4 pt-1">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Zap className="h-3.5 w-3.5 text-brand" />
              <span>Live market prices</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-brand" />
              <span>Fill shown before submit</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <BarChart2 className="h-3.5 w-3.5 text-brand" />
              <span>Starter / Basic / Pro tiers</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:items-end">
          <Link href={tradeHref()}>
            <Button variant="brand" size="lg" className="gap-2">
              Start evaluation
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-xs text-text-faint">
            No hidden fees · +2 bps house tilt only
          </span>
        </div>
      </div>
    </div>
  );
}
