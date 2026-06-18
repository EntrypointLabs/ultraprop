"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardLabel,
  ConnectionDot,
  StatTile,
} from "@/components/ui";
import { useCohortStats } from "@/lib/mock/hooks";
import { formatPct } from "@/lib/utils";

export function CohortActivity() {
  const stats = useCohortStats();

  return (
    <Card>
      <CardHeader>
        <CardLabel>Cohort Activity</CardLabel>
        <div className="ml-auto">
          <ConnectionDot status="live" showLabel={false} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Members"
            value={<span className="tabular">{stats.members}</span>}
            delta="v1 Genesis cohort"
            deltaTone="muted"
          />
          <StatTile
            label="Active now"
            value={<span className="tabular">{stats.activeEvaluations}</span>}
            delta="live evaluations"
            deltaTone="muted"
          />
          <StatTile
            label="Total passes"
            value={<span className="tabular text-up">{stats.totalPasses}</span>}
            delta="cohort-wide"
            deltaTone="up"
          />
          <StatTile
            label="Pass rate"
            value={
              <span className="tabular">
                {formatPct(stats.passRate * 100, { sign: false })}
              </span>
            }
            delta={`median +${stats.medianPasserReturnPct}% return`}
            deltaTone="muted"
          />
        </div>
      </CardContent>
    </Card>
  );
}
