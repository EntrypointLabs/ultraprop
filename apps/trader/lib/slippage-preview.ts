import { getMarket } from "@/lib/mock/markets";
import type { MarketId, Side, SlippagePreview } from "@/lib/mock/types";
import { slippagePreview as slippagePreviewCore } from "@shared/sim-core";

export { applyFees, HL_MAKER_BPS, HL_TAKER_BPS } from "@shared/sim-core";

export interface SlippagePreviewArgs {
  marketId: MarketId;
  side: Side;
  /** order notional in USD */
  sizeUsd: number;
  /** oracle mid price in USD */
  oracleMid: number;
}

/**
 * The shared deterministic slippage model with THIS market's catalog book depth
 * injected. The pure model lives in `@shared/sim-core` so the executor service
 * shares it verbatim; the app supplies `depthUsd` from its catalog here.
 */
export function slippagePreview(args: SlippagePreviewArgs): SlippagePreview {
  return slippagePreviewCore({
    ...args,
    depthUsd: getMarket(args.marketId)?.depthUsd,
  });
}
