import {
  accountExists,
  findOpenPositionByClientId,
  insertOpenPosition,
  type PositionRow,
  selectOpenPositionsByAccount,
} from "@shared/db";
import { applyFill } from "@shared/sim-core";
import { fetchAssetCtxs } from "@shared/venues";
import { NextResponse } from "next/server";
import {
  isAccountId,
  readJson,
  requireTrader,
  serverError,
} from "@/app/api/_lib/auth";
import { getDb } from "@/lib/db";
import { getMarket } from "@/lib/mock/markets";
import { getGraphQLClient } from "@/lib/sui/client";
import { publicSuiConfig } from "@/lib/sui/config";
import { mirrorAccount } from "@/lib/sui/ledger";
import { getAccountTier, getTradingAccountId } from "@/lib/sui/propfirm";

export const runtime = "nodejs";

/**
 * Records a freshly opened position in the server-owned ledger. The server
 * computes its OWN fill against the live venue mark — the entry price is never
 * taken from the client — so when the matching close arrives the realized PnL is
 * recomputed off a trusted entry. Idempotent on `(accountId, clientTradeId)`.
 *
 * Backward-compatible: with no `DATABASE_URL` the ledger is disabled and the
 * route is a soft no-op (`recorded: false`), so the client falls back to the
 * pure-sim overlay exactly as before.
 */
interface OpenBody {
  accountId: string;
  /** the client's own position id, used to correlate the later close. */
  clientTradeId: string;
  /** bare coin ticker, e.g. "BTC". */
  market: string;
  side: "long" | "short";
  /** position notional in USD (collateral × leverage). */
  sizeUsd: number;
  leverage: number;
  marginMode: "isolated" | "cross";
  takeProfit?: number | null;
  stopLoss?: number | null;
}

/** A trader's open position, as returned for cross-device rehydration. The live
 * mark, unrealized PnL and liquidation price are recomputed by the engine after
 * load, so they are intentionally absent here. */
export interface OpenPositionDto {
  id: string;
  symbol: string;
  side: "long" | "short";
  sizeUsd: number;
  entryPrice: number;
  leverage: number;
  marginMode: "isolated" | "cross";
  entryFeeUsd: number;
  fundingPaid: number;
  takeProfit: number | null;
  stopLoss: number | null;
  openedAt: number;
  lastFundedAt: number;
}

