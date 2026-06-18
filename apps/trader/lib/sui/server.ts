import "server-only";

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64 } from "@mysten/sui/utils";
import { getSuiClient } from "./client";
import { serverSuiConfig, type TierName } from "./config";
import {
  buildOpenAccountTransaction,
  fetchEvalFee,
  getTradingAccountId,
  parseAccountCreatedId,
} from "./propfirm";

/**
 * Loads the firm's admin keypair from `SUI_ADMIN_SECRET_KEY`. Accepts the
 * bech32 form `sui keytool` exports (`suiprivkey1...`) or a base64 secret with
 * an optional leading scheme-flag byte.
 */
function loadAdminKeypair(secret: string): Ed25519Keypair {
  const value = secret.trim();
  if (value.startsWith("suiprivkey")) {
    return Ed25519Keypair.fromSecretKey(value);
  }
  const bytes = fromBase64(value);
  const raw = bytes.length === 33 ? bytes.slice(1) : bytes;
  return Ed25519Keypair.fromSecretKey(raw);
}

export interface OpenAccountResult {
  accountId: string;
  created: boolean;
  digest?: string;
}

/**
 * Onboards a trader on-chain. Account creation is firm-gated (it requires the
 * `AdminCap` and an exact evaluation-fee payment), so the firm signs and
 * sponsors it here, transferring the resulting `AccountCap` to the trader's
 * `owner` address. Idempotent: if the trader already holds an account, the
 * existing id is returned without opening a second one.
 */
export async function openTradingAccount(
  owner: string,
  tier?: TierName,
): Promise<OpenAccountResult> {
  const config = serverSuiConfig();
  const client = getSuiClient();

  const existing = await getTradingAccountId(client, owner, config.packageId);
  if (existing) return { accountId: existing, created: false };

  const keypair = loadAdminKeypair(config.adminSecretKey);
  const adminAddress = keypair.toSuiAddress();
  const chosenTier = tier ?? config.defaultTier;

  const evalFee = await fetchEvalFee(client, adminAddress, chosenTier, config);

  const { data: coins } = await client.getCoins({
    owner: adminAddress,
    coinType: config.usdcType,
  });
  if (coins.length === 0) {
    throw new Error(
      "Onboarding is temporarily unavailable: the firm wallet holds no USDC to cover the evaluation fee.",
    );
  }
  const total = coins.reduce((sum, c) => sum + BigInt(c.balance), 0n);
  if (total < evalFee) {
    throw new Error(
      "Onboarding is temporarily unavailable: the firm wallet has insufficient USDC for the evaluation fee.",
    );
  }

  const tx = buildOpenAccountTransaction({
    config,
    owner,
    tier: chosenTier,
    evalFee,
    usdcCoinIds: coins.map((c) => c.coinObjectId),
  });
  tx.setSender(adminAddress);

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEvents: true, showEffects: true },
  });

  if (result.effects?.status.status !== "success") {
    throw new Error(
      `On-chain account creation failed: ${result.effects?.status.error ?? "unknown error"}`,
    );
  }

  const accountId =
    parseAccountCreatedId(result.events, owner, config.packageId) ??
    (await getTradingAccountId(client, owner, config.packageId));
  if (!accountId) {
    throw new Error(
      "Account was created on-chain but its id could not be resolved.",
    );
  }

  return { accountId, created: true, digest: result.digest };
}
