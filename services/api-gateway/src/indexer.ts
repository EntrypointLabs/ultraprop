import { HyperliquidAdapter, type Market, type VenueId } from "@shared/venues";

/**
 * In-process markets store. The gateway is the ONLY venue caller (keys /
 * rate-limits / CORS stay server-side), so this is the single place a catalog is
 * fetched and cached. No DB — the catalog is rebuildable from a REST snapshot on
 * cold start (ARCHITECTURE §(b): collapse the indexer into api-gateway for v1).
 */

const CATALOG_TTL_MS = 60_000;

interface CatalogCacheEntry {
  data: Market[];
  ts: number;
}

const adapters: Record<VenueId, () => Promise<Market[]>> = {
  hyperliquid: () => new HyperliquidAdapter().listMarkets(),
  // Bybit is a later drop-in; no FE or DTO change when it lands.
  bybit: () => {
    throw new Error("bybit adapter not implemented");
  },
};

const cache = new Map<VenueId, CatalogCacheEntry>();

/**
 * The full live perp catalog for a venue, cached for 60s. A miss or a stale
 * entry triggers a fresh `listMarkets()` call; the previous snapshot is served
 * only while fresh, never as a silent fallback on error (the error propagates so
 * the route returns 500 rather than masking a venue outage).
 */
export async function getCatalog(venue: VenueId): Promise<Market[]> {
  const hit = cache.get(venue);
  if (hit && Date.now() - hit.ts < CATALOG_TTL_MS) {
    return hit.data;
  }
  const load = adapters[venue];
  if (!load) throw new Error(`unknown venue: ${venue}`);
  const data = await load();
  cache.set(venue, { data, ts: Date.now() });
  return data;
}
