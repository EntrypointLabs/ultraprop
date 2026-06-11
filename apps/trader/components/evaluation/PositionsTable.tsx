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
  /** Close a position at the current mark, booking realized P&L. */
  onClose?: (id: string) => void;
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
          <Th>Side</Th>
          <Th numeric>Size</Th>
          <Th numeric>Entry</Th>
          <Th numeric>Mark</Th>
          <Th numeric>Unr. PnL</Th>
          <Th numeric>PnL %</Th>
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
                <div className="flex items-center gap-2">
                  <AssetIcon symbol={pos.symbol} size={18} />
                  <span className="font-medium">{pos.symbol}</span>
                </div>
              </Td>
              <Td>
                <SideBadge side={pos.side} />
              </Td>
              <Td numeric>{formatUsd(pos.sizeUsd, { decimals: 0 })}</Td>
              <Td numeric>
                <span className="tabular">
                  {pos.entryPrice.toLocaleString("en-US", {
                    minimumFractionDigits: priceDecimals,
                    maximumFractionDigits: priceDecimals,
                  })}
                </span>
              </Td>
              <Td numeric>
                <span className="tabular">
                  {pos.markPrice.toLocaleString("en-US", {
                    minimumFractionDigits: priceDecimals,
                    maximumFractionDigits: priceDecimals,
                  })}
                </span>
              </Td>
              <Td numeric>
                <span className={["tabular font-semibold", pnlTone].join(" ")}>
                  {formatUsd(pos.unrealizedPnl, { sign: true })}
                </span>
              </Td>
              <Td numeric>
                <span className={["tabular font-semibold", pnlTone].join(" ")}>
                  {formatPct(pos.unrealizedPnlPct)}
                </span>
              </Td>
              <Td>
                <Button
                  variant="danger"
                  size="sm"
                  aria-label={`Close ${pos.symbol} ${pos.side} position`}
                  onClick={() => onClose?.(pos.id)}
                >
                  Close
                </Button>
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
