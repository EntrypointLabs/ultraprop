import type { SuiGraphQLClient } from "@mysten/sui/graphql";
import {
  type PublicKey,
  Signer,
  type SignatureScheme,
} from "@mysten/sui/cryptography";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import type { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";

/**
 * The shape Privy's `useSignRawHash().signRawHash` provides:
 * `signRawHash({ address, chainType: "sui", hash })` returns `{ signature }`,
 * both `0x`-prefixed hex (verified against @privy-io/react-auth@3.29.2's
 * `extended-chains` types).
 */
export type RawHashSigner = (hash: `0x${string}`) => Promise<{
  signature: `0x${string}`;
}>;

/** The user's Sui embedded-wallet identity, read off the Privy wallet account. */
export interface PrivySuiWallet {
  address: string;
  /** Ed25519 public key Privy exposes on the wallet's `publicKey` field for
   * tier-2 (curve-signing) chains like Sui, as a `0x`-prefixed hex string;
   * without it we can't derive the address or serialize a signature. */
  publicKey: string;
}

/**
 * Decodes Privy's Sui public key to the raw 32 bytes `Ed25519PublicKey` expects.
 * Privy returns the *flag-prefixed* Sui public key — a 1-byte signature-scheme
 * flag followed by the 32-byte Ed25519 key (33 bytes) — as a hex string. We
 * accept hex (with or without `0x`) and base64 for safety, then drop the leading
 * scheme-flag byte when present. The address-match guard in
 * `signAndExecuteWithPrivy` catches any mis-decode before gas is spent.
 */
function decodeSuiPublicKey(publicKey: string): Uint8Array {
  const stripped = publicKey.startsWith("0x") ? publicKey.slice(2) : publicKey;
  const isHex = stripped.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(stripped);
  let bytes = isHex ? fromHex(stripped) : fromBase64(publicKey);
  if (bytes.length === 33) bytes = bytes.slice(1);
  if (bytes.length !== 32) {
    throw new Error(
      `Unexpected Sui public key length: got ${bytes.length} bytes, expected 32.`,
    );
  }
  return bytes;
}

function toHex(bytes: Uint8Array): `0x${string}` {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `0x${hex}`;
}

function fromHex(value: string): Uint8Array {
  const clean = value.startsWith("0x") ? value.slice(2) : value;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * A Sui `Signer` backed by the trader's Privy embedded wallet. Subclassing
 * `Signer` lets the SDK do the canonical signing work — wrap the tx bytes in the
 * `TransactionData` intent, blake2b-hash them to the 32-byte digest, and
 * serialize the result — while we supply only the raw curve signature over that
 * digest via Privy's `signRawHash`. This keeps digest computation in the SDK
 * (no hand-rolled hashing) and means the firm never holds the user's key.
 */
class PrivySuiSigner extends Signer {
  readonly #publicKey: Ed25519PublicKey;
  readonly #signRawHash: RawHashSigner;

  constructor(wallet: PrivySuiWallet, signRawHash: RawHashSigner) {
    super();
    this.#publicKey = new Ed25519PublicKey(decodeSuiPublicKey(wallet.publicKey));
    this.#signRawHash = signRawHash;
  }

  override async sign(digest: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    const { signature } = await this.#signRawHash(toHex(digest));
    const raw = fromHex(signature);
    return raw as Uint8Array<ArrayBuffer>;
  }

  override getKeyScheme(): SignatureScheme {
    return "ED25519";
  }

  override getPublicKey(): PublicKey {
    return this.#publicKey;
  }
}

/** Lowercases and zero-pads a Sui address to its 32-byte canonical hex form. */
function normalizeSuiAddress(address: string): string {
  const hex = (address.startsWith("0x") ? address.slice(2) : address)
    .toLowerCase()
    .padStart(64, "0");
  return `0x${hex}`;
}

/**
 * Builds, user-signs, and executes a Sui transaction with the trader's Privy
 * embedded wallet — the user-side counterpart to the firm's admin-signed path.
 * Returns the on-chain transaction digest the caller forwards to the server for
 * verification.
 */
export async function signAndExecuteWithPrivy(params: {
  client: SuiGraphQLClient;
  tx: Transaction;
  wallet: PrivySuiWallet;
  signRawHash: RawHashSigner;
}): Promise<{ digest: string }> {
  const { client, tx, wallet, signRawHash } = params;

  const signer = new PrivySuiSigner(wallet, signRawHash);
  // Guard against a wallet/pubkey mismatch before spending the user's gas: the
  // address derived from the pubkey must be the wallet that signs.
  if (signer.toSuiAddress() !== normalizeSuiAddress(wallet.address)) {
    throw new Error(
      "Wallet public key does not match its address; cannot sign safely.",
    );
  }

  tx.setSenderIfNotSet(wallet.address);
  const txBytes = await tx.build({ client });
  const { signature } = await signer.signTransaction(txBytes);

  const result = await client.executeTransaction({
    transaction: txBytes,
    signatures: [signature],
    include: { effects: true },
  });

  const executed =
    result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
  if (result.$kind !== "Transaction" || !executed.status.success) {
    const error = executed.status.error?.message ?? "unknown error";
    throw new Error(`Your transaction failed on-chain: ${error}`);
  }
  return { digest: executed.digest };
}
