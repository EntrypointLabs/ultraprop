import "server-only";

import { getJsonRpcFullnodeUrl, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { SuinsClient, SuinsTransaction } from "@mysten/suins";
import { expectExecuted, loadAdminKeypair } from "@shared/sui-propfirm";
import { getGrpcClient } from "@/lib/sui/client";
import { publicSuiConfig, serverSuiConfig } from "@/lib/sui/config";

/**
 * SuiNS username claiming. Users pick a label and we mint a subname of the
 * firm-owned parent domain (e.g. `gifted.ultraprop.sui`) as an NFT delivered to
 * their wallet. The firm holds the parent `SuinsRegistration`, so it signs and
 * pays for the mint — the user provides nothing on-chain. Availability and the
 * minted NFT id are read straight from the SuiNS registry, never assumed.
 */

export class SuiNsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuiNsError";
  }
}

/** A subname label: lowercase alphanumeric with internal hyphens, 3–63 chars.
 * Mirrors SuiNS's own label rules so we reject locally before any on-chain read. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

/** Validate and normalize a user-entered label, or throw `SuiNsError`. */
export function normalizeLabel(input: string): string {
  const label = input.trim().toLowerCase();
  if (label.length < 3) {
    throw new SuiNsError("Usernames are at least 3 characters.");
  }
  if (label.length > 63 || !LABEL.test(label)) {
    throw new SuiNsError(
      "Use letters, numbers and hyphens only (no leading or trailing hyphen).",
    );
  }
  return label;
}

/** The configured parent domain, lowercased, or throw if usernames are off. */
function parentName(): string {
  const name = publicSuiConfig().suinsParentName;
  if (!name) throw new SuiNsError("Username claiming isn't available yet.");
  return name;
}

/** The full subname for a label, e.g. `gifted` → `gifted.ultraprop.sui`. */
export function fullUsername(label: string): string {
  return `${label}.${parentName()}`;
}

let cachedClient: SuinsClient | null = null;
function suinsClient(): SuinsClient {
  if (cachedClient) return cachedClient;
  const { network, rpcUrl } = publicSuiConfig();
  if (network !== "mainnet" && network !== "testnet") {
    throw new SuiNsError("SuiNS is only available on mainnet and testnet.");
  }
  // SuiNS reads must go through a JSON-RPC client: its `getDynamicField` returns
  // null for an unregistered name, whereas the gRPC client throws "not found",
  // which would make every available name look like an error. Execution still
  // runs on the gRPC client — building the PTB is client-agnostic.
  const client = new SuiJsonRpcClient({
    url: rpcUrl ?? getJsonRpcFullnodeUrl(network),
    network,
  });
  cachedClient = new SuinsClient({ client, network });
  return cachedClient;
}

/** Whether an error means the looked-up name record simply doesn't exist. The
 * JSON-RPC client returns null for an unregistered name (see `suinsClient`), so a
 * thrown error here is only "no record" when it carries the registry's typed
 * `notExists` code. Everything else — an RPC timeout, a 5xx, a provider blip — is
 * a real failure and must propagate, not be mistaken for a free name. */
function isNotFound(error: unknown): boolean {
  return (error as { code?: unknown }).code === "notExists";
}

/** The name record for `name`, or null when it isn't registered. */
async function getRecordOrNull(name: string) {
  try {
    return await suinsClient().getNameRecord(name);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** A name is free when it has no record, or an expired one (reclaimable). */
async function isNameFree(name: string): Promise<boolean> {
  const record = await getRecordOrNull(name);
  return !record || record.expirationTimestampMs < Date.now();
}

/** Whether `label` is available to claim under the parent domain. */
export async function isUsernameAvailable(label: string): Promise<boolean> {
  return isNameFree(fullUsername(label));
}

export interface MintedUsername {
  name: string;
  nftId: string;
  digest: string;
}

/**
 * Mint `label.<parent>` as a subname NFT and transfer it to `owner`. The firm
 * signs with its admin key (the parent registration owner), so it also pays gas.
 * Throws `SuiNsError` if the parent domain isn't set up or the label is taken.
 */
export async function mintUsernameSubname(
  owner: string,
  label: string,
): Promise<MintedUsername> {
  const name = fullUsername(label);
  const suins = suinsClient();

  const parent = await getRecordOrNull(parentName());
  if (!parent) {
    throw new SuiNsError(
      "Username claiming isn't available yet — the parent domain isn't registered.",
    );
  }
  // A live registration is taken — unless it already resolves to this same owner.
  // That's the state left when a prior mint succeeded on-chain but its DB write
  // failed: the NFT sits in the owner's wallet with the name pointing at them.
  // Treat that as an idempotent success so the claim re-records instead of
  // dead-ending on "taken" for a name the caller already owns.
  const existing = await getRecordOrNull(name);
  if (existing && existing.expirationTimestampMs >= Date.now()) {
    if (
      existing.nftId &&
      normalizeSuiAddress(existing.targetAddress) === normalizeSuiAddress(owner)
    ) {
      return { name, nftId: existing.nftId, digest: "" };
    }
    throw new SuiNsError("That username is taken. Try another.");
  }

  const keypair = loadAdminKeypair(serverSuiConfig().adminSecretKey);

  const tx = new Transaction();
  const suinsTx = new SuinsTransaction(suins, tx);
  const subName = suinsTx.createSubName({
    parentNft: parent.nftId,
    name,
    // Bounded by the parent's expiry (the on-chain max for a subname).
    expirationTimestampMs: parent.expirationTimestampMs,
    allowChildCreation: false,
    allowTimeExtension: false,
  });
  suinsTx.setTargetAddress({ nft: subName, address: owner, isSubname: true });
  tx.transferObjects([subName], owner);
  tx.setSender(keypair.toSuiAddress());

  const result = await getGrpcClient().signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    include: { effects: true, events: true },
  });
  const executed = expectExecuted(result, "Minting the username failed");

  // The registry now points the name at its fresh NFT — read the id back rather
  // than parsing effects, so we record exactly what resolves on-chain.
  const minted = await suins.getNameRecord(name);
  if (!minted?.nftId) {
    throw new SuiNsError(
      "The username was minted but its NFT id could not be resolved.",
    );
  }
  return { name, nftId: minted.nftId, digest: executed.digest };
}
