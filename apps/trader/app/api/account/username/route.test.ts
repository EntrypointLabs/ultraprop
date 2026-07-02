import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level guards for username claiming — the security- and money-sensitive
 * paths that unit tests on the pure helpers can't reach: cross-wallet
 * authorization, the rate limit on firm-paid mints, and the "mint succeeded but
 * the DB write failed" recovery (F1). Every on-chain / DB dependency is mocked so
 * only the handler's own control flow is exercised.
 */
const mocks = vi.hoisted(() => {
  class PrivyAuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  class SuiNsError extends Error {
    kind: string;
    constructor(message: string, kind = "invalid") {
      super(message);
      this.kind = kind;
    }
  }
  return {
    authenticatePrivyRequest: vi.fn(),
    isUsernameClaimingEnabled: vi.fn(),
    getDb: vi.fn(),
    mintUsernameSubname: vi.fn(),
    isUsernameAvailable: vi.fn(),
    setUsername: vi.fn(),
    getUsername: vi.fn(),
    claimRateLimit: vi.fn(),
    PrivyAuthError,
    SuiNsError,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/privy-server", () => ({
  authenticatePrivyRequest: mocks.authenticatePrivyRequest,
  PrivyAuthError: mocks.PrivyAuthError,
}));
vi.mock("@/lib/sui/config", () => ({
  isUsernameClaimingEnabled: mocks.isUsernameClaimingEnabled,
}));
vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/sui/suins", () => ({
  mintUsernameSubname: mocks.mintUsernameSubname,
  isUsernameAvailable: mocks.isUsernameAvailable,
  normalizeLabel: (input: string) => {
    const label = input.trim().toLowerCase();
    if (label.length < 3) {
      throw new mocks.SuiNsError("Usernames are at least 3 characters.");
    }
    return label;
  },
  SuiNsError: mocks.SuiNsError,
}));
vi.mock("@shared/db", () => ({
  setUsername: mocks.setUsername,
  getUsername: mocks.getUsername,
  claimRateLimit: mocks.claimRateLimit,
}));

import { POST } from "./route";

function post(body: unknown) {
  return new Request("http://localhost/api/account/username", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer tok",
    },
    body: JSON.stringify(body),
  });
}

const MINTED = {
  name: "alice.ultraprop.sui",
  nftId: "0xnft",
  digest: "0xdig",
};

describe("POST /api/account/username", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isUsernameClaimingEnabled.mockReturnValue(true);
    mocks.getDb.mockReturnValue({});
    mocks.authenticatePrivyRequest.mockResolvedValue({
      userId: "user_1",
      suiAddresses: ["0xmine"],
    });
    mocks.claimRateLimit.mockResolvedValue(true);
    mocks.isUsernameAvailable.mockResolvedValue(true);
    mocks.mintUsernameSubname.mockResolvedValue(MINTED);
    mocks.setUsername.mockResolvedValue(1);
  });

  it("rejects claiming for a wallet the caller doesn't own (403) — no mint, no gas", async () => {
    const res = await POST(post({ suiAddress: "0xnotmine", label: "alice" }));
    expect(res.status).toBe(403);
    expect(mocks.claimRateLimit).not.toHaveBeenCalled();
    expect(mocks.mintUsernameSubname).not.toHaveBeenCalled();
    expect(mocks.setUsername).not.toHaveBeenCalled();
  });

  it("accepts a mixed-case address that matches after lowercasing", async () => {
    const res = await POST(post({ suiAddress: "0xMine", label: "Alice" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.username).toEqual({
      displayName: MINTED.name,
      subnameNftId: MINTED.nftId,
    });
    expect(mocks.mintUsernameSubname).toHaveBeenCalledWith("0xmine", "alice");
  });

  it("rate-limits repeated claims (429) without minting", async () => {
    mocks.claimRateLimit.mockResolvedValue(false);
    const res = await POST(post({ suiAddress: "0xmine", label: "alice" }));
    expect(res.status).toBe(429);
    expect(mocks.mintUsernameSubname).not.toHaveBeenCalled();
  });

  it("returns the minted identity when the mint succeeds but the DB write fails (F1)", async () => {
    mocks.setUsername.mockRejectedValue(new Error("db down"));
    const res = await POST(post({ suiAddress: "0xmine", label: "alice" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.username).toEqual({
      displayName: MINTED.name,
      subnameNftId: MINTED.nftId,
    });
    expect(body.digest).toBe(MINTED.digest);
  });

  it("surfaces 409 with the minted payload when the owner has no account", async () => {
    mocks.setUsername.mockResolvedValue(0);
    const res = await POST(post({ suiAddress: "0xmine", label: "alice" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.username).toEqual({
      displayName: MINTED.name,
      subnameNftId: MINTED.nftId,
    });
  });

  it("maps a 'taken' SuiNsError from the mint to 409 without recording", async () => {
    mocks.mintUsernameSubname.mockRejectedValue(
      new mocks.SuiNsError("That username is taken. Try another.", "taken"),
    );
    const res = await POST(post({ suiAddress: "0xmine", label: "alice" }));
    expect(res.status).toBe(409);
    expect(mocks.setUsername).not.toHaveBeenCalled();
  });

  it("maps a 'pending' SuiNsError (minted, still propagating) to 202 — not a 'taken' retry", async () => {
    mocks.mintUsernameSubname.mockRejectedValue(
      new mocks.SuiNsError("finalizing on-chain", "pending"),
    );
    const res = await POST(post({ suiAddress: "0xmine", label: "alice" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.pending).toBe(true);
    // Must NOT run the availability re-check that would mislabel the user's own
    // fresh name as "taken".
    expect(mocks.isUsernameAvailable).not.toHaveBeenCalled();
    expect(mocks.setUsername).not.toHaveBeenCalled();
  });

  it("returns 503 when username claiming is disabled — before touching auth", async () => {
    mocks.isUsernameClaimingEnabled.mockReturnValue(false);
    const res = await POST(post({ suiAddress: "0xmine", label: "alice" }));
    expect(res.status).toBe(503);
    expect(mocks.authenticatePrivyRequest).not.toHaveBeenCalled();
  });

  it("propagates a PrivyAuthError's status", async () => {
    mocks.authenticatePrivyRequest.mockRejectedValue(
      new mocks.PrivyAuthError("bad token", 401),
    );
    const res = await POST(post({ suiAddress: "0xmine", label: "alice" }));
    expect(res.status).toBe(401);
  });
});
