"use client";

import {
  AssetIcon,
  Button,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui";
import type { Position } from "@/lib/mock/types";
import { formatPct, formatUsd } from "@/lib/utils";

interface PositionsTableProps {
  positions: Position[];
  /**
   * Close a position at the current mark, booking realized P&L. `closeUsd` is a
   * partial close amount; omit it to close the whole position.
   */
  onClose?: (id: string, closeUsd?: number) => void;
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

export function PositionsTable({ positions, onClose }: PositionsTableProps) {
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
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        {positions.map((pos) => {
          const pnlTone = pos.unrealizedPnl >= 0 ? "text-up" : "text-down";
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
                  {formatUsd(pos.unrealizedPnl, { sign: true })}
                </span>
              </Td>
              <Td numeric className="hidden sm:table-cell">
                <span className={["tabular font-semibold", pnlTone].join(" ")}>
                  {formatPct(pos.unrealizedPnlPct)}
                </span>
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
