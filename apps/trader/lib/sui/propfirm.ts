import type { SuiClientTypes } from "@mysten/sui/client";
import type { SuiGraphQLClient } from "@mysten/sui/graphql";
import { Transaction } from "@mysten/sui/transactions";
import {
  CLOCK_OBJECT_ID,
  type PublicSuiConfig,
  publicSuiConfig,
  TIER_NAMES,
  type TierName,
} from "./config";

type MoveTarget = `${string}::${string}::${string}`;

/** Canonical 32-byte zero address, a valid sender for read-only dry runs. */
const ZERO_ADDRESS = `0x${"0".repeat(64)}`;

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
  client: SuiGraphQLClient,
  owner: string,
  packageId = publicSuiConfig().packageId,
): Promise<string | null> {
  if (!packageId) return null;
  const type = accountCapType(packageId);
  const { objects } = await client.listOwnedObjects({
    owner,
    type,
    limit: 50,
  });
  const cap = objects.find((o) => o.type === type);
  return cap?.objectId ?? null;
}

/**
 * Pulls the Move return values out of a `simulateTransaction` result, throwing
 * the abort message on a failed simulation. Replaces the old devInspect
 * `result.error` / `result.results[].returnValues` shape: the unified API
 * returns a `$kind`-discriminated union whose last command's `returnValues`
 * carry the BCS bytes.
 */
function simulationReturnValues(
  result: SuiClientTypes.SimulateTransactionResult<{ commandResults: true }>,
  context: string,
): readonly SuiClientTypes.CommandOutput[] {
  if (result.$kind === "FailedTransaction") {
    const error = result.FailedTransaction.status.error?.message ?? "unknown error";
    throw new Error(`${context}: ${error}`);
  }
  return result.commandResults?.at(-1)?.returnValues ?? [];
}

/** Decodes a little-endian u64 from BCS-encoded Move return bytes. */
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
  client: SuiGraphQLClient,
  sender: string,
  tier: TierName,
  config: PublicSuiConfig = publicSuiConfig(),
): Promise<bigint> {
  const tx = new Transaction();
  tx.setSenderIfNotSet(sender);
  const tierValue = tx.moveCall({ target: tierTarget(config.packageId, tier) });
  const row = tx.moveCall({
    target: `${config.packageId}::tier_config::row`,
    arguments: [tx.object(config.tierConfigId), tierValue],
  });
  tx.moveCall({
    target: `${config.packageId}::tier_config::eval_fee`,
    arguments: [row],
  });

  const result = await client.simulateTransaction({
    transaction: tx,
    include: { commandResults: true },
  });

  const bytes = simulationReturnValues(
    result,
    "Could not read tier pricing on-chain",
  )[0]?.bcs;
  if (!bytes) {
    throw new Error("Tier pricing inspection returned no value.");
  }
  return decodeU64(bytes);
}

/**
 * Reads the tier an account is currently enrolled at, dry-running
 * `user_account::account_tier` and decoding the returned `Tier`. `Tier` is a
 * fieldless enum, so BCS encodes it as a single variant-index byte
 * (0 Starter … 4 Whale) — the byte indexes straight into `TIER_NAMES`. Mirrors
 * `fetchEvalFee`'s simulate+decode pattern. Returns null when the account or
 * package can't be read so callers can fall back gracefully.
 */
