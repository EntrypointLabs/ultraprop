# Hyperliquid requests

Every request this codebase makes to Hyperliquid. `src/hyperliquid.ts` is the
only place that speaks HL's `/info` dialect — it runs server-side (route
handlers / the indexer in `services/api-gateway`) so the browser never touches
`api.hyperliquid.xyz` directly. The one exception is the per-coin icon SVG,
fetched client-side straight from `app.hyperliquid.xyz`.

HL encodes numeric fields as strings on the wire; every request below parses
them to `number` at this edge.

---

## 1. `metaAndAssetCtxs` — catalog + live mark/funding context

**What it's for:** the single source of truth for the perp catalog (symbol,
size decimals, max leverage, delisted flag) and the live per-asset trading
context (mark/oracle/mid price, funding rate, prev-day price). Two call
sites reuse the identical request for two different purposes:

- `listMarkets()` reads `universe` to build the normalized `Market[]`
  catalog, dropping delisted markets.
- `fetchAssetCtxs()` zips `universe` with `assetCtxs` (index-aligned by
  position, not keyed) into a `Record<symbol, AssetCtx>` snapshot. Also used
  as the REST fallback poll (every 1s) if a subscription budget is ever
  exceeded — see §2.

**Endpoint:** `POST https://api.hyperliquid.xyz/info`

**Request body:**

```json
{ "type": "metaAndAssetCtxs" }
```

**Response shape** (`[meta, assetCtxs]` tuple, `assetCtxs[i]` corresponds to `universe[i]`):

```ts
type MetaAndAssetCtxs = [{ universe: UniverseEntry[] }, RawAssetCtx[]];

interface UniverseEntry {
  name: string;                    // bare ticker, e.g. "BTC"
  szDecimals: number | string;
  maxLeverage: number | string;
  onlyIsolated?: boolean;
  isDelisted?: boolean;
}

interface RawAssetCtx {
  markPx: string;
  oraclePx: string;
  midPx: string | null;            // thin books can omit a mid
  funding: string;
  prevDayPx: string;                // only 24h reference HL gives per-coin
}
```

**Called from:** `HyperliquidAdapter.listMarkets()`, `fetchAssetCtxs()`
(`src/hyperliquid.ts:182`, `:356`). The default call returns crypto perps
only — the equity-index dex needs an explicit `dex` param, so equities are
excluded by construction.

---

## 2. `activeAssetCtx` — live mark/funding stream (WebSocket)

**What it's for:** the live feed that drives the trading UI's mark price,
oracle price, mid, funding rate, and 24h change. One socket subscribes to
every live market's `activeAssetCtx` channel; incoming pushes are coalesced
in-memory and flushed as a batched `MarkTick[]` at most every 250ms (~4Hz),
so a fast adverse move reaches live PnL within one flush window instead of
lagging up to a full second behind.

**Endpoint:** `wss://api.hyperliquid.xyz/ws`

**Subscribe message** (sent once per market on connect open):

```json
{
  "method": "subscribe",
  "subscription": { "type": "activeAssetCtx", "coin": "BTC" }
}
```

**Push shape received:**

```ts
interface ActiveAssetCtxMsg {
  channel?: string;
  data?: {
    coin?: string;
    ctx?: Partial<RawAssetCtx>;   // same RawAssetCtx shape as §1
  };
}
```

**Called from:** `HyperliquidAdapter.subscribeMarks()` (`src/hyperliquid.ts:202`).

**Operational notes:**
- HL caps a single connection at 1000 subscriptions (`WS_SUBSCRIPTION_LIMIT`); the live catalog (~179 crypto perps) sits well under that.
- If the catalog ever exceeds the cap, this falls back to polling §1 (`metaAndAssetCtxs`) every 1s instead of subscribing.
- Reconnects with a 2s backoff and re-subscribes on drop.
- There is no separate funding-stream request — funding rides inline on `activeAssetCtx`. `subscribeFunding()` is a typed no-op for the `VenueAdapter` interface today.

---

## 3. `candleSnapshot` — OHLCV history

**What it's for:** chart history for one market/interval/time-range,
consumed by `HLCandleChart.tsx`.

**Endpoint:** `POST https://api.hyperliquid.xyz/info`

**Request body:**

```ts
{
  type: "candleSnapshot",
  req: {
    coin: string,       // bare ticker, e.g. "BTC" or "kPEPE" — venue prefix stripped by the caller
    interval: string,   // e.g. "1m", "1h"
    startTime: number,  // epoch ms
    endTime: number,    // epoch ms
  }
}
```

**Response shape:**

```ts
interface RawCandle {
  t: number;   // open time, epoch ms
  T: number;   // close time, epoch ms
  o: string; h: string; l: string; c: string; v: string;
}
```

parsed into:

```ts
interface Candle {
  t: number; T: number;
  open: number; high: number; low: number; close: number; volume: number;
}
```

**Called from:** `fetchCandles()` (`src/hyperliquid.ts:388`). HL caps a single response at 5000 candles.

---

## 4. Per-coin icon SVG (client-side, not through `/info`)

**What it's for:** the brand icon shown on asset rows/badges in the trader
UI. This is the one request that bypasses the server-side adapter and hits
Hyperliquid directly from the browser — it's a static asset fetch, not the
`/info` API, so there's no key/rate-limit exposure to avoid.

**Endpoint:** `GET https://app.hyperliquid.xyz/coins/{base}.svg`

**Request:** no body; `{base}` is the bare ticker with any `k`-prefix
("1000×" perps like `kPEPE`, `kBONK`) stripped, since HL doesn't serve
separate art for those and they reuse the base coin's icon.

**Response:** raw SVG bytes (not JSON). On fetch failure the UI falls back
to a hand-tuned brand chip (BTC/ETH/SOL) or a hashed-color initials chip.

**Called from:** `iconUrl()` in `apps/trader/components/ui/AssetIcon.tsx:60`.

---

## Not yet called

Referenced in the venue-fidelity research (`.claude/plans/trading-venues/research/`)
for later phases but not fired by any code today:

- `meta` with `marginTables` — per-market margin tier steps (Phase 4: fidelity funding/fees/liquidation).
- `predictedFundings` — forward-looking funding rate, vs. the trailing `funding` field currently read off `assetCtx`.
- `perpDexs` — enumerates the equity-index dex this integration deliberately excludes.

## Official references

- [Info endpoint — Perpetuals](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals)
- [WebSocket subscriptions](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions)
- [Rate limits & user limits](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits)
- [Tick and lot size](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size)
- [Funding](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding)
- [Liquidations](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/liquidations)
- [Margin tiers](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/margin-tiers)
- [Fees](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees)
