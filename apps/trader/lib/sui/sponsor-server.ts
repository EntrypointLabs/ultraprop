import "server-only";

import { loadAdminKeypair } from "@shared/sui-propfirm";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import { getGraphQLClient } from "./client";
import { serverSuiConfig } from "./config";

const SUI_COIN_TYPE = "0x2::sui::SUI";
/** Gas ceiling for an onboarding tx (refunded if unused); see build note below. */
const GAS_BUDGET = 20_000_000n;

export interface SponsoredTransaction {
  /** Base64 `TransactionData` bytes the user must counter-sign. */
  transactionBytes: string;
  /** The firm admin's gas-owner signature over those bytes. */
  sponsorSignature: string;
}

/** Lowercases and zero-pads a Sui address/object id to canonical 32-byte hex. */
function canonical(value: string): string {
  const hex = (value.startsWith("0x") ? value.slice(2) : value)
    .toLowerCase()
    .padStart(64, "0");
  return `0x${hex}`;
}

/**
 * Sponsors a user-built transaction: the firm's admin wallet becomes the GAS
 * OWNER so a trader's freshly-provisioned, zero-SUI embedded wallet can still
 * mint test USDC and pay its eval fee. The user stays the SENDER — the sole
 * authority over their own coins and objects — so the firm authorizes nothing
 * but gas. We allowlist Move calls to the propfirm + USDC packages so a caller
 * can never make the firm pay gas for an arbitrary contract; the worst they can
 * do is shuffle their own coins.
 */
export async function sponsorUserTransaction(params: {
  sender: string;
  transactionKindBytes: string;
}): Promise<SponsoredTransaction> {
  const config = serverSuiConfig();
  const client = getGraphQLClient();
  const keypair = loadAdminKeypair(config.adminSecretKey);
  const adminAddress = keypair.toSuiAddress();

  const tx = Transaction.fromKind(fromBase64(params.transactionKindBytes));

  const allowedPackages = new Set(
    [config.packageId, config.usdcType.split("::")[0]].map(canonical),
  );
  for (const command of tx.getData().commands) {
    const movePackage = command.MoveCall?.package;
    if (movePackage && !allowedPackages.has(canonical(movePackage))) {
      throw new Error(
        "Refusing to sponsor a call outside the propfirm contracts.",
      );
    }
  }

  // Select the admin's gas coins ourselves and set every gas field explicitly.
  // The alternative — letting build() resolve gas via the client — runs an
  // estimation/selection pass that zeroes the SENDER on a sponsored transaction
  // spending the user's own (owned) objects (e.g. paying the eval fee from the
  // trader's USDC), which then fails on-chain as "not signed by the correct
  // sender". With gas fully pre-resolved, build() touches neither the sender nor
  // the network for gas.
  const { referenceGasPrice } = await client.getReferenceGasPrice();
  const { objects: adminSuiCoins } = await client.listCoins({
    owner: adminAddress,
    coinType: SUI_COIN_TYPE,
  });
  const gasPayment: { objectId: string; version: string; digest: string }[] = [];
  let gasCovered = 0n;
  for (const coin of [...adminSuiCoins].sort((a, b) =>
    BigInt(b.balance) > BigInt(a.balance) ? 1 : -1,
  )) {
    gasPayment.push({
      objectId: coin.objectId,
      version: String(coin.version),
      digest: coin.digest,
    });
    gasCovered += BigInt(coin.balance);
    if (gasCovered >= GAS_BUDGET) break;
  }
  if (gasCovered < GAS_BUDGET) {
    throw new Error(
      "Onboarding is temporarily unavailable: the firm wallet has insufficient SUI to cover gas.",
    );
  }

  tx.setSender(params.sender);
  tx.setGasOwner(adminAddress);
  tx.setGasPayment(gasPayment);
  tx.setGasPrice(BigInt(referenceGasPrice));
  tx.setGasBudget(GAS_BUDGET);
  // Build WITHOUT a client: every input is already resolved (owned coins came in
  // as resolved refs in the kind; gas is selected above), so no resolution is
  // needed. Passing the client here triggers a GraphQL resolve pass that
  // validates owned objects against a zero sender and fails the sponsored tx.
  const txBytes = await tx.build();
  const { signature } = await keypair.signTransaction(txBytes);

  return {
    transactionBytes: toBase64(txBytes),
    sponsorSignature: signature,
  };
}
