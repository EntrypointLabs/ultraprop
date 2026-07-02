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

/** Why a SuiNS operation can't proceed. Callers (the route) switch on this to
 * pick an HTTP status instead of matching against the message text. */
export type SuiNsErrorKind =
  | "invalid" // the label failed validation
  | "unavailable" // claiming isn't configured for this network / parent
  | "taken" // the name is a live registration owned by someone else
  | "pending"; // minted on-chain, but the read node hasn't caught up yet

export class SuiNsError extends Error {
  readonly kind: SuiNsErrorKind;
  constructor(message: string, kind: SuiNsErrorKind = "invalid") {
    super(message);
    this.name = "SuiNsError";
    this.kind = kind;
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
  if (!name) {
    throw new SuiNsError("Username claiming isn't available yet.", "unavailable");
  }
  return name;
}

/** The full subname for a label, e.g. `gifted` → `gifted.ultraprop.sui`. */
export function fullUsername(label: string): string {
  return `${label}.${parentName()}`;
}

let cachedRpc: SuiJsonRpcClient | null = null;
/**
 * The JSON-RPC client all SuiNS reads go through. Its `getDynamicField` returns
 * null for an unregistered name, whereas the gRPC client throws "not found",
 * which would make every available name look like an error. Execution still runs
 * on the gRPC client — building the PTB is client-agnostic.
 */
function jsonRpcClient(): SuiJsonRpcClient {
  if (cachedRpc) return cachedRpc;
  const { network, rpcUrl } = publicSuiConfig();
  if (network !== "mainnet" && network !== "testnet") {
    throw new SuiNsError(
      "SuiNS is only available on mainnet and testnet.",
      "unavailable",
    );
  }
  cachedRpc = new SuiJsonRpcClient({
    url: rpcUrl ?? getJsonRpcFullnodeUrl(network),
    network,
  });
  return cachedRpc;
}

let cachedClient: SuinsClient | null = null;
function suinsClient(): SuinsClient {
  if (cachedClient) return cachedClient;
  const client = jsonRpcClient();
  const network = publicSuiConfig().network as "mainnet" | "testnet";
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

type NameRecord = NonNullable<Awaited<ReturnType<typeof getRecordOrNull>>>;

/** Whether `record` is a live registration that resolves to `owner` — i.e. this
 * owner's name, not an expired or someone-else's one. */
function resolvesTo(record: NameRecord, owner: string): boolean {
  return (
    Boolean(record.nftId) &&
    record.expirationTimestampMs >= Date.now() &&
    normalizeSuiAddress(record.targetAddress) === normalizeSuiAddress(owner)
  );
}

const READBACK_ATTEMPTS = 6;
const READBACK_DELAY_MS = 600;
const OWNED_SCAN_MAX_PAGES = 10;
const SUBDOMAIN_REGISTRATION_SUFFIX =
  "::subdomain_registration::SubDomainRegistration";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The `domain_name` of the `SuinsRegistration` a `SubDomainRegistration` wraps,
 * read from a JSON-RPC object's parsed content, or undefined if it isn't one. */
function wrappedDomainName(content: unknown): string | undefined {
  const parsed = content as {
    dataType?: string;
    fields?: { nft?: { fields?: { domain_name?: unknown } } };
  } | null;
  if (parsed?.dataType !== "moveObject") return undefined;
  const domainName = parsed.fields?.nft?.fields?.domain_name;
  return typeof domainName === "string" ? domainName : undefined;
}

/**
 * The id of the `SubDomainRegistration` NFT `owner` holds for `name` — the object
 * that actually sits in their wallet, which is what we store and link to. This is
 * deliberately NOT the name record's `nftId`: that points at the inner, wrapped
 * `SuinsRegistration`, which isn't independently viewable on an explorer. We find
 * the wrapper by scanning the owner's objects for the one whose wrapped name
 * matches. Returns null if it isn't there — including while a fresh mint is still
 * propagating to the read node.
 */
async function findOwnedSubnameNftId(
  owner: string,
  name: string,
): Promise<string | null> {
  const target = name.toLowerCase();
  const client = jsonRpcClient();
  let cursor: string | null | undefined;
  for (let page = 0; page < OWNED_SCAN_MAX_PAGES; page++) {
    const res = await client.getOwnedObjects({
      owner: normalizeSuiAddress(owner),
      cursor: cursor ?? null,
      options: { showType: true, showContent: true },
    });
    for (const { data } of res.data) {
      if (!data?.type?.endsWith(SUBDOMAIN_REGISTRATION_SUFFIX)) continue;
      if (wrappedDomainName(data.content)?.toLowerCase() === target) {
        return data.objectId;
      }
    }
    if (!res.hasNextPage) break;
    cursor = res.nextCursor;
  }
  return null;
}

/** Resolve the owner's `SubDomainRegistration` for `name`, polling through the
 * read node's replication lag after a mint that definitely landed. */
async function confirmOwnedSubnameNftId(
  owner: string,
  name: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < READBACK_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(READBACK_DELAY_MS);
    const nftId = await findOwnedSubnameNftId(owner, name);
    if (nftId) return nftId;
  }
  return null;
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
      "unavailable",
    );
  }
  // A live registration is taken — unless it already resolves to this same owner.
  // That's the state left when a prior mint landed on-chain but recording it
  // failed (a DB write error, or the read-back never caught up): the NFT sits in
  // the owner's wallet with the name pointing at them. Treat that as an idempotent
  // success so re-claiming the same name just records it — no second mint, no gas.
  const existing = await getRecordOrNull(name);
  if (existing && existing.expirationTimestampMs >= Date.now()) {
    if (resolvesTo(existing, owner)) {
      const nftId = await confirmOwnedSubnameNftId(owner, name);
      if (nftId) return { name, nftId, digest: "" };
      throw new SuiNsError(
        "Your username is already in your wallet and is being finalized. Refresh in a moment, or claim the same name again to finish.",
        "pending",
      );
    }
    throw new SuiNsError("That username is taken. Try another.", "taken");
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

  // The object now in the owner's wallet is the `SubDomainRegistration` NFT — that
  // (not the name record's wrapped inner id) is what we store and link to. Poll
  // through the read node's replication lag since the mint definitely landed.
  const nftId = await confirmOwnedSubnameNftId(owner, name);
  if (!nftId) {
    throw new SuiNsError(
      "Your username is already in your wallet and is being finalized. Refresh in a moment, or claim the same name again to finish.",
      "pending",
    );
  }
  return { name, nftId, digest: executed.digest };
}
