/**
 * Live public-ledger explorer links. The previous `suiexplorer.com` host is dead
 * (the official explorer moved); we use `suiscan.xyz`, which is live and exposes
 * a network in the path. Links are only built for a REAL Sui object id / address
 * (0x-prefixed hex) so a mock placeholder like `vault_starter_001` never renders
 * as a "Verify on-chain" proof that dead-ends — `isSuiId` gates that upstream.
 */

import { publicSuiConfig } from "@/lib/sui/config";

/**
 * True for a syntactically valid Sui object id or address: `0x` followed by 1–64
 * hex digits. Rejects mock placeholders (`vault_starter_001`, demo SBT ids that
 * aren't hex) so callers can suppress a dead "Verify" link rather than present it
 * as on-chain proof.
 */
export function isSuiId(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^0x[0-9a-fA-F]{1,64}$/.test(value.trim());
}

/** Map the configured Sui network to its suiscan.xyz path segment. */
function suiscanNetworkPath(): string {
  // suiscan paths are `/`(mainnet) and `/testnet`, `/devnet`. localnet has no
  // public explorer — fall back to testnet so the link host is always valid.
  switch (publicSuiConfig().network) {
    case "mainnet":
      return "";
    case "devnet":
      return "/devnet";
    default:
      return "/testnet";
  }
}

/** A live suiscan.xyz URL for a Sui object, or `null` when the id isn't real. */
export function suiObjectUrl(
  objectId: string | null | undefined,
): string | null {
  if (!isSuiId(objectId)) return null;
  return `https://suiscan.xyz${suiscanNetworkPath()}/object/${objectId}`;
}

/** A live suiscan.xyz URL for a Sui account/address, or `null` when not real. */
export function suiAddressUrl(
  address: string | null | undefined,
): string | null {
  if (!isSuiId(address)) return null;
  return `https://suiscan.xyz${suiscanNetworkPath()}/account/${address}`;
}

/**
 * True for a plausible Sui transaction digest — a base58 string (no 0/O/I/l), as
 * emitted by the executor and the sim's `mockDigest`. Distinct from `isSuiId`,
 * which only accepts 0x-hex object ids/addresses.
 */
export function isSuiDigest(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(value.trim());
}

/** A live suiscan.xyz URL for a transaction, or `null` when the digest isn't real. */
export function suiTxUrl(digest: string | null | undefined): string | null {
  if (!isSuiDigest(digest)) return null;
  return `https://suiscan.xyz${suiscanNetworkPath()}/tx/${digest}`;
}
