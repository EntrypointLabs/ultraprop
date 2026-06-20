/**
 * The on-chain write surface the settlement loop depends on. Mirrors the
 * executor-gated calls the app already signs in `apps/trader/lib/sui/server.ts`
 * (`logTrade` / `passEvaluation` / `failEvaluation` / `registerBreach`).
 *
 * It is an INTERFACE on purpose: the real signer reaches into the app's Sui layer
 * (`config` / `client` / `propfirm` transaction builders), which belongs in a
 * shared `@shared/sui-propfirm` package — a follow-up brick. Until that lands the
 * loop runs against `StubOnChainWriter`, so the position ledger and settlement
 * logic are fully exercised without holding a live key.
 */

export interface OnChainResult {
  digest: string;
}

export interface LogTradeParams {
  accountId: string;
  /** sign of the realized PnL; the chain applies it to equity. */
  isWin: boolean;
  /** absolute realized PnL in USDC base units (6 dp). */
  pnl: bigint;
  venue: string;
  market: string;
}

export interface OnChainWriter {
  logTrade(params: LogTradeParams): Promise<OnChainResult>;
  passEvaluation(accountId: string): Promise<OnChainResult>;
  failEvaluation(accountId: string): Promise<OnChainResult>;
  registerBreach(accountId: string): Promise<OnChainResult>;
}

/** USDC has 6 decimals on Sui; the engine works in USD floats. */
export function usdToUsdcBaseUnits(usd: number): bigint {
  return BigInt(Math.round(Math.abs(usd) * 1_000_000));
}

/**
 * A no-op writer that logs what it WOULD sign and returns a synthetic digest.
 * Lets the loop drive the full open→mark→settle→reconcile path end to end before
 * the real signer is wired in.
 */
export class StubOnChainWriter implements OnChainWriter {
  private seq = 0;

  private next(label: string, accountId: string): OnChainResult {
    this.seq += 1;
    const digest = `stub-${label}-${this.seq}`;
    console.log(`[onchain:stub] ${label} account=${accountId} -> ${digest}`);
    return { digest };
  }

  async logTrade(params: LogTradeParams): Promise<OnChainResult> {
    console.log(
      `[onchain:stub] logTrade account=${params.accountId} market=${params.market} isWin=${params.isWin} pnl=${params.pnl}`,
    );
    return this.next("logTrade", params.accountId);
  }

  async passEvaluation(accountId: string): Promise<OnChainResult> {
    return this.next("passEvaluation", accountId);
  }

  async failEvaluation(accountId: string): Promise<OnChainResult> {
    return this.next("failEvaluation", accountId);
  }

  async registerBreach(accountId: string): Promise<OnChainResult> {
    return this.next("registerBreach", accountId);
  }
}
