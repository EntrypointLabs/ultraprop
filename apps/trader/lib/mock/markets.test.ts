import { describe, expect, it } from "vitest";
import { parseSide, resolveMarketId } from "./markets";

/**
 * MAJ-12: deep-link `?symbol=`/`?side=` resolution. `resolveMarketId` must map a
 * bare venue ticker ("BTC") to the catalog MarketId ("hyperliquid:BTC") and
 * accept a fully-qualified id verbatim; `parseSide` narrows to a valid literal.
 * Both return null for anything unresolvable so a stray param is ignored.
 */
describe("resolveMarketId", () => {
  it("resolves a bare ticker to the venue-qualified MarketId", () => {
    expect(resolveMarketId("BTC")).toBe("hyperliquid:BTC");
    expect(resolveMarketId("ETH")).toBe("hyperliquid:ETH");
    expect(resolveMarketId("SOL")).toBe("hyperliquid:SOL");
  });

  it("is case-insensitive on the bare ticker", () => {
    expect(resolveMarketId("btc")).toBe("hyperliquid:BTC");
    expect(resolveMarketId("Eth")).toBe("hyperliquid:ETH");
  });

  it("accepts a fully-qualified MarketId verbatim", () => {
    expect(resolveMarketId("hyperliquid:BTC")).toBe("hyperliquid:BTC");
    expect(resolveMarketId("HYPERLIQUID:SOL")).toBe("hyperliquid:SOL");
  });

  it("returns null for an unknown ticker or empty/absent value", () => {
    expect(resolveMarketId("DOGECOIN_NOPE")).toBeNull();
    expect(resolveMarketId("")).toBeNull();
    expect(resolveMarketId("   ")).toBeNull();
    expect(resolveMarketId(null)).toBeNull();
    expect(resolveMarketId(undefined)).toBeNull();
  });
});

describe("parseSide", () => {
  it("narrows valid sides case-insensitively", () => {
    expect(parseSide("long")).toBe("long");
    expect(parseSide("short")).toBe("short");
    expect(parseSide("LONG")).toBe("long");
    expect(parseSide(" Short ")).toBe("short");
  });

  it("returns null for anything else", () => {
    expect(parseSide("buy")).toBeNull();
    expect(parseSide("")).toBeNull();
    expect(parseSide(null)).toBeNull();
    expect(parseSide(undefined)).toBeNull();
  });
});
