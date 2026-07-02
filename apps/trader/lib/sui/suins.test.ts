import { describe, expect, it, vi } from "vitest";

// suins.ts is server-only and pulls the gRPC client at import; neither is needed
// to exercise the pure label validator, so stub them and load just the module.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/sui/client", () => ({ getGrpcClient: () => ({}) }));

import { normalizeLabel, SuiNsError } from "./suins";

/**
 * `normalizeLabel` is the only client-visible gate before a firm-paid on-chain
 * mint, so its validation/normalization matrix is pinned here: casing, trimming,
 * the 3–63 length bounds, and SuiNS's `[a-z0-9-]`-no-edge-hyphen rule.
 */
describe("normalizeLabel", () => {
  it("lowercases and trims a valid label", () => {
    expect(normalizeLabel("  Alice  ")).toBe("alice");
    expect(normalizeLabel("Bob-123")).toBe("bob-123");
  });

  it("accepts the 3- and 63-character boundaries", () => {
    expect(normalizeLabel("abc")).toBe("abc");
    const max = "a".repeat(63);
    expect(normalizeLabel(max)).toBe(max);
  });

  it.each(["", "ab", "  a  "])("rejects too-short input %j", (input) => {
    expect(() => normalizeLabel(input)).toThrow(SuiNsError);
    expect(() => normalizeLabel(input)).toThrow(/at least 3 characters/);
  });

  it("rejects a label longer than 63 characters", () => {
    expect(() => normalizeLabel("a".repeat(64))).toThrow(SuiNsError);
  });

  it.each([
    "-abc",
    "abc-",
    "a b",
    "a/b",
    "café",
    "UPPER!",
  ])("rejects invalid characters or edge hyphens %j", (input) => {
    expect(() => normalizeLabel(input)).toThrow(SuiNsError);
  });
});
