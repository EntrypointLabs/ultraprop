"use client";

import { useMemo, useState } from "react";
import {
  AssetIcon,
  Button,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
} from "@/components/ui";
import type { TradeRecord } from "@/lib/mock/types";
import { formatUsd } from "@/lib/utils";

type SortKey =
  | "ts"
  | "symbol"
  | "side"
  | "sizeUsd"
  | "fill"
  | "slippageBps"
  | "realizedPnl";
type SortDir = "asc" | "desc";

interface TradeHistoryProps {
  trades: TradeRecord[];
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

function mockCsvExport(trades: TradeRecord[]) {
  const header =
    "id,symbol,side,sizeUsd,marketPrice,fill,slippageBps,feeUsd,realizedPnl,ts";
  const rows = trades.map((t) =>
    [
      t.id,
      t.symbol,
      t.side,
      t.sizeUsd,
      t.oracleMid,
      t.fill,
      t.slippageBps,
      t.feeUsd,
      t.realizedPnl,
      new Date(t.ts).toISOString(),
    ].join(","),
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "trade_history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  const [sortKey, setSortKey] = useState<SortKey>("ts");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sideFilter, setSideFilter] = useState<"all" | "long" | "short">("all");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortDir4(key: SortKey): "asc" | "desc" | null {
    return sortKey === key ? sortDir : null;
  }

  const filtered = useMemo(() => {
    let list = [...trades];
    if (sideFilter !== "all") list = list.filter((t) => t.side === sideFilter);
    list.sort((a, b) => {
      const aVal = a[sortKey] as number | string;
      const bVal = b[sortKey] as number | string;
      if (typeof aVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return list;
  }, [trades, sortKey, sortDir, sideFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {(["all", "long", "short"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSideFilter(f)}
              className={[
                "rounded-sm px-2.5 py-1 text-xs font-medium uppercase tracking-wide transition-colors",
                sideFilter === f
                  ? "bg-violet text-white"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
              ].join(" ")}
            >
              {f === "all" ? "All" : f === "long" ? "Long" : "Short"}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mockCsvExport(filtered)}
        >
          Export CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-20 items-center justify-center text-sm text-text-faint">
          No trades match filter
        </div>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th
                sortable
                sortDir={sortDir4("ts")}
                onSort={() => toggleSort("ts")}
                className="hidden sm:table-cell"
              >
                Time
              </Th>
              <Th
                sortable
                sortDir={sortDir4("symbol")}
                onSort={() => toggleSort("symbol")}
              >
                Market
              </Th>
              <Th
                sortable
                sortDir={sortDir4("side")}
                onSort={() => toggleSort("side")}
              >
                Side
              </Th>
              <Th
                numeric
                sortable
                sortDir={sortDir4("sizeUsd")}
                onSort={() => toggleSort("sizeUsd")}
              >
                Size
              </Th>
              <Th numeric className="hidden sm:table-cell">Mkt Price</Th>
              <Th
                numeric
                sortable
                sortDir={sortDir4("fill")}
                onSort={() => toggleSort("fill")}
              >
                Fill
              </Th>
              <Th
                numeric
                sortable
                sortDir={sortDir4("slippageBps")}
                onSort={() => toggleSort("slippageBps")}
                className="hidden md:table-cell"
              >
                Impact
              </Th>
              <Th numeric className="hidden md:table-cell">Fee</Th>
              <Th
                numeric
                sortable
                sortDir={sortDir4("realizedPnl")}
                onSort={() => toggleSort("realizedPnl")}
              >
                PnL
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((trade) => {
              const isDecimal = trade.fill < 1000;
              const priceDecimals = isDecimal ? 4 : 1;
              const pnlTone =
                trade.realizedPnl > 0
                  ? "text-up"
                  : trade.realizedPnl < 0
                    ? "text-down"
                    : "text-text-muted";
              const date = new Date(trade.ts);
              const timeStr = `${date.getUTCHours().toString().padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")} UTC`;

              return (
                <Tr key={trade.id}>
                  <Td className="hidden sm:table-cell">
                    <span className="tabular text-xs text-text-muted">
                      {timeStr}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <AssetIcon symbol={trade.symbol} size={16} />
                      <span className="font-medium">{trade.symbol}</span>
                    </div>
                  </Td>
                  <Td>
                    <SideBadge side={trade.side} />
                  </Td>
                  <Td numeric>{formatUsd(trade.sizeUsd, { decimals: 0 })}</Td>
                  <Td numeric className="hidden sm:table-cell">
                    <span className="tabular text-text-muted">
                      {trade.oracleMid.toLocaleString("en-US", {
                        minimumFractionDigits: priceDecimals,
                        maximumFractionDigits: priceDecimals,
                      })}
                    </span>
                  </Td>
                  <Td numeric>
                    <span className="tabular">
                      {trade.fill.toLocaleString("en-US", {
                        minimumFractionDigits: priceDecimals,
                        maximumFractionDigits: priceDecimals,
                      })}
                    </span>
                  </Td>
                  <Td numeric className="hidden md:table-cell">
                    <Tooltip content="Size impact bps at fill">
                      <span className="tabular text-text-muted">
                        {trade.slippageBps.toFixed(1)} bps
                      </span>
                    </Tooltip>
                  </Td>
                  <Td numeric className="hidden md:table-cell">
                    <Tooltip content="Hyperliquid taker fee on the fill notional">
                      <span className="tabular text-warn">
                        {formatUsd(trade.feeUsd, { decimals: 2 })}
                      </span>
                    </Tooltip>
                  </Td>
                  <Td numeric>
                    <span
                      className={["tabular font-semibold", pnlTone].join(" ")}
                    >
                      {trade.realizedPnl === 0 ? (
                        <span className="text-text-faint">—</span>
                      ) : (
                        formatUsd(trade.realizedPnl, { sign: true })
                      )}
                    </span>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