function toOpenPositionDto(row: PositionRow): OpenPositionDto {
  return {
    // Restore the client's original position id so bracket/close correlation and
    // the bridge's idempotency ledger line up with the rehydrated position.
    id: row.clientTradeId ?? row.id,
    symbol: row.marketId,
    side: row.side as "long" | "short",
    sizeUsd: Number(row.sizeUsd),
    entryPrice: Number(row.entryPrice),
    leverage: Number(row.leverage),
    marginMode: row.marginMode as "isolated" | "cross",
    entryFeeUsd: Number(row.entryFeeUsd),
    fundingPaid: Number(row.fundingPaid),
    takeProfit: row.takeProfit != null ? Number(row.takeProfit) : null,
    stopLoss: row.stopLoss != null ? Number(row.stopLoss) : null,
    openedAt: row.openedAt.getTime(),
    lastFundedAt: (row.lastFundedAt ?? row.openedAt).getTime(),
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** The caller's linked wallet that owns `accountId` on-chain, or null. */
async function owningAddress(
  suiAddresses: string[],
  accountId: string,
): Promise<string | null> {
  const reader = getGraphQLClient();
  const { packageId } = publicSuiConfig();
  const target = accountId.trim().toLowerCase();
  for (const owner of suiAddresses) {
    const owned = await getTradingAccountId(reader, owner, packageId);
    if (owned && owned.toLowerCase() === target) return owner;
  }
  return null;
}

export async function POST(req: Request) {
  const auth = await requireTrader(req);
  if (auth.response) return auth.response;

  const db = getDb();
  if (!db) return NextResponse.json({ recorded: false });

  const body = await readJson<OpenBody>(req);
  if (!isAccountId(body.accountId)) {
    return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
  }
  const clientTradeId = (body.clientTradeId ?? "").trim();
  const market = (body.market ?? "").trim();
  if (!clientTradeId || !market) {
    return NextResponse.json(
      { error: "Missing `clientTradeId` or `market`." },
      { status: 400 },
    );
  }
  if (body.side !== "long" && body.side !== "short") {
    return NextResponse.json(
      { error: '`side` must be "long" or "short".' },
      { status: 400 },
    );
  }
  if (
    !isFiniteNumber(body.sizeUsd) ||
    body.sizeUsd <= 0 ||
    !isFiniteNumber(body.leverage) ||
    body.leverage <= 0
  ) {
    return NextResponse.json(
      { error: "`sizeUsd` and `leverage` must be positive numbers." },
      { status: 400 },
    );
  }
  const marginMode = body.marginMode === "isolated" ? "isolated" : "cross";

  try {
    const owner = await owningAddress(auth.trader.suiAddresses, body.accountId);
    if (!owner) {
      return NextResponse.json(
        { error: "That account is not linked to your wallet." },
        { status: 403 },
      );
    }

    // Idempotent: an already-recorded open returns its id instead of duplicating.
    const existing = await findOpenPositionByClientId(
      db,
      body.accountId,
      clientTradeId,
    );
    if (existing) {
      return NextResponse.json({ recorded: true, positionId: existing.id });
    }

    // Ensure the account is mirrored so the FK resolves (covers accounts opened
    // before the ledger existed).
    if (!(await accountExists(db, body.accountId))) {
      const tier =
        (await getAccountTier(getGraphQLClient(), body.accountId)) ??
        publicSuiConfig().defaultTier;
      await mirrorAccount(body.accountId, owner, tier);
    }

    // The server's OWN fill against the live mark — never the client's entry.
    const ctxs = await fetchAssetCtxs();
    const oracleMid = Number(ctxs[market]?.markPx ?? Number.NaN);
    if (!Number.isFinite(oracleMid) || oracleMid <= 0) {
      return NextResponse.json(
        { error: "We couldn't price the open against the live market." },
        { status: 502 },
      );
    }
    const marketId = `hyperliquid:${market}`;
    const fill = applyFill(
      marketId,
      body.side,
      body.sizeUsd,
      oracleMid,
      getMarket(marketId)?.depthUsd,
    );

    const positionId = await insertOpenPosition(db, {
      accountId: body.accountId,
      clientTradeId,
      marketId,
      side: body.side,
      sizeUsd: String(body.sizeUsd),
      leverage: String(body.leverage),
      marginMode,
      entryPrice: String(fill.fill),
      entryFeeUsd: String(fill.feeUsd),
      takeProfit:
        isFiniteNumber(body.takeProfit) && body.takeProfit > 0
          ? String(body.takeProfit)
          : null,
      stopLoss:
        isFiniteNumber(body.stopLoss) && body.stopLoss > 0
          ? String(body.stopLoss)
          : null,
    });

    return NextResponse.json({
      recorded: true,
      positionId,
      entryPrice: fill.fill,
      entryFeeUsd: fill.feeUsd,
    });
  } catch (error) {
    return serverError(error, "We couldn't record the open on-chain ledger.");
  }
}

/**
 * Lists the caller's still-open positions for an account, so a fresh device can
 * rehydrate the live positions the chain can't hold. Soft-empty when the ledger
 * is disabled (no `DATABASE_URL`) — the client then shows whatever it has
 * locally. Ownership is checked the same way as the open path.
 */
export async function GET(req: Request) {
  const auth = await requireTrader(req);
  if (auth.response) return auth.response;

  const db = getDb();
  if (!db) return NextResponse.json({ positions: [] });

  const accountId = (new URL(req.url).searchParams.get("accountId") ?? "").trim();
  if (!isAccountId(accountId)) {
    return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
  }

  try {
    const owner = await owningAddress(auth.trader.suiAddresses, accountId);
    if (!owner) {
      return NextResponse.json(
        { error: "That account is not linked to your wallet." },
        { status: 403 },
      );
    }
    const rows = await selectOpenPositionsByAccount(db, accountId);
    return NextResponse.json({ positions: rows.map(toOpenPositionDto) });
  } catch (error) {
    return serverError(error, "We couldn't load your open positions.");
  }
}
