import { describe, expect, it } from "vitest";
import { userVaultId } from "./auth";

/**
 * BLK-4: a signed-in trader's per-user vault id is derived deterministically
 * from their wallet address — lowercased and stripped to [a-z0-9] so the id is
 * route-safe and stable regardless of the address's hex casing.
 */
describe("userVaultId", () => {
  it("prefixes vault_ and lowercases the address", () => {
    expect(userVaultId("0xABCdef123")).toBe("vault_0xabcdef123");
  });

  it("is casing-stable — mixed-case and lowercase map to the same id", () => {
    const addr = "0x9A4F2C1E7B8D3056";
    expect(userVaultId(addr)).toBe(userVaultId(addr.toLowerCase()));
  });

  it("strips non-alphanumerics so the id is route-safe", () => {
    expect(userVaultId("0x12:34/56")).toBe("vault_0x123456");
  });
});
