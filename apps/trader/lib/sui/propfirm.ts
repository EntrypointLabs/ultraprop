import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { type PublicSuiConfig, publicSuiConfig, type TierName } from "./config";

type MoveTarget = `${string}::${string}::${string}`;

/** Fully-qualified type of the owned cap that proves account ownership. */
export function accountCapType(packageId: string): string {
  return `${packageId}::user_account::AccountCap`;
}

/** Move call that constructs the `Tier` enum value for a tier name. */
function tierTarget(packageId: string, tier: TierName): MoveTarget {
  return `${packageId}::tier_config::tier_${tier}`;
}

/**
 * Returns the id of the trading account owned by `owner`, or null if they have
 * none. The account id is the object id of the `AccountCap` in their wallet
 * (the cap's own id is the registry key), so we look up owned caps by type.
 */
export async function getTradingAccountId(
  client: SuiClient,
  owner: string,
  packageId = publicSuiConfig().packageId,
): Promise<string | null> {
  if (!packageId) return null;
  const type = accountCapType(packageId);
  const { data } = await client.getOwnedObjects({
    owner,
    filter: { StructType: type },
    options: { showType: true },
    limit: 50,
  });
  const cap = data.find((o) => o.data?.type === type);
  return cap?.data?.objectId ?? null;
}

/** Decodes a little-endian u64 from BCS-encoded devInspect return bytes. */
function decodeU64(bytes: number[] | Uint8Array): bigint {
  let value = 0n;
  for (let i = 0; i < bytes.length; i++) {
    value += BigInt(bytes[i]) << (8n * BigInt(i));
  }
  return value;
}

/**
 * Reads a tier's current evaluation fee straight from the on-chain `TierConfig`
 * via a dry-run inspection. Reading it live (rather than hardcoding) means the
 * payment always matches what `open_account` asserts, even after the admin
 * retunes pricing — a mismatch would otherwise abort the onboarding tx.
 */
export async function fetchEvalFee(
  client: SuiClient,
  sender: string,
  tier: TierName,
  config: PublicSuiConfig = publicSuiConfig(),
): Promise<bigint> {
  const tx = new Transaction();
  const tierValue = tx.moveCall({ target: tierTarget(config.packageId, tier) });
  const row = tx.moveCall({
    target: `${config.packageId}::tier_config::row`,
    arguments: [tx.object(config.tierConfigId), tierValue],
  });
  tx.moveCall({
    target: `${config.packageId}::tier_config::eval_fee`,
    arguments: [row],
  });

  const result = await client.devInspectTransactionBlock({
    sender,
    transactionBlock: tx,
  });

  if (result.error) {
    throw new Error(`Could not read tier pricing on-chain: ${result.error}`);
  }
  const returns = result.results?.at(-1)?.returnValues;
  const bytes = returns?.[0]?.[0];
  if (!bytes) {
    throw new Error("Tier pricing inspection returned no value.");
  }
  return decodeU64(bytes);
}

interface AccountCreatedJson {
  account_id?: string;
  owner?: string;
}

/**
 * Extracts the new account id from an `open_account` transaction's emitted
 * `AccountCreated` event, matching on the owner so a batched tx can't be
 * misread.
 */
export function parseAccountCreatedId(
  events: { type: string; parsedJson?: unknown }[] | null | undefined,
  owner: string,
  packageId = publicSuiConfig().packageId,
): string | null {
  const wanted = `${packageId}::user_account::AccountCreated`;
  const target = owner.toLowerCase();
  for (const event of events ?? []) {
    if (event.type !== wanted) continue;
    const json = event.parsedJson as AccountCreatedJson | undefined;
    if (json?.account_id && (json.owner ?? "").toLowerCase() === target) {
      return json.account_id;
    }
  }
  return null;
}

/**
 * Assembles the `treasury::open_account` call: pays the exact evaluation fee
 * from the firm's USDC, mints the trader's account at `tier`, and transfers the
 * `AccountCap` to `owner`. The caller supplies the firm's USDC coins (owned by
 * the admin sender) and the resolved `evalFee`.
 */
export function buildOpenAccountTransaction(params: {
  config: PublicSuiConfig & { adminCapId: string };
  owner: string;
  tier: TierName;
  evalFee: bigint;
  usdcCoinIds: string[];
}): Transaction {
  const { config, owner, tier, evalFee, usdcCoinIds } = params;
  if (usdcCoinIds.length === 0) {
    throw new Error("No USDC coins supplied to fund the evaluation fee.");
  }

  const tx = new Transaction();
  const [primary, ...rest] = usdcCoinIds.map((id) => tx.object(id));
  if (rest.length > 0) tx.mergeCoins(primary, rest);
  const [payment] = tx.splitCoins(primary, [tx.pure.u64(evalFee)]);

  const tierValue = tx.moveCall({ target: tierTarget(config.packageId, tier) });
  tx.moveCall({
    target: `${config.packageId}::treasury::open_account`,
    arguments: [
      tx.object(config.adminCapId),
      tx.object(config.accessRegistryId),
      tx.object(config.treasuryId),
      tx.object(config.accountRegistryId),
      tx.object(config.tierConfigId),
      tierValue,
      payment,
      tx.pure.address(owner),
      tx.object("0x6"),
    ],
  });
  return tx;
}
