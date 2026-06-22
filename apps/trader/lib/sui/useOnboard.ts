"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { type SuiWalletIdentity, suiWalletIdentity } from "@/lib/auth";
import { getGraphQLClient } from "@/lib/sui/client";
import { publicSuiConfig, type TierName } from "@/lib/sui/config";
import {
  buildFaucetTransaction,
  buildPayEvalFeeTransaction,
  fetchEvalFee,
  fetchUsdcCoins,
} from "@/lib/sui/propfirm";
import {
  type PrivySuiWallet,
  type RawHashSigner,
} from "@/lib/sui/privySigner";
import { sponsorAndExecuteWithPrivy } from "@/lib/sui/sponsor";

interface OnboardResult {
  accountId: string;
  created: boolean;
  digest?: string;
}

async function postOnboard(
  token: string,
  body: Record<string, unknown>,
): Promise<OnboardResult> {
  const res = await fetch("/api/onboard", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<OnboardResult>;
  if (!res.ok || !data.accountId) {
    throw new Error(
      data.error ?? "We couldn't open your account. Please try again.",
    );
  }
  return {
    accountId: data.accountId,
    created: Boolean(data.created),
    digest: data.digest,
  };
}

/** Bundles the Privy session pieces the onboarding flow needs to sign + POST. */
function useOnboardContext() {
  const { user, getAccessToken } = usePrivy();
  const { signRawHash } = useSignRawHash();
  const wallet = suiWalletIdentity(user);

  const signer: RawHashSigner = React.useCallback(
    (hash) =>
      signRawHash({
        address: (wallet as SuiWalletIdentity).address,
        chainType: "sui",
        hash,
      }),
    [signRawHash, wallet],
  );

  return { wallet, signer, getAccessToken };
}

/**
 * Mints the exact tier eval fee of test USDC into the user's own wallet — step
 * one of the PAID path. The user signs the open faucet call with their Privy
 * Sui wallet. Returns nothing; the minted coins are then spent by `usePayAndStart`.
 */
export function useGetTestUsdc() {
  const { wallet, signer, getAccessToken } = useOnboardContext();

  return useMutation({
    mutationFn: async (tier: TierName): Promise<void> => {
      if (!wallet) {
        throw new Error("Your wallet isn't ready yet. Try again in a moment.");
      }
      const config = publicSuiConfig();
      const client = getGraphQLClient();
      const evalFee = await fetchEvalFee(client, wallet.address, tier, config);
      const tx = buildFaucetTransaction({ config, amount: evalFee });
      await sponsorAndExecuteWithPrivy({
        client,
        tx,
        wallet: wallet as PrivySuiWallet,
        signRawHash: signer,
        getAccessToken,
      });
    },
  });
}

/**
 * Pays the tier eval fee to the firm (user-signed transfer), then asks the
 * server to verify that payment and open the account — the rest of the PAID
 * path. Returns the opened account.
 */
export function usePayAndStart() {
  const { wallet, signer, getAccessToken } = useOnboardContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tier: TierName): Promise<OnboardResult> => {
      if (!wallet) {
        throw new Error("Your wallet isn't ready yet. Try again in a moment.");
      }
      const config = publicSuiConfig();
      const client = getGraphQLClient();

      const evalFee = await fetchEvalFee(client, wallet.address, tier, config);
      const coins = await fetchUsdcCoins(client, wallet.address, config.usdcType);
      const total = coins.reduce((sum, c) => sum + c.balance, 0n);
      if (total < evalFee) {
        throw new Error(
          "You don't have enough test USDC yet. Get test USDC first.",
        );
      }

      const tx = buildPayEvalFeeTransaction({
        config,
        evalFee,
        usdcCoins: coins.map((c) => ({
          objectId: c.coinObjectId,
          version: c.version,
          digest: c.digest,
        })),
      });
      const { digest } = await sponsorAndExecuteWithPrivy({
        client,
        tx,
        wallet: wallet as PrivySuiWallet,
        signRawHash: signer,
        getAccessToken,
      });

      const token = await getAccessToken();
      if (!token) throw new Error("Your session expired. Please sign in again.");
      return postOnboard(token, {
        suiAddress: wallet.address,
        tier,
        paymentDigest: digest,
      });
    },
    onSuccess: (_result, _tier) => {
      queryClient.invalidateQueries({ queryKey: ["trading-account"] });
    },
  });
}

/** Redeems an invite code for a firm-funded Starter account (no payment). */
export function useRedeemInvite() {
  const { wallet, getAccessToken } = useOnboardContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteCode: string): Promise<OnboardResult> => {
      if (!wallet) {
        throw new Error("Your wallet isn't ready yet. Try again in a moment.");
      }
      const token = await getAccessToken();
      if (!token) throw new Error("Your session expired. Please sign in again.");
      return postOnboard(token, {
        suiAddress: wallet.address,
        inviteCode,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trading-account"] });
    },
  });
}
