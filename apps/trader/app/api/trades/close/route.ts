import { fetchAssetCtxs } from "@shared/venues";
import { NextResponse } from "next/server";
import {
  isAccountId,
  readJson,
  requireTrader,
  serverError,
} from "@/app/api/_lib/auth";
import { logTrade } from "@/lib/sui/server";

export const runtime = "nodejs";

/**
 * The close payload carries only VERIFIABLE inputs. The realized PnL is NOT
 * accepted from the client; the server fetches the real venue mark, validates
 * `exitPrice` against it, and recomputes the PnL itself — so a trader can never
 * write an arbitrary equity move on-chain.
 */
interface CloseBody {
  accountId: string;
  /** the close trade's client id, used for in-process dedup */
  tradeId: string;
  venue: string;
  /** bare coin ticker, e.g. "BTC" */
  market: string;
  side: "long" | "short";
  /** closed notional in USD */
  sizeUsd: number;
  /** position entry price (client-asserted — see RESIDUAL below) */
  entryPrice: number;
  /** claimed exit price; validated against the real mark */
  exitPrice: number;
  leverage: number;
}

/** Max deviation of the claimed exit from the real venue mark before rejection. */
const EXIT_TOLERANCE = 0.015;

/**
 * In-process guard against logging the same `(accountId, tradeId)` twice within a
 * single server lifetime. LIMITATION: this is per-instance and NOT durable — a
 * cold start, a second serverless instance, or a redeploy clears it, so a
 * determined retry across instances can still double-log. Durable cross-request
 * dedup needs a server-side trade store (Phase B); this only stops same-instance
 * double-sends (re-mounts, burst ticks).
 */
const loggedCloses = new Set<string>();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Records a closed trade's realized PnL on-chain via the firm's executor cap.
 * The PnL is recomputed server-side from validated inputs (never trusted from the
 * client); the chain applies the magnitude with the sign carried by `isWin`.
 * Authenticated.
 */
export async function POST(req: Request) {
  const auth = await requireTrader(req);
  if (auth.response) return auth.response;

  const body = await readJson<CloseBody>(req);
  if (!isAccountId(body.accountId)) {
    return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
  }

  const tradeId = (body.tradeId ?? "").trim();
  if (!tradeId) {
    return NextResponse.json({ error: "Missing `tradeId`." }, { status: 400 });
  }

  const venue = (body.venue ?? "").trim();
  const market = (body.market ?? "").trim();
  if (!venue || !market) {
    return NextResponse.json(
      { error: "Missing `venue` or `market`." },
      { status: 400 },
    );
  }

  if (body.side !== "long" && body.side !== "short") {
    return NextResponse.json(
      { error: "`side` must be \"long\" or \"short\"." },
      { status: 400 },
    );
  }

  if (
    !isFiniteNumber(body.sizeUsd) ||
    body.sizeUsd <= 0 ||
    !isFiniteNumber(body.entryPrice) ||
    body.entryPrice <= 0 ||
    !isFiniteNumber(body.exitPrice) ||
    body.exitPrice <= 0
  ) {
    return NextResponse.json(
      { error: "`sizeUsd`, `entryPrice`, and `exitPrice` must be positive numbers." },
      { status: 400 },
    );
  }

  // Dedup BEFORE doing any work: a duplicate is a no-op success so the bridge
  // marks it sent and stops retrying. See `loggedCloses` for the limitation.
  const dedupKey = `${body.accountId}:${tradeId}`;
  if (loggedCloses.has(dedupKey)) {
    return NextResponse.json({ deduped: true });
  }

  // Fetch the REAL current mark from the venue server-side and validate the
  // claimed exit against it. Fail CLOSED — if the price can't be fetched or the
  // market is unknown, reject rather than trust the client's exit.
  let realMark: number;
  try {
    const ctxs = await fetchAssetCtxs();
    const ctx = ctxs[market];
    const markPx = ctx ? Number(ctx.markPx) : Number.NaN;
    if (!Number.isFinite(markPx) || markPx <= 0) {
      throw new Error(`No live mark for market "${market}".`);
    }
    realMark = markPx;
  } catch (error) {
    console.error("[trades/close] mark price fetch failed", error);
    return NextResponse.json(
      { error: "We couldn't verify the exit price against the live market." },
      { status: 502 },
    );
  }

  const deviation = Math.abs(body.exitPrice - realMark) / realMark;
  if (deviation > EXIT_TOLERANCE) {
    return NextResponse.json(
      {
        error: `Exit price ${body.exitPrice} deviates ${(deviation * 100).toFixed(
          2,
        )}% from the live mark; max ${(EXIT_TOLERANCE * 100).toFixed(1)}%.`,
      },
      { status: 400 },
    );
  }

  // Recompute the realized PRICE PnL server-side from validated inputs. This is
  // the price leg only; fees and funding are NOT recomputed here (RESIDUAL).
  const directional = body.side === "long" ? 1 : -1;
  const pricePnl =
    (body.sizeUsd * (body.exitPrice - body.entryPrice)) /
    body.entryPrice *
    directional;
  const isWin = pricePnl >= 0;
  const pnl = BigInt(Math.round(Math.abs(pricePnl) * 1e6));

  try {
    const result = await logTrade({
      accountId: body.accountId,
      isWin,
      pnl,
      venue,
      market,
    });
    loggedCloses.add(dedupKey);
    return NextResponse.json(result);
  } catch (error) {
    return serverError(error, "We couldn't record the trade on-chain.");
  }
}

/*
 * RESIDUAL TRUST GAP (closes fully only with a server-side position store / sim,
 * i.e. Phase B):
 *  - `entryPrice` is still CLIENT-ASSERTED. With no server position ledger the
 *    server has nothing to check the entry against, so the exit is validated
 *    against the real mark but the entry (and thus the PnL magnitude) can still
 *    be skewed by a fabricated entry.
 *  - Fees and funding are NOT recomputed here; only the price leg is. The
 *    engine's close folds taker fees + funding into its realized PnL, so the
 *    on-chain value here can diverge from the off-chain equity by those costs.
 */
