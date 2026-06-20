"use client";

import { Clock, X } from "lucide-react";
import { useMemo } from "react";
import { AssetIcon, Countdown } from "@/components/ui";
import { usePrices } from "@/lib/mock/hooks";
import { coinOf, decimalsFor, getMarket } from "@/lib/mock/markets";
import type { Position } from "@/lib/mock/types";
import { cn } from "@/lib/utils";
import type { BracketPatch } from "./PositionsTable";

interface OrdersPanelProps {
  positions: Position[];
  /** Arm/edit a position's bracket; here used to set/clear the expiry. */
  onSetBracket?: (id: string, bracket: BracketPatch) => void;
  /** Cancel a position's bracket — one leg, or both when `leg` is omitted. */
  onCancelBracket?: (id: string, leg?: "tp" | "sl") => void;
}

interface BracketRow {
  positionId: string;
  symbol: string;
  side: Position["side"];
  leg: "tp" | "sl";
  trigger: number;
  /** Live mark for the row's market; null until a tick lands. */
  mark: number | null;
  expiresAt: number | null;
  decimals: number;
}

/** Quick-set expiry options offered per position (relative to now). */
const EXPIRY_PRESETS: { label: string; ms: number }[] = [
  { label: "15m", ms: 15 * 60 * 1000 },
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "4h", ms: 4 * 60 * 60 * 1000 },
  { label: "1d", ms: 24 * 60 * 60 * 1000 },
];

function SideBadge({ side }: { side: Position["side"] }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        side === "long" ? "bg-up/15 text-on-up" : "bg-down/15 text-on-down",
      ].join(" ")}
    >
      {side === "long" ? "Long" : "Short"}
    </span>
  );
}

function LegBadge({ leg }: { leg: "tp" | "sl" }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        leg === "tp" ? "bg-up/15 text-on-up" : "bg-down/15 text-on-down",
      ].join(" ")}
    >
      {leg === "tp" ? "Take profit" : "Stop loss"}
    </span>
  );
}

/** Per-position expiry control — preset quick-sets plus a clear when one is set. */
function ExpiryControl({
  positionId,
  expiresAt,
  onSetBracket,
}: {
  positionId: string;
  expiresAt: number | null;
  onSetBracket?: (id: string, bracket: BracketPatch) => void;
}) {
  if (expiresAt != null) {
    return (
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-text-faint" />
        <Countdown
          target={expiresAt}
          format="hms"
          className="text-xs font-medium text-text-muted"
        />
        <button
          type="button"
          aria-label="Clear bracket expiry"
          onClick={() => onSetBracket?.(positionId, { expiresAt: null })}
          className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-text-faint">Expires</span>
      {EXPIRY_PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() =>
            onSetBracket?.(positionId, { expiresAt: Date.now() + preset.ms })
          }
          className="rounded-[var(--radius-sm)] border border-border px-1.5 py-0.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

export function OrdersPanel({
  positions,
  onSetBracket,
  onCancelBracket,
}: OrdersPanelProps) {
  const prices = usePrices();
  const markBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of prices) map.set(p.symbol, p.markPx);
    return map;
  }, [prices]);

  // Flatten every armed leg into its own row; one position can contribute both a
  // TP and an SL. A leg's expiry rides along so the row can show its countdown.
  const rows = useMemo<BracketRow[]>(() => {
    const out: BracketRow[] = [];
    for (const pos of positions) {
      const decimals = decimalsFor(getMarket(pos.symbol), pos.markPrice);
      const mark = markBySymbol.get(pos.symbol) ?? null;
      if (pos.takeProfit != null) {
        out.push({
          positionId: pos.id,
          symbol: pos.symbol,
          side: pos.side,
          leg: "tp",
          trigger: pos.takeProfit,
          mark,
          expiresAt: pos.bracketExpiresAt ?? null,
          decimals,
        });
      }
      if (pos.stopLoss != null) {
        out.push({
          positionId: pos.id,
          symbol: pos.symbol,
          side: pos.side,
          leg: "sl",
          trigger: pos.stopLoss,
          mark,
          expiresAt: pos.bracketExpiresAt ?? null,
          decimals,
        });
      }
    }
    return out;
  }, [positions, markBySymbol]);

  if (rows.length === 0) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 text-center">
        <span className="text-sm text-text-muted">No active orders</span>
        <span className="text-xs text-text-faint">
          Arm a take-profit or stop-loss on a position to see it here.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const distancePct =
          row.mark != null && row.mark > 0
            ? ((row.trigger - row.mark) / row.mark) * 100
            : null;
        const triggerStr = row.trigger.toLocaleString("en-US", {
          minimumFractionDigits: row.decimals,
          maximumFractionDigits: row.decimals,
        });
        return (
          <div
            key={`${row.positionId}-${row.leg}`}
            className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-2">
              <AssetIcon symbol={row.symbol} size={20} venue />
              <span className="text-xs font-medium text-text">
                {coinOf(row.symbol)}
              </span>
              <SideBadge side={row.side} />
              <LegBadge leg={row.leg} />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex flex-col">
                <span className="text-xs text-text-faint">Trigger</span>
                <span className="tabular text-xs font-semibold text-text">
                  {triggerStr}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-text-faint">From mark</span>
                <span
                  className={cn(
                    "tabular text-xs font-semibold",
                    distancePct == null
                      ? "text-text-faint"
                      : distancePct >= 0
                        ? "text-up"
                        : "text-down",
                  )}
                >
                  {distancePct == null
                    ? "—"
                    : `${distancePct >= 0 ? "+" : ""}${distancePct.toFixed(2)}%`}
                </span>
              </div>
              <ExpiryControl
                positionId={row.positionId}
                expiresAt={row.expiresAt}
                onSetBracket={onSetBracket}
              />
              <button
                type="button"
                aria-label={`Cancel ${row.leg === "tp" ? "take profit" : "stop loss"} for ${row.symbol} ${row.side}`}
                onClick={() => onCancelBracket?.(row.positionId, row.leg)}
                className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-border px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-down"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
