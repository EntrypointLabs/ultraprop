"use client";

import { Pencil, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  AssetIcon,
  Button,
  Input,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui";
import { decimalsFor, getMarket } from "@/lib/mock/markets";
import type { Position } from "@/lib/mock/types";
import { cn, formatPct, formatUsd } from "@/lib/utils";

/** The TP/SL bracket payload the engine's `setBracket` accepts. */
export interface BracketPatch {
  takeProfit?: number | null;
  stopLoss?: number | null;
  expiresAt?: number | null;
}

interface PositionsTableProps {
  positions: Position[];
  /**
   * Close a position at the current mark, booking realized P&L. `closeUsd` is a
   * partial close amount; omit it to close the whole position.
   */
  onClose?: (id: string, closeUsd?: number) => void;
  /** Arm/edit a position's TP/SL bracket; omit a leg to leave it, `null` clears it. */
  onSetBracket?: (id: string, bracket: BracketPatch) => void;
  /** Cancel a position's bracket — one leg, or both when `leg` is omitted. */
  onCancelBracket?: (id: string, leg?: "tp" | "sl") => void;
}

function SideBadge({ side }: { side: "long" | "short" }) {
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

function formatTrigger(price: number, decimals: number): string {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Soft, client-side sanity check on a trigger price. A take-profit sits in the
 * profitable direction (above entry for a long, below for a short); a stop-loss
 * is the inverse. The engine is the source of truth — this only surfaces a gentle
 * hint, it never blocks submission. Returns a message string or `null` when sane.
 */
function bracketHint(
  leg: "tp" | "sl",
  price: number,
  pos: Position,
): string | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const ref = pos.entryPrice;
  if (leg === "tp") {
    if (pos.side === "long" && price <= ref)
      return "TP usually sits above entry for a long";
    if (pos.side === "short" && price >= ref)
      return "TP usually sits below entry for a short";
  } else {
    if (pos.side === "long" && price >= ref)
      return "SL usually sits below entry for a long";
    if (pos.side === "short" && price <= ref)
      return "SL usually sits above entry for a short";
  }
  return null;
}

/** A single TP or SL leg: its trigger summary plus an inline price editor. */
function LegEditor({
  leg,
  pos,
  decimals,
  onSet,
  onCancel,
}: {
  leg: "tp" | "sl";
  pos: Position;
  decimals: number;
  onSet?: (id: string, bracket: BracketPatch) => void;
  onCancel?: (id: string, leg?: "tp" | "sl") => void;
}) {
  const current = leg === "tp" ? pos.takeProfit : pos.stopLoss;
  const label = leg === "tp" ? "TP" : "SL";
  const labelTone = leg === "tp" ? "text-up" : "text-down";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const fieldId = useId();

  // Seed the draft from the live trigger whenever the editor opens.
  useEffect(() => {
    if (editing) setDraft(current != null ? String(current) : "");
  }, [editing, current]);

  const parsed = Number.parseFloat(draft);
  const hint =
    editing && draft.trim() !== "" ? bracketHint(leg, parsed, pos) : null;

  function commit() {
    const value = Number.parseFloat(draft);
    if (!draft.trim() || !Number.isFinite(value) || value <= 0) {
      setEditing(false);
      return;
    }
    onSet?.(pos.id, leg === "tp" ? { takeProfit: value } : { stopLoss: value });
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={cn("text-xs font-semibold", labelTone)}>{label}</span>
        {current != null ? (
          <>
            <span className="tabular text-xs text-text">
              {formatTrigger(current, decimals)}
            </span>
            <button
              type="button"
              aria-label={`Edit ${label} for ${pos.symbol} ${pos.side}`}
              onClick={() => setEditing(true)}
              className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              aria-label={`Clear ${label} for ${pos.symbol} ${pos.side}`}
              onClick={() => onCancel?.(pos.id, leg)}
              className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-surface-2 hover:text-down"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-[var(--radius-sm)] border border-border px-1.5 py-0.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            Set
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className={cn("text-xs font-semibold", labelTone)}>{label}</span>
        <Input
          mono
          autoFocus
          type="number"
          inputMode="decimal"
          step="any"
          aria-label={`${label} trigger price for ${pos.symbol} ${pos.side}`}
          aria-describedby={hint ? fieldId : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-7 w-24 px-2 text-xs"
        />
        <button
          type="button"
          aria-label={`Save ${label}`}
          onClick={commit}
          className="rounded-[var(--radius-sm)] border border-border px-1.5 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          Save
        </button>
        <button
          type="button"
          aria-label={`Cancel editing ${label}`}
          onClick={() => setEditing(false)}
          className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {hint && (
        <span id={fieldId} className="text-xs text-warn">
          {hint}
        </span>
      )}
    </div>
  );
}

function BracketCell({
  pos,
  onSetBracket,
  onCancelBracket,
}: {
  pos: Position;
  onSetBracket?: (id: string, bracket: BracketPatch) => void;
  onCancelBracket?: (id: string, leg?: "tp" | "sl") => void;
}) {
  const decimals = decimalsFor(getMarket(pos.symbol), pos.markPrice);
  return (
    <div className="flex flex-col gap-1.5">
      <LegEditor
        leg="tp"
        pos={pos}
        decimals={decimals}
        onSet={onSetBracket}
        onCancel={onCancelBracket}
      />
      <LegEditor
        leg="sl"
        pos={pos}
        decimals={decimals}
        onSet={onSetBracket}
        onCancel={onCancelBracket}
      />
    </div>
  );
}

export function PositionsTable({
  positions,
  onClose,
  onSetBracket,
  onCancelBracket,
}: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-text-faint">
        No open positions
      </div>
    );
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Market</Th>
          <Th className="hidden sm:table-cell">Side</Th>
          <Th numeric className="hidden sm:table-cell">Size</Th>
          <Th numeric className="hidden md:table-cell">Entry</Th>
          <Th numeric className="hidden md:table-cell">Mark</Th>
          {/* PnL always visible — most actionable column */}
          <Th numeric>PnL</Th>
          <Th numeric className="hidden sm:table-cell">PnL %</Th>
          <Th className="hidden lg:table-cell">TP / SL</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        {positions.map((pos) => {
          // What the position actually contributes to equity right now: price
          // PnL net of the taker fee already paid at open and any accrued
          // funding. So a freshly opened position reads negative by the entry
          // fee — same as a real venue — and the row never disagrees with the
          // cockpit equity. ROE % is that net against the posted collateral
          // (notional ÷ leverage), so a 10× position shows ~10× the move.
          const collateral =
            pos.leverage > 0 ? pos.sizeUsd / pos.leverage : pos.sizeUsd;
          const netPnl = Number(
            (pos.unrealizedPnl - pos.entryFeeUsd + pos.fundingPaid).toFixed(2),
          );
          const roePct = collateral > 0 ? (netPnl / collateral) * 100 : 0;
          const pnlTone = netPnl >= 0 ? "text-up" : "text-down";
          const isDecimalPrice = pos.entryPrice < 1000;
          const priceDecimals = isDecimalPrice ? 4 : 1;
          return (
            <Tr key={pos.id}>
              <Td>
                <div className="flex items-center gap-1.5">
                  <AssetIcon symbol={pos.symbol} size={16} />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">{pos.symbol}</span>
                    {/* Side badge inline on xs — shown when Side column is hidden */}
                    <span className="sm:hidden">
                      <SideBadge side={pos.side} />
                    </span>
                  </div>
                </div>
              </Td>
              <Td className="hidden sm:table-cell">
                <SideBadge side={pos.side} />
              </Td>
              <Td numeric className="hidden sm:table-cell">
                {formatUsd(pos.sizeUsd, { decimals: 0 })}
              </Td>
              <Td numeric className="hidden md:table-cell">
                <span className="tabular">
                  {pos.entryPrice.toLocaleString("en-US", {
                    minimumFractionDigits: priceDecimals,
                    maximumFractionDigits: priceDecimals,
                  })}
                </span>
              </Td>
              <Td numeric className="hidden md:table-cell">
                <span className="tabular">
                  {pos.markPrice.toLocaleString("en-US", {
                    minimumFractionDigits: priceDecimals,
                    maximumFractionDigits: priceDecimals,
                  })}
                </span>
              </Td>
              <Td numeric>
                <span className={["tabular font-semibold text-xs", pnlTone].join(" ")}>
                  {formatUsd(netPnl, { sign: true })}
                </span>
              </Td>
              <Td numeric className="hidden sm:table-cell">
                <span className={["tabular font-semibold", pnlTone].join(" ")}>
                  {formatPct(roePct)}
                </span>
              </Td>
              <Td className="hidden lg:table-cell">
                <BracketCell
                  pos={pos}
                  onSetBracket={onSetBracket}
                  onCancelBracket={onCancelBracket}
                />
              </Td>
              <Td className="pr-2 sm:pr-4">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    aria-label={`Close 25% of ${pos.symbol} ${pos.side} position`}
                    onClick={() => onClose?.(pos.id, pos.sizeUsd * 0.25)}
                    className="hidden rounded-[var(--radius-sm)] border border-border px-1.5 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text sm:inline-flex"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    aria-label={`Close 50% of ${pos.symbol} ${pos.side} position`}
                    onClick={() => onClose?.(pos.id, pos.sizeUsd * 0.5)}
                    className="hidden rounded-[var(--radius-sm)] border border-border px-1.5 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text sm:inline-flex"
                  >
                    50%
                  </button>
                  <Button
                    variant="danger"
                    size="sm"
                    aria-label={`Close ${pos.symbol} ${pos.side} position`}
                    onClick={() => onClose?.(pos.id)}
                  >
                    Close
                  </Button>
                </div>
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