export async function getAccountTier(
  client: SuiGraphQLClient,
  accountId: string,
  config: PublicSuiConfig = publicSuiConfig(),
): Promise<TierName | null> {
  if (!config.packageId || !config.accountRegistryId) return null;

  const tx = new Transaction();
  // Any well-formed address works for a read-only simulation of shared state.
  tx.setSenderIfNotSet(ZERO_ADDRESS);
  tx.moveCall({
    target: `${config.packageId}::user_account::account_tier`,
    arguments: [tx.object(config.accountRegistryId), tx.pure.id(accountId)],
  });

  const result = await client.simulateTransaction({
    transaction: tx,
    include: { commandResults: true },
  });

  const bytes = simulationReturnValues(
    result,
    "Could not read account tier on-chain",
  )[0]?.bcs;
  const variant = bytes?.[0];
  if (variant === undefined) {
    throw new Error("Account tier inspection returned no value.");
  }
  return TIER_NAMES[variant] ?? null;
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
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/** The on-chain coordinates needed to drive the executor-gated lifecycle. */
type ExecutorConfig = PublicSuiConfig & { executorCapId: string };

/**
 * Records a closed trade's realized PnL on-chain. `pnl` is the trade's absolute
 * realized PnL in USDC base units (6 dp), with the sign carried by `isWin`, so
 * a loss is `{ isWin: false, pnl: |loss| }`. The chain applies it to equity,
 * enforces the realized daily-loss and max-drawdown gates, and journals the
 * entry with its `venue`/`market` attribution (REQ-07).
 */
export function buildLogTradeTransaction(params: {
  config: ExecutorConfig;
  accountId: string;
  isWin: boolean;
  pnl: bigint;
  venue: string;
  market: string;
}): Transaction {
  const { config, accountId, isWin, pnl, venue, market } = params;
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::user_account::log_trade`,
    arguments: [
      tx.object(config.executorCapId),
      tx.object(config.accessRegistryId),
      tx.object(config.accountRegistryId),
      tx.pure.id(accountId),
      tx.pure.bool(isWin),
      tx.pure.u64(pnl),
      tx.pure.string(venue),
      tx.pure.string(market),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/**
 * Assembles an executor-gated lifecycle call that takes only the account id
 * (`pass_evaluation`, `fail_evaluation`, `register_dd_breach`). The contract
 * arg order is identical across the three: cap, access registry, account
 * registry, account id, clock.
 */
function buildLifecycleTransaction(
  config: ExecutorConfig,
  fn: "pass_evaluation" | "fail_evaluation" | "register_dd_breach",
  accountId: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::user_account::${fn}`,
    arguments: [
      tx.object(config.executorCapId),
      tx.object(config.accessRegistryId),
      tx.object(config.accountRegistryId),
      tx.pure.id(accountId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/** Marks the account's evaluation passed (equity must already meet the target). */
export function buildPassEvaluationTransaction(
  config: ExecutorConfig,
  accountId: string,
): Transaction {
  return buildLifecycleTransaction(config, "pass_evaluation", accountId);
}

/** Marks the account's evaluation failed. */
export function buildFailEvaluationTransaction(
  config: ExecutorConfig,
  accountId: string,
): Transaction {
  return buildLifecycleTransaction(config, "fail_evaluation", accountId);
}

/**
 * Suspends the account for an off-chain risk event the engine caught outside the
 * realized per-trade gates — e.g. an unrealized-equity drawdown breach that
 * on-chain `log_trade` (realized PnL only) would never see.
 */
export function buildRegisterBreachTransaction(
  config: ExecutorConfig,
  accountId: string,
): Transaction {
  return buildLifecycleTransaction(config, "register_dd_breach", accountId);
}

// === User-side onboarding (signed by the trader's Privy wallet) ===

/** The on-chain coordinates the user-signed onboarding txns need. */
type OnboardingConfig = PublicSuiConfig;

/**
 * Reads the user's own USDC coins so the payment transaction can be funded.
 * Mirrors the server's coin-gathering, but for the trader's wallet.
 */
export async function fetchUsdcCoins(
  client: SuiGraphQLClient,
  owner: string,
  usdcType: string,
): Promise<{ coinObjectId: string; balance: bigint }[]> {
  const { objects } = await client.listCoins({ owner, coinType: usdcType });
  return objects.map((c) => ({
    coinObjectId: c.objectId,
    balance: BigInt(c.balance),
  }));
}

/**
 * Calls the open mock-USDC `faucet` to mint `amount` (6 dp base units) of test
 * USDC to the user's own wallet — the first step of the PAID path, so the trader
 * has dollars to pay their evaluation fee. Testnet only.
 */
export function buildFaucetTransaction(params: {
  config: OnboardingConfig;
  amount: bigint;
}): Transaction {
  const { config, amount } = params;
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.usdcType.split("::")[0]}::usdc::faucet`,
    arguments: [tx.object(config.usdcFaucetId), tx.pure.u64(amount)],
  });
  return tx;
}

/**
 * Transfers exactly `evalFee` of the user's USDC to the firm's eval-funds
 * address — the PAID path's payment step. The trader signs it; the resulting tx
 * digest is forwarded to the server, which verifies the transfer before opening
 * the account. The caller supplies the user's own USDC coin ids (gathered via
 * `fetchUsdcCoins`).
 */
export function buildPayEvalFeeTransaction(params: {
  config: OnboardingConfig;
  evalFee: bigint;
  usdcCoinIds: string[];
}): Transaction {
  const { config, evalFee, usdcCoinIds } = params;
  if (usdcCoinIds.length === 0) {
    throw new Error("You have no test USDC yet — mint some first.");
  }
  const tx = new Transaction();
  const [primary, ...rest] = usdcCoinIds.map((id) => tx.object(id));
  if (rest.length > 0) tx.mergeCoins(primary, rest);
  const [payment] = tx.splitCoins(primary, [tx.pure.u64(evalFee)]);
  tx.transferObjects([payment], tx.pure.address(config.evalFundsAddress));
  return tx;
}
