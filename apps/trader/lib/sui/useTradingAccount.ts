"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { suiWalletAddress } from "@/lib/auth";
import { getGraphQLClient } from "@/lib/sui/client";
import { isSuiConfigured, type TierName } from "@/lib/sui/config";
import {
  type AccountSummary,
  getAccountSummary,
  getAccountTier,
  getTradingAccountId,
} from "@/lib/sui/propfirm";

const queryKey = (suiAddress: string | null) =>
  ["trading-account", suiAddress] as const;

/**
 * Reads whether `suiAddress` already owns a trading account, returning its id or
 * null. Reads straight from chain (the package id is public), so it needs no
 * server round-trip. Disabled until the wallet exists and the package is
 * configured.
 */
export function useTradingAccount(suiAddress: string | null) {
  return useQuery({
    queryKey: queryKey(suiAddress),
    enabled: Boolean(suiAddress) && isSuiConfigured(),
    queryFn: () =>
      getTradingAccountId(getGraphQLClient(), suiAddress as string),
    staleTime: 30_000,
  });
}

/**
 * Reads the on-chain tier of an existing account. Returns null until the
 * account id is known. Enabled only once we have an account id and the package
 * is configured, so it never fires for users without an account.
 */
export function useAccountTier(accountId: string | null) {
  return useQuery<TierName | null>({
    queryKey: ["account-tier", accountId] as const,
    enabled: Boolean(accountId) && isSuiConfigured(),
    queryFn: () => getAccountTier(getGraphQLClient(), accountId as string),
    staleTime: 30_000,
  });
}

/**
 * Reads the authoritative on-chain account state (realized equity, the rule
 * floors, lifecycle status, tier, breach count) for an existing account. Polls
 * every ~6s so it tracks the executor's writes (each realized close → `log_trade`,
 * each pass/fail/breach → status flip) without a manual refetch. Disabled until
 * the account id is known and the package is configured, so it never fires for
 * users without an account.
 */
export function useAccountSummary(accountId: string | null) {
  return useQuery<AccountSummary | null>({
    queryKey: ["account-summary", accountId] as const,
    enabled: Boolean(accountId) && isSuiConfigured(),
    queryFn: () => getAccountSummary(getGraphQLClient(), accountId as string),
    refetchInterval: 6_000,
    staleTime: 5_000,
  });
}

export interface CreatedAccount {
  accountId: string;
  created: boolean;
  digest?: string;
}

/**
 * Opens the trader's on-chain account via the firm-signed onboarding endpoint.
 * Sends the Privy access token so the server can verify the caller owns the
 * wallet before committing the firm to a funded allocation.
 */
export function useCreateAccount() {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suiAddress: string): Promise<CreatedAccount> => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Your session expired. Please sign in again.");
      }
      const res = await fetch("/api/account", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ suiAddress }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      } & Partial<CreatedAccount>;
      if (!res.ok || !body.accountId) {
        throw new Error(
          body.error ?? "We couldn't open your account. Please try again.",
        );
      }
      return {
        accountId: body.accountId,
        created: Boolean(body.created),
        digest: body.digest,
      };
    },
    onSuccess: (_data, suiAddress) => {
      queryClient.invalidateQueries({ queryKey: queryKey(suiAddress) });
    },
  });
}

/**
 * Resolves the signed-in trader's on-chain account summary end-to-end: Privy
 * session → Sui address → account id → `getAccountSummary` (polled). The cockpit
 * and the trade form both read this so the verifiable equity/status/floors and
 * the trade gate agree on one source of truth. All fields are null/undefined
 * until the account is known and configured; consumers fall back to the engine
 * overlay alone in that window.
 */
export function useOnchainAccountSummary() {
  const { user } = usePrivy();
  return useOnchainAccountSummaryFor(suiWalletAddress(user));
}

/**
 * Same as {@link useOnchainAccountSummary} but for an ARBITRARY wallet address
 * (the public chain is readable by anyone), so a profile page can show the
 * verifiable status / equity / tier / floors of the wallet it's viewing — not
 * just the signed-in user. Returns nulls until that wallet's account is known
 * and the package is configured.
 */
export function useOnchainAccountSummaryFor(address: string | null) {
  const { data: accountId } = useTradingAccount(address);
  const summary = useAccountSummary(accountId ?? null);
  return {
    accountId: accountId ?? null,
    summary: summary.data ?? null,
    isLoading: summary.isLoading,
  };
}

/**
 * Re-enters the trader's Failed/Suspended account into evaluation on the same
 * tier via the firm-signed `reactivate` endpoint. Sends the Privy access token
 * so the server can confirm the caller owns the account before the firm signs.
 */
export function useReactivateAccount() {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string): Promise<{ digest: string }> => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Your session expired. Please sign in again.");
      }
      const res = await fetch("/api/account/reactivate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ accountId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        digest?: string;
      };
      if (!res.ok || !body.digest) {
        throw new Error(
          body.error ??
            "We couldn't re-enter the evaluation. Please try again.",
        );
      }
      return { digest: body.digest };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-summary"] });
    },
  });
}

export interface AccountSetup {
  ready: boolean;
  authenticated: boolean;
  suiAddress: string | null;
  accountId: string | null;
  /** True while we don't yet know whether an account exists. */
  checking: boolean;
  /** Authenticated, but the embedded wallet hasn't been provisioned yet. */
  provisioning: boolean;
  /** Authenticated, wallet ready, no trading account exists. Drives the
   * "setup incomplete" indicator; only true once we've actually confirmed it. */
  needsSetup: boolean;
  hasAccount: boolean;
}

/**
 * The trader's onboarding state, derived from their Privy session and on-chain
 * account. Shared by the settings surface and the nav indicator so "you haven't
 * finished setting up" is decided in exactly one place.
 */
export function useAccountSetup(): AccountSetup {
  const { ready, authenticated, user } = usePrivy();
  const suiAddress = suiWalletAddress(user);
  const account = useTradingAccount(suiAddress);

  const configured = isSuiConfigured();
  const hasAccount = Boolean(account.data);
  const checking =
    !ready ||
    (authenticated && configured && Boolean(suiAddress) && account.isLoading);
  const needsSetup =
    ready && authenticated && configured && !checking && !hasAccount;

  return {
    ready,
    authenticated,
    suiAddress,
    accountId: account.data ?? null,
    checking,
    provisioning: authenticated && !suiAddress,
    needsSetup,
    hasAccount,
  };
}
