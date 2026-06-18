import { describe, expect, it } from "vitest";
import { isSuiId, suiAddressUrl, suiObjectUrl } from "./explorer";

/**
 * MIN-9: a "Verify on-chain" link must only render for a REAL Sui object id /
 * address (0x-prefixed hex), never a mock placeholder like "vault_starter_001",
 * and must point at a LIVE explorer host (suiscan.xyz). `isSuiId` is the gate;
 * the URL builders return null for a non-id so callers suppress the link.
 */
describe("isSuiId", () => {
  it("accepts 0x-prefixed hex of 1..64 digits", () => {
    expect(isSuiId("0x6")).toBe(true);
    expect(
      isSuiId(
        "0x7c2e9a4f1b6d8053ae12c4b7d9f0a2c3e5d7b8f1a3c5e7d9b1f3a5c7e9d1b3a5",
      ),
    ).toBe(true);
    expect(isSuiId("0xABCDEF")).toBe(true);
  });

  it("rejects mock placeholders and non-hex ids", () => {
    expect(isSuiId("vault_starter_001")).toBe(false);
    expect(isSuiId("vault_basic_001")).toBe(false);
    expect(isSuiId("satoshi.sui")).toBe(false);
    expect(isSuiId("0x")).toBe(false); // no hex digits
    expect(isSuiId("0xZZZ")).toBe(false); // non-hex
    expect(isSuiId(null)).toBe(false);
    expect(isSuiId(undefined)).toBe(false);
    expect(isSuiId("")).toBe(false);
  });

  it("rejects an over-long id (more than 64 hex digits)", () => {
    expect(isSuiId(`0x${"a".repeat(65)}`)).toBe(false);
  });
});

describe("suiObjectUrl / suiAddressUrl", () => {
  it("builds a live suiscan.xyz url for a real id", () => {
    const url = suiObjectUrl("0x6");
    expect(url).not.toBeNull();
    expect(url).toContain("suiscan.xyz");
    expect(url).toContain("/object/0x6");
    expect(url).not.toContain("suiexplorer.com");
  });

  it("builds an account url for a real address", () => {
    const url = suiAddressUrl("0xabc123");
    expect(url).toContain("suiscan.xyz");
    expect(url).toContain("/account/0xabc123");
  });

  it("returns null for a mock placeholder so the link is suppressed", () => {
    expect(suiObjectUrl("vault_starter_001")).toBeNull();
    expect(suiAddressUrl("vault_starter_001")).toBeNull();
    expect(suiObjectUrl(null)).toBeNull();
    expect(suiAddressUrl(undefined)).toBeNull();
  });
});
