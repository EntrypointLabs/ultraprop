"use client";

import { Badge, PixelBanner } from "@/components/ui";
import { useCohortStats } from "@/lib/mock/hooks";
import { cn } from "@/lib/utils";

export function CohortHero() {
  const stats = useCohortStats();

  return (
    <section className="relative overflow-hidden">
      <PixelBanner height={180} className="rounded-lg">
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <Badge variant="genesis" className="text-xs">
            {stats.cohort} &bull; Closed Beta
          </Badge>
          <h1
            className={cn(
              "text-4xl font-bold leading-none tracking-tight text-brand-ink sm:text-5xl lg:text-6xl",
            )}
          >
            GENESIS COHORT
          </h1>
          <p className="max-w-xl text-sm font-medium text-brand-ink/80">
            The first cohort of traders to earn a verifiable credential by
            passing live-price evaluations. No invitations for future cohorts
            are guaranteed.
          </p>
        </div>
      </PixelBanner>
    </section>
  );
}
