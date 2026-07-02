"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Username {
  /** The minted SuiNS subname, e.g. `gifted.ultraprop.sui`. */
  displayName: string;
  /** The `SuinsRegistration` NFT object id backing it. */
  subnameNftId: string;
}

// Addresses reach us in mixed case (a route param, Privy's wallet), but the
// ledger stores them lowercased — so key the cache lowercased too, or a claim
// keyed by one casing wouldn't refresh a read keyed by another.
const usernameKey = (wallet: string | null) =>
  ["username", wallet?.toLowerCase() ?? null] as const;

/**
 * The username (minted subname + backing NFT) an arbitrary wallet has set, or
 * null. Public read — the profile header uses it for any wallet it's viewing,
 * not just the signed-in one.
 */
export function useUsername(wallet: string | null) {
  return useQuery({
    queryKey: usernameKey(wallet),
    enabled: Boolean(wallet),
    queryFn: async (): Promise<Username | null> => {
      const res = await fetch(
        `/api/account/username?owner=${encodeURIComponent(wallet as string)}`,
      );
      // Don't collapse a failed read into "no username" — throw so React Query
      // surfaces an error state (and retries) instead of caching a false null
      // that would render the fallback handle as if nothing were claimed.
      if (!res.ok) {
        throw new Error(`Couldn't read username (${res.status}).`);
      }
      const body = (await res.json().catch(() => ({}))) as {
        username?: Username | null;
      };
      return body.username ?? null;
    },
    staleTime: 60_000,
  });
}

export interface AvailabilityResult {
  available: boolean;
  /** The full name being checked, when the label is valid. */
  name?: string;
  /** Why it can't be claimed (invalid or taken), when not available. */
  reason?: string | null;
}

/**
 * Whether `label.<parent>` is free to claim. Pass a debounced label; the query
 * only fires for plausibly-valid lengths so we don't hit the chain on every
 * keystroke. The server is the authority on both validity and availability.
 */
export function useUsernameAvailability(label: string) {
  const normalized = label.trim().toLowerCase();
  return useQuery({
    queryKey: ["username-availability", normalized] as const,
    enabled: normalized.length >= 3,
    queryFn: async (): Promise<AvailabilityResult> => {
      const res = await fetch(
        `/api/account/username/availability?label=${encodeURIComponent(normalized)}`,
      );
      const body = (await res
        .json()
        .catch(() => ({}))) as AvailabilityResult & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "Couldn't check that username.");
      }
      return body;
    },
    staleTime: 15_000,
  });
}

export interface ClaimUsernameInput {
  suiAddress: string;
  label: string;
}

/**
 * Mint `label.<parent>` as the trader's username. Sends the Privy access token
 * so the server can verify the caller owns the wallet, then the firm signs and
 * pays for the on-chain mint. On success the viewed profile's username refreshes.
 */
export function useClaimUsername() {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ClaimUsernameInput): Promise<Username> => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Your session expired. Please sign in again.");
      }
      const res = await fetch("/api/account/username", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          suiAddress: input.suiAddress,
          label: input.label,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        username?: Username;
      };
      // A username in the body is the only success. Everything else — including a
      // 202 "minted, still finalizing on-chain" — carries a message to surface;
      // re-claiming the same name then records it idempotently (no second mint).
      if (res.ok && body.username) return body.username;
      throw new Error(body.error ?? "We couldn't mint your username.");
    },
    onSuccess: (username, input) => {
      queryClient.setQueryData(usernameKey(input.suiAddress), username);
      queryClient.invalidateQueries({
        queryKey: usernameKey(input.suiAddress),
      });
    },
  });
}
