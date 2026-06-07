"use client";

import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { useTiers } from "@/lib/mock/hooks";
import { formatUsd } from "@/lib/utils";

export function StartCard() {
  const starter = useTiers()[0];
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

  return (
    <Card className="flex flex-col p-6">
      <h2 className="text-base font-semibold text-text">Starter evaluation</h2>
      <p className="mt-1.5 text-pretty text-sm leading-relaxed text-text-muted">
        A {formatUsd(starter.shadowAllocation, { decimals: 0 })} simulated
        account. Reach the profit target without breaching the drawdown limit.
      </p>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border-soft pt-4">
        <div>
          <dt className="text-xs text-text-faint">Target</dt>
          <dd className="tabular mt-1 text-sm font-semibold text-up">
            +{pct(starter.profitTarget)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-faint">Max DD</dt>
          <dd className="tabular mt-1 text-sm font-semibold text-down">
            {pct(starter.maxDrawdown)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-faint">Account</dt>
          <dd className="tabular mt-1 text-sm font-semibold text-text">
            {formatUsd(starter.shadowAllocation, { decimals: 0 })}
          </dd>
        </div>
      </dl>

      <Link href="/start" className="mt-6">
        <Button variant="primary" className="w-full">
          Start an evaluation
        </Button>
      </Link>
    </Card>
  );
}
