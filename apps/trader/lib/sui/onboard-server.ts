import "server-only";

import type { SuiClient } from "@mysten/sui/client";
import { getSuiClient } from "./client";
import { serverSuiConfig, type TierName } from "./config";
import { fetchEvalFee } from "./propfirm";
import { adminOpenAccount, type OpenAccountResult } from "./server";

/** Tiers a brand-new trader may self-select on the onboarding screen. */
export const ONBOARDABLE_TIERS: readonly TierName[] = ["starter", "basic"];

/** Lowercases and zero-pads a Sui address to its 32-byte canonical hex form. */
function normalizeAddress(address: string): string {
  const hex = (address.startsWith("0x") ? address.slice(2) : address)
    .toLowerCase()
    .padStart(64, "0");
  return `0x${hex}`;
}

function ownerAddress(owner: unknown): string | null {
  if (owner && typeof owner === "object" && "AddressOwner" in owner) {
    return (owner as { AddressOwner: string }).AddressOwner;
  }
  return null;
}

/**
 * Verifies on-chain that `paymentDigest` is a successful transaction sent by
 * `suiAddress` that moved at least `evalFee` of `usdcType` to the firm's
 * eval-funds address. Reading the recorded `balanceChanges` (rather than trusting
 * the client) is the authority for "the user actually paid": a positive USDC
 * balance change to the firm address proves funds landed there.
 *
 * RISK the operator must test on testnet: a `paymentDigest` is not bound to this
 * onboarding request, so the same payment could in principle be replayed. The
 * primary guard is the one-account-per-user check upstream — once the account
 * exists, a replay is a no-op — but a durable consumed-digest store would harden
 * this further. There is none in v1.
 */
async function verifyPayment(params: {
  client: SuiClient;
  paymentDigest: string;
  suiAddress: string;
  evalFundsAddress: string;
  usdcType: string;
  evalFee: bigint;
}): Promise<void> {
  const {
    client,
    paymentDigest,
    suiAddress,
    evalFundsAddress,
    usdcType,
    evalFee,
  } = params;

  let tx: Awaited<ReturnType<SuiClient["getTransactionBlock"]>>;
  try {
    tx = await client.getTransactionBlock({
      digest: paymentDigest,
      options: { showBalanceChanges: true, showEffects: true, showInput: true },
    });
  } catch {
    throw new Error("We couldn't find your payment on-chain. Please retry.");
  }

  if (tx.effects?.status.status !== "success") {
    throw new Error("Your payment transaction did not succeed on-chain.");
  }

  const sender = tx.transaction?.data.sender;
  if (!sender || normalizeAddress(sender) !== normalizeAddress(suiAddress)) {
    throw new Error("That payment was not sent from your wallet.");
  }

  const firm = normalizeAddress(evalFundsAddress);
  const received = (tx.balanceChanges ?? []).find(
    (change) =>
      change.coinType === usdcType &&
      ownerAddress(change.owner) != null &&
      normalizeAddress(ownerAddress(change.owner) as string) === firm &&
      BigInt(change.amount) >= evalFee,
  );
  if (!received) {
    throw new Error(
      "We couldn't confirm your evaluation fee reached the firm. Please retry.",
    );
  }
}

/**
 * PAID onboarding: the user has already signed a tx transferring their tier's
 * eval fee to the firm. We verify that payment landed, then admin-sign
 * `open_account` for them. The firm funds the on-chain `open_account` fee from
 * its own balance (the contract asserts payment == eval_fee); the user's
 * transfer is the off-chain proof of purchase that gates reaching this path. The
 * net economics balance because the user's fee accrued to the same firm address.
 */
export async function onboardWithPayment(params: {
  suiAddress: string;
  tier: TierName;
  paymentDigest: string;
}): Promise<OpenAccountResult> {
  const { suiAddress, tier, paymentDigest } = params;
  if (!ONBOARDABLE_TIERS.includes(tier)) {
    throw new Error("That tier is not available at sign-up.");
  }

  const config = serverSuiConfig();
  const client = getSuiClient();

  const evalFee = await fetchEvalFee(
    client,
    config.evalFundsAddress,
    tier,
    config,
  );

  await verifyPayment({
    client,
    paymentDigest,
    suiAddress,
    evalFundsAddress: config.evalFundsAddress,
    usdcType: config.usdcType,
    evalFee,
  });

  return adminOpenAccount(suiAddress, tier);
}

/** Parses `PROPFIRM_INVITE_CODES` (comma-separated) into a normalized set. */
function inviteCodeAllowlist(): Set<string> {
  return new Set(
    (process.env.PROPFIRM_INVITE_CODES ?? "")
      .split(",")
      .map((code) => code.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * INVITE onboarding: a valid code lets the firm fund a Starter account outright,
 * no payment required. Starter-only by design (Basic must always be paid).
 *
 * RISK the operator must test on testnet: invite codes are NOT single-use here —
 * the env allowlist has no durable consumption store, so a code stays valid for
 * anyone until removed. The only anti-abuse guard is one-account-per-user
 * (enforced in the route): a given user can redeem at most one account total. A
 * durable single-use store (e.g. a DB row marked consumed) is the production
 * hardening; flagged so it isn't mistaken for already-implemented.
 */
export async function onboardWithInvite(params: {
  suiAddress: string;
  inviteCode: string;
}): Promise<OpenAccountResult> {
  const { suiAddress, inviteCode } = params;
  const code = inviteCode.trim().toLowerCase();
  if (!code || !inviteCodeAllowlist().has(code)) {
    throw new Error("That invite code isn't valid.");
  }
  return adminOpenAccount(suiAddress, "starter");
}
