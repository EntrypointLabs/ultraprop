import { coinOf } from "@/lib/mock/markets";
import type { Position, TradeRecord } from "@/lib/mock/types";

/**
 * The off-chain → on-chain bridge's client transport. The paper engine drives
 * the simulation in the browser; these helpers POST realized closes and
 * evaluation outcomes to the firm-signed executor routes, which mirror them onto
 * the deployed contracts. Every call carries the trader's Privy token so the
 * route can confirm a real session before the firm spends gas.
 *
 * On-chain equity moves ONLY on realized trade closes (`log_trade`); unrealized
 * PnL is never streamed. The lone exception the engine reports directly is an
 * unrealized-equity drawdown breach, which the realized gates can't see —
 * `postBreach` suspends the account for it.
 */

/** A realized close is a trade with non-zero realized PnL or a close reason. */
export function isRealizedClose(trade: TradeRecord): boolean {
  return (
    trade.realizedPnl !== 0 ||
    trade.closedBy != null ||
    trade.liquidated === true
  );
}

type TokenGetter = () => Promise<string | null>;

async function post(
  path: string,
  token: string,
  body: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, error: data.error };
}

async function withToken(
  getToken: TokenGetter,
  send: (token: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  const { ok } = await send(token);
  return ok;
}

/**
 * Record a closed trade on-chain. Sends only VERIFIABLE inputs — the realized
 * PnL is NOT sent; the server recomputes it from these fields after validating
 * `exitPrice` against the real venue mark, so the client can never claim an
 * arbitrary PnL. `tradeId` is the close trade's id, used by the server to dedup.
 * Returns whether the call committed, so the caller only marks the trade sent on
 * success.
 */
export function postClose(
  getToken: TokenGetter,
  accountId: string,
  trade: TradeRecord,
): Promise<boolean> {
  return withToken(getToken, (token) =>
    post("/api/trades/close", token, {
      accountId,
      tradeId: trade.id,
      // The open position's id, so the server can settle against the ledger's
      // trusted entry price instead of the client-sent one.
      positionId: trade.positionId,
      venue: trade.venue,
      market: coinOf(trade.symbol),
      side: trade.side,
      sizeUsd: trade.sizeUsd,
      entryPrice: trade.entryPrice,
      exitPrice: trade.fill,
      leverage: trade.leverage,
    }),
  );
}

/**
 * Records a freshly opened position in the server ledger so the matching close
 * is settled against a server-computed entry. Best-effort and server-idempotent
 * (keyed on the position id): returns the ledger position id, or null when the
 * ledger is disabled or the call fails. The bridge attempts it once per session
 * per position.
 */
export async function postOpen(
  getToken: TokenGetter,
  accountId: string,
  position: Position,
): Promise<string | null> {
  const token = await getToken();
  if (!token) return null;
  const res = await fetch("/api/positions/open", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      accountId,
      clientTradeId: position.id,
      market: coinOf(position.symbol),
      side: position.side,
      sizeUsd: position.sizeUsd,
      leverage: position.leverage,
      marginMode: position.marginMode,
      takeProfit: position.takeProfit ?? null,
      stopLoss: position.stopLoss ?? null,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { positionId?: string };
  return typeof data.positionId === "string" ? data.positionId : null;
}

export function postPass(
  getToken: TokenGetter,
  accountId: string,
): Promise<boolean> {
  return withToken(getToken, (token) =>
    post("/api/evaluation/pass", token, { accountId }),
  );
}

export function postFail(
  getToken: TokenGetter,
  accountId: string,
): Promise<boolean> {
  return withToken(getToken, (token) =>
    post("/api/evaluation/fail", token, { accountId }),
  );
}

export function postBreach(
  getToken: TokenGetter,
  accountId: string,
): Promise<boolean> {
  return withToken(getToken, (token) =>
    post("/api/account/breach", token, { accountId }),
  );
}
