import type { TradeSettledEvent } from "@shared/events";
import type { EquityPoint, MarketId, TradeRecord } from "@/lib/mock/types";
import { getJsonRpcClient } from "./client";
import { publicSuiConfig } from "./config";

/**
 * Reconstructs a trader's realized trade history from the on-chain `TradeSettled`
 * event log — the device-independent record. `queryEvents` can filter by event
 * TYPE but not by an event field, so we page the package's `TradeSettled` log and
 * keep the entries for this account. For the closed-beta volume an on-demand read
 * is plenty; a standing indexer-into-Postgres is the later scale-up.
 */

/** USD/price/leverage fields are emitted as u64 fixed-point at 1e6. */
const FIXED_POINT = 1e6;
const PAGE_LIMIT = 50;
/** Safety cap so a misconfigured query can never page the whole chain. */
const MAX_PAGES = 40;

const CLOSE_REASONS = ["manual", "tp", "sl", "liquidation"] as const;

function toUsd(raw: string): number {
  return Number(raw) / FIXED_POINT;
}

/** Maps one on-chain `TradeSettled` event into the client's `TradeRecord`. */
function toTradeRecord(json: TradeSettledEvent, txDigest: string): TradeRecord {
  const exit = toUsd(json.exit_price);
  return {
    id: `onchain-${json.account_id}-${json.seq}`,
    symbol: `${json.venue}:${json.market}` as MarketId,
    side: json.side === 1 ? "short" : "long",
    sizeUsd: toUsd(json.size_usd),
    // The event carries the settled fill, not a separate oracle mid; the realized
    // PnL is already net of fees/funding, so the fill is the faithful anchor.
    oracleMid: exit,
    fill: exit,
    slippageBps: 0,
    feeUsd: toUsd(json.entry_fee),
    venue: json.venue,
    realizedPnl: (json.is_win ? 1 : -1) * toUsd(json.pnl),
    entryPrice: toUsd(json.entry_price),
    leverage: toUsd(json.leverage),
    ts: Number(json.timestamp_ms),
    txDigest,
    liquidated: json.close_reason === 3,
    closedBy: CLOSE_REASONS[json.close_reason] ?? "manual",
  };
}

export interface AccountTradeHistory {
  /** realized closes, newest first (matches the cockpit's trade-list order) */
  trades: TradeRecord[];
  /** realized equity anchors from each trade's `equity_after`, oldest first */
  equityCurve: EquityPoint[];
}

export async function queryAccountTrades(
  accountId: string,
): Promise<AccountTradeHistory> {
  // `TradeSettled` is introduced by the upgrade, so its type tag uses the latest
  // package version id, not the original.
  const { packageIdLatest } = publicSuiConfig();
  if (!packageIdLatest) return { trades: [], equityCurve: [] };

  const eventType = `${packageIdLatest}::user_account::TradeSettled`;
  const wanted = accountId.trim().toLowerCase();
  const client = getJsonRpcClient();

  const matched: { json: TradeSettledEvent; txDigest: string }[] = [];
  let cursor: { txDigest: string; eventSeq: string } | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await client.queryEvents({
      query: { MoveEventType: eventType },
      cursor,
      limit: PAGE_LIMIT,
      order: "ascending",
    });
    for (const event of res.data) {
      const json = event.parsedJson as TradeSettledEvent;
      if ((json.account_id ?? "").toLowerCase() === wanted) {
        matched.push({ json, txDigest: event.id.txDigest });
      }
    }
    if (!res.hasNextPage || !res.nextCursor) break;
    cursor = res.nextCursor;
  }

  // Oldest → newest by trade sequence: ascending for the equity backbone,
  // reversed for the newest-first trade list the cockpit renders.
  matched.sort((a, b) => Number(a.json.seq) - Number(b.json.seq));
  const equityCurve: EquityPoint[] = matched.map(({ json }) => ({
    ts: Number(json.timestamp_ms),
    equity: toUsd(json.equity_after),
  }));
  const trades = matched
    .map(({ json, txDigest }) => toTradeRecord(json, txDigest))
    .reverse();

  return { trades, equityCurve };
}
