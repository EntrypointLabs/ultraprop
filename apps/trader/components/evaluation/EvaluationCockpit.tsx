"use client";

import dynamic from "next/dynamic";
import { DailyResetCountdown } from "@/components/evaluation/DailyResetCountdown";
import { DrawdownGauge } from "@/components/evaluation/DrawdownGauge";
import { PositionsTable } from "@/components/evaluation/PositionsTable";
import { RulePills } from "@/components/evaluation/RulePills";
import { TradeHistory } from "@/components/evaluation/TradeHistory";
import { TradeIntentForm } from "@/components/trade";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardLabel,
  ConnectionDot,
  Skeleton,
  StatTile,
} from "@/components/ui";
import {
  useConnection,
  useEquityCurve,
  usePositions,
  useTradeHistory,
  useVault,
} from "@/lib/mock/hooks";
import { formatPct, formatUsd } from "@/lib/utils";

// SSR-safe: Lightweight Charts requires the browser canvas API
const EquityCurve = dynamic(
  () =>
    import("@/components/evaluation/EquityCurve").then((m) => ({
      default: m.EquityCurve,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-60 w-full rounded-[var(--radius)]" />,
  },
);

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  passed: "Passed",
  failed: "Failed",
  inactive: "Inactive",
};

const STATUS_VARIANTS: Record<string, "genesis" | "up" | "down" | "default"> = {
  active: "genesis",
  passed: "up",
  failed: "down",
  inactive: "default",
};

interface EvaluationCockpitProps {
  vaultId: string;
}

export function EvaluationCockpit({ vaultId }: EvaluationCockpitProps) {
  const vault = useVault(vaultId);
  const equityCurve = useEquityCurve(vaultId);
  const positions = usePositions(vaultId);
  const trades = useTradeHistory(vaultId);
  const connStatus = useConnection();

  const {
    tier,
    status,
    equity,
    startingEquity,
    peakEquity,
    rules,
    dailyResetAt,
  } = vault;

  const returnPct = ((equity - startingEquity) / startingEquity) * 100;
  const returnTone = returnPct >= 0 ? "up" : "down";

  const ddRule = rules.find((r) => r.kind === "drawdown");
  const ddFraction = ddRule ? ddRule.used : 0;
  const ddCurrentUsd = ddRule ? ddRule.current : 0;
  const ddLimitUsd = ddRule ? ddRule.limit : 0;

  return (
    <div className="mx-auto max-w-screen-xl space-y-4 px-4 py-6 sm:px-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-text">Evaluation</h1>
            <Badge variant="leverage">{tier.name}</Badge>
            <Badge variant={STATUS_VARIANTS[status] ?? "default"}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
            <Badge variant="genesis">v1 Genesis</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
            <span className="font-mono tabular text-text-faint">{vaultId}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DailyResetCountdown resetAt={dailyResetAt} />
          <ConnectionDot status={connStatus} />
        </div>
      </div>

      {/* ── Stat tiles ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Equity"
          value={formatUsd(equity)}
          delta={`Start: ${formatUsd(startingEquity)}`}
          deltaTone="muted"
        />
        <StatTile
          label="Return"
          value={formatPct(returnPct)}
          delta={`Target: ${formatPct(tier.profitTarget * 100, { sign: false })}`}
          deltaTone={returnTone}
        />
        <StatTile
          label="Peak equity"
          value={formatUsd(peakEquity)}
          delta={`DD floor: ${formatUsd(peakEquity * (1 - tier.maxDrawdown))}`}
          deltaTone="muted"
        />
        <StatTile
          label="Trades"
          value={`${vault.intentCount} / ${tier.intentCap}`}
          delta={`Limit: ${tier.intentCap}`}
          deltaTone="muted"
        />
      </div>

      {/* ── Curve + gauge row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_160px]">
        <Card>
          <CardHeader>
            <CardLabel>Equity curve</CardLabel>
          </CardHeader>
          <CardContent className="pt-2">
            <EquityCurve
              data={equityCurve}
              startingEquity={startingEquity}
              peakEquity={peakEquity}
              maxDrawdown={tier.maxDrawdown}
              profitTarget={tier.profitTarget}
              className="w-full"
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col items-center justify-center p-4">
          <CardLabel className="mb-3 block text-center">Drawdown</CardLabel>
          <DrawdownGauge
            currentDd={ddCurrentUsd}
            maxDd={ddLimitUsd}
            fraction={ddFraction}
          />
          <div className="mt-3 space-y-1 text-center text-xs text-text-muted">
            <div>
              <span className="tabular font-semibold text-text">
                {formatUsd(ddCurrentUsd)}
              </span>{" "}
              used
            </div>
            <div>
              limit{" "}
              <span className="tabular font-semibold text-text">
                {formatUsd(ddLimitUsd)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Rule pills ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardLabel>Compliance rules</CardLabel>
          <span className="ml-auto text-xs text-text-faint">
            click to inspect
          </span>
        </CardHeader>
        <CardContent>
          <RulePills rules={rules} />
        </CardContent>
      </Card>

      {/* ── Trade form + open positions ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardLabel>New order</CardLabel>
          </CardHeader>
          <CardContent>
            <TradeIntentForm vaultId={vaultId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardLabel>Open positions</CardLabel>
            <span className="ml-auto tabular text-xs text-text-faint">
              {positions.length} open
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <PositionsTable positions={positions} />
          </CardContent>
        </Card>
      </div>

      {/* ── Trade history ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardLabel>Trade history</CardLabel>
          <span className="ml-auto tabular text-xs text-text-faint">
            {trades.length} trades
          </span>
        </CardHeader>
        <CardContent>
          <TradeHistory trades={trades} />
        </CardContent>
      </Card>
    </div>
  );
}
