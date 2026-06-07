"use client";

import { Badge, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";
import { useCohortStats, useTiers } from "@/lib/mock/hooks";
import { formatPct } from "@/lib/utils";

// Local fixture: per-tier pass distribution derived from cohort total passes.
// These are proportions seeded from DEMO_COHORT.totalPasses = 41.
const TIER_PASS_DIST: Record<string, { passes: number; avgDays: number }> = {
  starter: { passes: 27, avgDays: 4.8 },
  basic: { passes: 11, avgDays: 6.3 },
  pro: { passes: 3, avgDays: 8.1 },
};

export function CohortPassesByTier() {
  const stats = useCohortStats();
  const tiers = useTiers();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Badge variant="outline" className="text-xs mb-1">
            Pass Distribution
          </Badge>
          <h2 className="text-lg font-semibold text-text">Passes by tier</h2>
          <p className="text-xs text-text-muted">
            {stats.totalPasses} total passes across {stats.members} cohort
            members
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th>Tier</Th>
              <Th numeric>Passes</Th>
              <Th numeric>Share</Th>
              <Th numeric>Avg. Days to Pass</Th>
            </Tr>
          </Thead>
          <Tbody>
            {tiers.map((tier) => {
              const dist = TIER_PASS_DIST[tier.id] ?? { passes: 0, avgDays: 0 };
              const share =
                stats.totalPasses > 0 ? dist.passes / stats.totalPasses : 0;
              return (
                <Tr key={tier.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          tier.id === "starter"
                            ? "genesis"
                            : tier.id === "pro"
                              ? "up"
                              : "tier"
                        }
                        className="text-xs"
                      >
                        {tier.name}
                      </Badge>
                      <Badge variant="leverage" className="text-xs">
                        {tier.leverage}X
                      </Badge>
                    </div>
                  </Td>
                  <Td numeric>
                    <span className="tabular font-semibold text-text">
                      {dist.passes}
                    </span>
                  </Td>
                  <Td numeric>
                    <span className="tabular text-text-muted">
                      {formatPct(share * 100, { sign: false })}
                    </span>
                  </Td>
                  <Td numeric>
                    <span className="tabular text-text-muted">
                      {dist.avgDays.toFixed(1)}d
                    </span>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </div>

      <p className="text-xs text-text-faint">
        Pass counts are cumulative since cohort inception. Avg. days is median
        time from evaluation open to pass event for completed evaluations only.
      </p>
    </section>
  );
}
