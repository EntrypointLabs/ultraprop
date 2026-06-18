import { describe, expect, it } from "vitest";
import { accountHandle } from "./identity";

const ADDR_A = "0x1234567890abcdef1234567890abcdef12345678";
const ADDR_B = "0xfedcba0987654321fedcba0987654321fedcba09";

const HANDLE_RE = /^[a-z]+_[a-z0-9]{2}$/;

describe("accountHandle", () => {
  it("is deterministic — same address yields the same handle every call", () => {
    expect(accountHandle(ADDR_A)).toBe(accountHandle(ADDR_A));
    expect(accountHandle(ADDR_B)).toBe(accountHandle(ADDR_B));
  });

  it("is case-insensitive — checksummed and lowercased forms map to one handle", () => {
    expect(accountHandle(ADDR_A.toUpperCase())).toBe(accountHandle(ADDR_A));
  });

  it("ignores surrounding whitespace", () => {
    expect(accountHandle(`  ${ADDR_A}  `)).toBe(accountHandle(ADDR_A));
  });

  it("matches the {word}_{2char} shape, e.g. rabbit_mx", () => {
    expect(accountHandle(ADDR_A)).toMatch(HANDLE_RE);
    expect(accountHandle(ADDR_B)).toMatch(HANDLE_RE);
  });

  it("distinguishes different addresses", () => {
    expect(accountHandle(ADDR_A)).not.toBe(accountHandle(ADDR_B));
  });

  it("never throws on an empty address — falls back to a constant", () => {
    expect(accountHandle("")).toBe("trader");
    expect(accountHandle("   ")).toBe("trader");
  });

  it("stays low-collision across many distinct addresses", () => {
    const handles = new Set<string>();
    const count = 2000;
    for (let i = 0; i < count; i++) {
      handles.add(accountHandle(`0x${i.toString(16).padStart(40, "0")}`));
    }
    // Far better than 50% unique; the suffix widens the space well past the
    // word-list size so most distinct addresses get distinct handles.
    expect(handles.size).toBeGreaterThan(count * 0.9);
  });
});
