"use client";

import type { SuiGraphQLClient } from "@mysten/sui/graphql";
import type { Transaction } from "@mysten/sui/transactions";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import {
  executeSignedTransaction,
  normalizeSuiAddress,
  PrivySuiSigner,
  type PrivySuiWallet,
  type RawHashSigner,
} from "./privySigner";

/**
 * Builds a transaction, has the firm sponsor its gas, then user-signs and
 * executes it — the path for a trader's freshly-provisioned, zero-SUI embedded
 * wallet. The user is the sender (authorizing their own coins); the firm's admin
 * wallet is the gas owner. Returns the on-chain digest.
 */
export async function sponsorAndExecuteWithPrivy(params: {
  client: SuiGraphQLClient;
  tx: Transaction;
  wallet: PrivySuiWallet;
  signRawHash: RawHashSigner;
  getAccessToken: () => Promise<string | null>;
}): Promise<{ digest: string }> {
  const { client, tx, wallet, signRawHash, getAccessToken } = params;

  const signer = new PrivySuiSigner(wallet, signRawHash);
  // Same wallet/pubkey guard as the self-paid path: the signing key must derive
  // the wallet that is named as sender.
  if (signer.toSuiAddress() !== normalizeSuiAddress(wallet.address)) {
    throw new Error(
      "Wallet public key does not match its address; cannot sign safely.",
    );
  }

  const transactionKindBytes = toBase64(
    await tx.build({ client, onlyTransactionKind: true }),
  );

  const token = await getAccessToken();
  if (!token) throw new Error("Your session expired. Please sign in again.");

  const res = await fetch("/api/sponsor", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ suiAddress: wallet.address, transactionKindBytes }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    transactionBytes?: string;
    sponsorSignature?: string;
  };
  if (!res.ok || !data.transactionBytes || !data.sponsorSignature) {
    throw new Error(
      data.error ?? "We couldn't cover gas for that transaction.",
    );
  }

  // The server set sender + gas owner and signed as gas owner; the user
  // counter-signs the exact same bytes as sender. Both signatures execute it.
  const txBytes = fromBase64(data.transactionBytes);
  const { signature: userSignature } = await signer.signTransaction(txBytes);

  return executeSignedTransaction(client, txBytes, [
    userSignature,
    data.sponsorSignature,
  ]);
}
