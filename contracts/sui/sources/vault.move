/// The firm's pooled USDC treasury. `VaultRegistry` is a single shared object
/// holding the USDC balance, deployment counters, the provider share ledger, and
/// a running activity history. Providers deposit USDC and receive a `ProviderCap`
/// that tracks their proportional share. Yield accrues dynamically: trading and
/// lending profits raise the vault's total value while total shares stay
/// constant, so each share is worth more. Platform revenue (eval fees, profit-
/// split cuts) enters without minting shares, making it free yield for existing
/// providers. A configurable buffer is held back from deployment.
///  All bps arithmetic goes through the OpenZeppelin math library.

module propfirm::vault_reserve;

use propfirm::access::{Self, AdminCap, ExecutorCap, AccessRegistry};
use std::string::String;
use sui::{
    balance::{Self, Balance},
    clock::Clock,
    coin::Coin,
    event,
    table::{Self, Table}
};
use usdc::usdc::USDC;
use openzeppelin_math::{
    u64 as oz_u64,
    rounding
};

// === Errors ===

const EBufferBreach: u64 = 1;
const EInsufficientLiquidity: u64 = 2;
const EZeroAmount: u64 = 3;
const EInvalidNotional: u64 = 4;
const EInvalidPrincipal: u64 = 5;
const EBufferTooLarge: u64 = 7;
const EMathOverflow: u64 = 8;
const EInsufficientShares: u64 = 9;
const EWrongRegistry: u64 = 10;
const EPositionNotActive: u64 = 11;
const EPaused: u64 = 12;
const ESlippage: u64 = 13;
const ENonEmptyPosition: u64 = 14;
const EInsufficientInitialDeposit: u64 = 15;
const EInvalidMaturity: u64 = 16;
const EInvalidApy: u64 = 17;
const EVenueNotAllowed: u64 = 18;
const EWithdrawalTooLarge: u64 = 19;

// === Constants ===

/// Precision scalar for the cumulative-yield-per-share accumulator (1e12).
/// Keeps fractional yield accurate across large share counts.
const YIELD_PRECISION: u64 = 1_000_000_000_000;

/// Milliseconds in a year (365.25 days), for annualizing yield into APY.
const YEAR_MS: u64 = 31_557_600_000;

/// Shares permanently locked on the first deposit. They are owned by no cap and
/// can never be redeemed, so `total_shares` is always at least this much once
/// the vault is seeded. This neutralizes the first-depositor inflation attack
/// and keeps the yield-per-share accumulator from overflowing at tiny share
/// counts. At USDC's 6 decimals this locks a negligible $0.001.
const MINIMUM_LIQUIDITY: u64 = 1_000;

/// Sanity ceiling for any advertised or expected APY (in bps). 1_000_000 bps =
/// 10,000%. Anything above is a fat-finger and is rejected.
const MAX_APY_BPS: u64 = 1_000_000;

/// Largest u64, for saturating arithmetic on the reporting-only yield
/// accumulator (which must never abort a fund movement).
const U64_MAX: u64 = 18_446_744_073_709_551_615;

// === Structs ===

/// The shared vault: USDC pool, deployment counters, provider share ledger,
/// lending positions, yield accumulator, and APY timeline, all in one object.
/// Created once by the admin via `create_vault` and referenced by every vault
/// operation.
public struct VaultRegistry has key {
    id: UID,
    funds: Balance<USDC>,
    deployed: u64,
    lent: u64,
    buffer_bps: u64,
    total_shares: u64,
    provider_count: u64,
    total_deposited: u64,
    total_withdrawn: u64,
    total_yield_earned: u64,
    lending_positions: Table<u64, LendingPosition>,
    next_lending_id: u64,
    active_lending_count: u64,
    cumulative_yield_per_share: u64,
    current_apy_bps: u64,
    apy_history: Table<u64, ApySnapshot>,
    next_apy_seq: u64,
    paused: bool,
    // Allowlist of venues capital may be drawn to via `draw_for_lending`. A
    // compromised executor can only route lending capital to an admin-approved
    // venue, not an arbitrary destination.
    allowed_venues: Table<String, bool>,
    // Hard ceiling on any single trading withdrawal or lending draw (0 = no
    // ceiling). Caps the blast radius of a single rogue executor call.
    max_withdrawal: u64,
}

/// A single-use ticket minted once at publish and consumed by `create_vault`, so
/// the vault can be created at most once — no duplicate vaults.
public struct VaultCreatorCap has key, store {
    id: UID,
}

/// Owned, transferable object issued to each provider. Tracks their share of the
/// vault and the total USDC they have deposited (for reporting; redemption math
/// is share-price based).
public struct ProviderCap has key, store {
    id: UID,
    registry_id: ID,
    shares: u64,
    deposited_value: u64,
    earned_yield: u64,
    cumulative_yield_per_share_snapshot: u64,
    minted_at_ms: u64,
}


/// Status of a lending position.
public enum LendingStatus has copy, drop, store {
    Active,
    Returned,
    Defaulted,
}

/// One lending deployment: who the capital went to, how much, the expected
/// return, and the timeline. Created by `draw_for_lending`, closed by
/// `return_from_lending`.
public struct LendingPosition has store, copy, drop {
    position_id: u64,
    venue: String,
    protocol_id: String,
    principal: u64,
    expected_apy_bps: u64,
    maturity_ms: u64,
    deployed_at_ms: u64,
    returned_at_ms: u64,
    returned_amount: u64,
    status: LendingStatus,
}

/// A point-in-time record of the vault's advertised APY, set by the executor.
/// Low-volume (a few per week), so safe to keep on-chain for precise time-
/// weighted rate queries.
public struct ApySnapshot has store, copy, drop {
    seq: u64,
    apy_bps: u64,
    set_by: address,
    timestamp_ms: u64,
}

// === Events ===

/// Emitted when the vault is created.
public struct VaultCreated has copy, drop {
    vault_id: ID,
    created_by: address,
    buffer_bps: u64,
    timestamp_ms: u64,
}

/// Emitted when a provider deposits and receives shares.
public struct ProviderDeposited has copy, drop {
    vault_id: ID,
    provider: address,
    cap_id: ID,
    amount: u64,
    shares_minted: u64,
    share_price_after: u64,
    total_shares_after: u64,
    total_value_after: u64,
    timestamp_ms: u64,
}

/// Emitted when a provider redeems shares for USDC.
public struct ProviderRedeemed has copy, drop {
    vault_id: ID,
    provider: address,
    cap_id: ID,
    shares_redeemed: u64,
    amount_returned: u64,
    share_price_after: u64,
    total_shares_after: u64,
    total_value_after: u64,
    timestamp_ms: u64,
}

/// Emitted when platform revenue is deposited (no shares minted).
public struct RevenueDeposited has copy, drop {
    vault_id: ID,
    depositor: address,
    amount: u64,
    total_value_after: u64,
    timestamp_ms: u64,
}

/// Emitted when capital is withdrawn to open a trade.
public struct TradingWithdrawn has copy, drop {
    vault_id: ID,
    executor: address,
    amount: u64,
    on_hand_after: u64,
    deployed_after: u64,
    timestamp_ms: u64,
}

/// Emitted when trade proceeds return.
public struct TradingReturned has copy, drop {
    vault_id: ID,
    executor: address,
    notional: u64,
    returned: u64,
    is_profit: bool,
    pnl: u64,
    on_hand_after: u64,
    deployed_after: u64,
    timestamp_ms: u64,
}

/// Emitted when capital is drawn to a yield venue, carrying the full position
/// details: where it went, how much, the expected yield, and the maturity.
public struct LentToYield has copy, drop {
    vault_id: ID,
    executor: address,
    position_id: u64,
    venue: String,
    protocol_id: String,
    principal: u64,
    expected_apy_bps: u64,
    maturity_ms: u64,
    on_hand_after: u64,
    lent_after: u64,
    active_lending_count: u64,
    timestamp_ms: u64,
}

/// Emitted when lent capital returns, carrying the position details, the actual
/// yield vs expected, and the holding period.
public struct YieldReturned has copy, drop {
    vault_id: ID,
    executor: address,
    position_id: u64,
    venue: String,
    protocol_id: String,
    principal: u64,
    returned: u64,
    is_profit: bool,
    yield_amount: u64,
    expected_apy_bps: u64,
    held_ms: u64,
    on_hand_after: u64,
    lent_after: u64,
    active_lending_count: u64,
    timestamp_ms: u64,
}

/// Emitted when the executor updates the vault's advertised APY, carrying the
/// previous and new rate so the full APY curve is reconstructable from events.
public struct ApyUpdated has copy, drop {
    vault_id: ID,
    executor: address,
    previous_apy_bps: u64,
    new_apy_bps: u64,
    timestamp_ms: u64,
}

/// Emitted when the admin pauses or unpauses the vault.
public struct PauseToggled has copy, drop {
    vault_id: ID,
    admin: address,
    paused: bool,
    timestamp_ms: u64,
}

/// Emitted when the admin retunes the never-touch buffer.
public struct BufferUpdated has copy, drop {
    vault_id: ID,
    admin: address,
    previous_buffer_bps: u64,
    new_buffer_bps: u64,
    timestamp_ms: u64,
}

/// Emitted when a lending position is written down as defaulted, carrying the
/// principal lost, anything recovered, and the resulting loss socialized to
/// providers.
public struct LendingDefaulted has copy, drop {
    vault_id: ID,
    executor: address,
    position_id: u64,
    venue: String,
    protocol_id: String,
    principal: u64,
    recovered: u64,
    loss: u64,
    lent_after: u64,
    active_lending_count: u64,
    total_value_after: u64,
    timestamp_ms: u64,
}

/// Emitted when the admin adds or removes a venue from the lending allowlist.
public struct VenueAllowlistUpdated has copy, drop {
    vault_id: ID,
    admin: address,
    venue: String,
    allowed: bool,
    timestamp_ms: u64,
}

/// Emitted when the admin changes the per-call withdrawal/draw ceiling.
public struct MaxWithdrawalUpdated has copy, drop {
    vault_id: ID,
    admin: address,
    previous_max_withdrawal: u64,
    new_max_withdrawal: u64,
    timestamp_ms: u64,
}

/// Emitted when a provider destroys a fully redeemed position.
public struct ProviderClosed has copy, drop {
    vault_id: ID,
    provider: address,
    cap_id: ID,
    provider_count_after: u64,
    timestamp_ms: u64,
}

// === Internal helpers ===

/// Total value under management: on-hand plus deployed plus lent.
fun total_value(vault: &VaultRegistry): u64 {
    vault.funds.value() + vault.deployed + vault.lent
}

/// Multiplies then divides with floor rounding via the OpenZeppelin math lib.
fun mul_div_down(a: u64, b: u64, denominator: u64): u64 {
    let result = oz_u64::mul_div(a, b, denominator, rounding::down());
    assert!(result.is_some(), EMathOverflow);
    result.destroy_some()
}

/// Total capital currently out of the reserve.
fun committed(vault: &VaultRegistry): u64 {
    vault.deployed + vault.lent
}

/// Whether a lending position is still open.
fun is_active(status: LendingStatus): bool {
    match (status) {
        LendingStatus::Active => true,
        _ => false,
    }
}

/// Maximum total capital that may be out of the reserve at once.
fun deployable(vault: &VaultRegistry): u64 {
    mul_div_down(total_value(vault), 10_000 - vault.buffer_bps, 10_000)
}

/// USDC value per share, scaled by 1e6 (so 1_000_000 = 1:1 with USDC).
fun share_price(vault: &VaultRegistry): u64 {
    if (vault.total_shares == 0) 1_000_000
    else mul_div_down(total_value(vault), 1_000_000, vault.total_shares)
}

/// Saturating u64 add. The yield accumulator is reporting-only and must never
/// abort a caller, so it pins at the ceiling instead of overflowing.
fun sat_add(a: u64, b: u64): u64 {
    if (b > U64_MAX - a) U64_MAX else a + b
}

/// Yield-per-share increment for a yield event, flooring; 0 if the math would
/// overflow. Never aborts, so accrual can never block a fund return.
fun yield_per_share_inc(yield_amount: u64, total_shares: u64): u64 {
    oz_u64::mul_div(yield_amount, YIELD_PRECISION, total_shares, rounding::down()).destroy_or!(0)
}

/// Yield owed for a yield-per-share `delta` over `shares`, flooring; 0 if the
/// math would overflow. Never aborts, so yield sync is purely reporting.
fun yield_for_delta(delta: u64, shares: u64): u64 {
    oz_u64::mul_div(delta, shares, YIELD_PRECISION, rounding::down()).destroy_or!(0)
}

/// Updates the global yield accumulator when yield enters the vault. Called
/// inside return_from_trading, return_from_lending, and deposit (revenue). This
/// is reporting-only (redemption is NAV-based), so it saturates rather than
/// aborting — a cosmetic counter must never block capital returning to the vault.
fun accrue_yield(vault: &mut VaultRegistry, yield_amount: u64) {
    if (vault.total_shares > 0 && yield_amount > 0) {
        let inc = yield_per_share_inc(yield_amount, vault.total_shares);
        vault.cumulative_yield_per_share = sat_add(vault.cumulative_yield_per_share, inc);
    };
}

/// Syncs a provider's earned yield up to the current accumulator value. Called
/// before any change to the provider's shares so accrued yield is captured at
/// the correct share count.
fun sync_provider_yield(vault: &VaultRegistry, cap: &mut ProviderCap) {
    if (cap.shares > 0 && vault.cumulative_yield_per_share > cap.cumulative_yield_per_share_snapshot) {
        let pending = yield_for_delta(
            vault.cumulative_yield_per_share - cap.cumulative_yield_per_share_snapshot,
            cap.shares,
        );
        cap.earned_yield = sat_add(cap.earned_yield, pending);
    };
    cap.cumulative_yield_per_share_snapshot = vault.cumulative_yield_per_share;
}

// === Init ===

/// Runs once at publish, minting the single `VaultCreatorCap` to the deployer so
/// the vault can be created exactly once via `create_vault`.
fun init(ctx: &mut TxContext) {
    transfer::transfer(VaultCreatorCap { id: object::new(ctx) }, ctx.sender());
}

// === Admin functions ===

/// Creates and shares the USDC vault, consuming the one-time `VaultCreatorCap`
/// so it can never be created twice. `buffer_bps` is the never-touch buffer and
/// `max_withdrawal` is the per-call ceiling on trading withdrawals and lending
/// draws (0 = no ceiling).
public fun create_vault(
    cap: &AdminCap,
    registry: &AccessRegistry,
    creator: VaultCreatorCap,
    buffer_bps: u64,
    max_withdrawal: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    access::assert_admin(registry, cap);
    let VaultCreatorCap { id } = creator;
    id.delete();
    assert!(buffer_bps <= 10_000, EBufferTooLarge);
    let vault = VaultRegistry {
        id: object::new(ctx),
        funds: balance::zero<USDC>(),
        deployed: 0,
        lent: 0,
        buffer_bps,
        total_shares: 0,
        provider_count: 0,
        total_deposited: 0,
        total_withdrawn: 0,
        total_yield_earned: 0,
        lending_positions: table::new(ctx),
        next_lending_id: 0,
        active_lending_count: 0,
        cumulative_yield_per_share: 0,
        current_apy_bps: 0,
        apy_history: table::new(ctx),
        next_apy_seq: 0,
        paused: false,
        allowed_venues: table::new(ctx),
        max_withdrawal,
    };
    event::emit(VaultCreated {
        vault_id: object::id(&vault),
        created_by: ctx.sender(),
        buffer_bps,
        timestamp_ms: clock.timestamp_ms(),
    });
    transfer::share_object(vault);
}

/// Deletes a closed lending position by ID, freeing its storage. Only returned
/// or defaulted positions can be pruned; active ones are protected.
public fun prune_lending_position(
    cap: &AdminCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    position_id: u64,
) {
    access::assert_admin(registry, cap);
    let position = vault.lending_positions.remove(position_id);
    assert!(
        match (position.status) {
            LendingStatus::Returned => true,
            LendingStatus::Defaulted => true,
            LendingStatus::Active => false,
        },
        EPositionNotActive,
    );
}

/// Deletes an APY snapshot by sequence number, freeing its storage. The history
/// table is otherwise append-only and unbounded.
public fun prune_apy_snapshot(
    cap: &AdminCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    seq: u64,
) {
    access::assert_admin(registry, cap);
    vault.apy_history.remove(seq);
}

/// Pauses or unpauses the vault. While paused, new deposits and capital
/// deployments are blocked; redemptions stay open (pause must never trap a
/// provider's capital) and de-risking inflows (returns, revenue, defaults, APY
/// updates) remain available.
public fun set_paused(
    cap: &AdminCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    paused: bool,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_admin(registry, cap);
    vault.paused = paused;
    event::emit(PauseToggled {
        vault_id: object::id(vault),
        admin: ctx.sender(),
        paused,
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Retunes the never-touch buffer in bps. Takes effect immediately for every
/// subsequent deployment check.
public fun set_buffer_bps(
    cap: &AdminCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    buffer_bps: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_admin(registry, cap);
    assert!(buffer_bps <= 10_000, EBufferTooLarge);
    let previous_buffer_bps = vault.buffer_bps;
    vault.buffer_bps = buffer_bps;
    event::emit(BufferUpdated {
        vault_id: object::id(vault),
        admin: ctx.sender(),
        previous_buffer_bps,
        new_buffer_bps: buffer_bps,
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Adds or removes a venue from the lending allowlist. `draw_for_lending` only
/// permits draws to venues marked allowed, so the executor can never route
/// capital to an unapproved destination.
public fun set_venue_allowed(
    cap: &AdminCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    venue: String,
    allowed: bool,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_admin(registry, cap);
    if (vault.allowed_venues.contains(venue)) {
        *vault.allowed_venues.borrow_mut(venue) = allowed;
    } else {
        vault.allowed_venues.add(venue, allowed);
    };
    event::emit(VenueAllowlistUpdated {
        vault_id: object::id(vault),
        admin: ctx.sender(),
        venue,
        allowed,
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Sets the per-call ceiling on trading withdrawals and lending draws. 0 lifts
/// the ceiling entirely.
public fun set_max_withdrawal(
    cap: &AdminCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    max_withdrawal: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_admin(registry, cap);
    let previous_max_withdrawal = vault.max_withdrawal;
    vault.max_withdrawal = max_withdrawal;
    event::emit(MaxWithdrawalUpdated {
        vault_id: object::id(vault),
        admin: ctx.sender(),
        previous_max_withdrawal,
        new_max_withdrawal: max_withdrawal,
        timestamp_ms: clock.timestamp_ms(),
    });
}

// === Provider functions ===

/// Deposits USDC and mints a new `ProviderCap` with proportional shares. First
/// deposit mints 1:1; subsequent deposits price shares at the current NAV so
/// accrued yield is not diluted.
public fun provide(
    vault: &mut VaultRegistry,
    payment: Coin<USDC>,
    min_shares_out: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): ProviderCap {
    assert!(!vault.paused, EPaused);
    let vault_id = object::id(vault);
    let now_ms = clock.timestamp_ms();
    let amount = payment.value();
    assert!(amount > 0, EZeroAmount);

    let is_first = vault.total_shares == 0;
    let shares_minted = if (is_first) {
        assert!(amount > MINIMUM_LIQUIDITY, EInsufficientInitialDeposit);
        vault.total_shares = MINIMUM_LIQUIDITY;
        amount - MINIMUM_LIQUIDITY
    } else {
        mul_div_down(amount, vault.total_shares, total_value(vault))
    };
    assert!(shares_minted > 0, EZeroAmount);
    assert!(shares_minted >= min_shares_out, ESlippage);

    vault.funds.join(payment.into_balance());
    vault.total_shares = vault.total_shares + shares_minted;
    vault.total_deposited = vault.total_deposited + amount;
    vault.provider_count = vault.provider_count + 1;

    let cap = ProviderCap {
        id: object::new(ctx),
        registry_id: vault_id,
        shares: shares_minted,
        deposited_value: amount,
        earned_yield: 0,
        cumulative_yield_per_share_snapshot: vault.cumulative_yield_per_share,
        minted_at_ms: now_ms,
    };

    event::emit(ProviderDeposited {
        vault_id,
        provider: ctx.sender(),
        cap_id: object::id(&cap),
        amount,
        shares_minted,
        share_price_after: share_price(vault),
        total_shares_after: vault.total_shares,
        total_value_after: total_value(vault),
        timestamp_ms: now_ms,
    });

    cap
}

/// Adds more USDC to an existing provider position, minting additional shares at
/// the current share price.
public fun add_to_position(
    vault: &mut VaultRegistry,
    cap: &mut ProviderCap,
    payment: Coin<USDC>,
    min_shares_out: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(!vault.paused, EPaused);
    let vault_id = object::id(vault);
    assert!(cap.registry_id == vault_id, EWrongRegistry);
    let now_ms = clock.timestamp_ms();
    let amount = payment.value();
    assert!(amount > 0, EZeroAmount);

    // Sync yield before changing shares so accrued yield uses the old count.
    sync_provider_yield(vault, cap);

    let shares_minted = mul_div_down(amount, vault.total_shares, total_value(vault));
    assert!(shares_minted > 0, EZeroAmount);
    assert!(shares_minted >= min_shares_out, ESlippage);

    vault.funds.join(payment.into_balance());
    vault.total_shares = vault.total_shares + shares_minted;
    vault.total_deposited = vault.total_deposited + amount;
    cap.shares = cap.shares + shares_minted;
    cap.deposited_value = cap.deposited_value + amount;

    event::emit(ProviderDeposited {
        vault_id,
        provider: ctx.sender(),
        cap_id: object::id(cap),
        amount,
        shares_minted,
        share_price_after: share_price(vault),
        total_shares_after: vault.total_shares,
        total_value_after: total_value(vault),
        timestamp_ms: now_ms,
    });
}

/// Redeems some shares from a provider's position for USDC at the current share
/// price. The provider keeps their cap with the remaining shares.
public fun redeem(
    vault: &mut VaultRegistry,
    cap: &mut ProviderCap,
    shares_to_redeem: u64,
    min_amount_out: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<USDC> {
    // Redemptions stay open even while paused — pause halts new exposure, it
    // must never trap a provider's own capital.
    let vault_id = object::id(vault);
    assert!(cap.registry_id == vault_id, EWrongRegistry);
    assert!(shares_to_redeem > 0, EZeroAmount);
    assert!(shares_to_redeem <= cap.shares, EInsufficientShares);

    let now_ms = clock.timestamp_ms();

    // Sync yield before changing shares so accrued yield uses the old count.
    sync_provider_yield(vault, cap);

    let amount = mul_div_down(shares_to_redeem, total_value(vault), vault.total_shares);
    assert!(amount > 0, EZeroAmount);
    assert!(amount >= min_amount_out, ESlippage);
    // Liquidity may be deployed or lent; redemption is bounded by on-hand funds.
    // Providers may need to wait for capital to return before exiting in full.
    assert!(amount <= vault.funds.value(), EInsufficientLiquidity);

    // Reduce the reported deposit basis proportionally so APY reporting stays
    // meaningful after a partial exit.
    let value_reduction = mul_div_down(cap.deposited_value, shares_to_redeem, cap.shares);

    vault.total_shares = vault.total_shares - shares_to_redeem;
    vault.total_withdrawn = vault.total_withdrawn + amount;
    cap.shares = cap.shares - shares_to_redeem;
    cap.deposited_value = cap.deposited_value - value_reduction;

    let coin = vault.funds.split(amount).into_coin(ctx);

    event::emit(ProviderRedeemed {
        vault_id,
        provider: ctx.sender(),
        cap_id: object::id(cap),
        shares_redeemed: shares_to_redeem,
        amount_returned: amount,
        share_price_after: share_price(vault),
        total_shares_after: vault.total_shares,
        total_value_after: total_value(vault),
        timestamp_ms: now_ms,
    });

    coin
}

/// Destroys a fully redeemed provider position, reclaiming its storage rebate
/// and decrementing the active provider count. The cap must hold zero shares
/// (redeem everything first).
public fun close_position(
    vault: &mut VaultRegistry,
    cap: ProviderCap,
    clock: &Clock,
    ctx: &TxContext,
) {
    let vault_id = object::id(vault);
    assert!(cap.registry_id == vault_id, EWrongRegistry);
    assert!(cap.shares == 0, ENonEmptyPosition);

    let cap_id = object::id(&cap);
    vault.provider_count = vault.provider_count - 1;
    let ProviderCap { id, .. } = cap;
    id.delete();

    event::emit(ProviderClosed {
        vault_id,
        provider: ctx.sender(),
        cap_id,
        provider_count_after: vault.provider_count,
        timestamp_ms: clock.timestamp_ms(),
    });
}

// === Platform revenue ===

/// Deposits platform revenue (eval fees, profit-split cuts) into the vault
/// without minting shares. This raises the share price for all existing
/// providers as free yield. Executor-gated so the yield accumulator and
/// lifetime-yield stats can only be moved by the engine, not pumped by anyone.
public fun deposit(
    cap: &ExecutorCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    payment: Coin<USDC>,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_executor(registry, cap);
    let vault_id = object::id(vault);
    let now_ms = clock.timestamp_ms();
    let amount = payment.value();
    assert!(amount > 0, EZeroAmount);

    vault.funds.join(payment.into_balance());
    vault.total_yield_earned = vault.total_yield_earned + amount;
    accrue_yield(vault, amount);

    event::emit(RevenueDeposited {
        vault_id,
        depositor: ctx.sender(),
        amount,
        total_value_after: total_value(vault),
        timestamp_ms: now_ms,
    });
}

// === Engine actions (executor-gated) ===

/// Updates the vault's advertised APY. The executor calls this as market
/// conditions and strategy performance change. Each update is recorded in the
/// APY history timeline and emitted as an event so the full rate curve is
/// auditable.
public fun set_apy(
    cap: &ExecutorCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    apy_bps: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_executor(registry, cap);
    assert!(apy_bps <= MAX_APY_BPS, EInvalidApy);
    let vault_id = object::id(vault);
    let now_ms = clock.timestamp_ms();
    let previous_apy_bps = vault.current_apy_bps;
    vault.current_apy_bps = apy_bps;

    let seq = vault.next_apy_seq;
    vault.apy_history.add(seq, ApySnapshot {
        seq,
        apy_bps,
        set_by: ctx.sender(),
        timestamp_ms: now_ms,
    });
    vault.next_apy_seq = seq + 1;

    event::emit(ApyUpdated {
        vault_id,
        executor: ctx.sender(),
        previous_apy_bps,
        new_apy_bps: apy_bps,
        timestamp_ms: now_ms,
    });
}

/// Withdraws USDC to open a trading position. Guards against insufficient
/// on-hand funds and against dipping below the buffer.
public fun withdraw_for_trading(
    cap: &ExecutorCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<USDC> {
    access::assert_executor(registry, cap);
    assert!(!vault.paused, EPaused);
    let vault_id = object::id(vault);
    let now_ms = clock.timestamp_ms();
    assert!(amount > 0, EZeroAmount);
    assert!(vault.max_withdrawal == 0 || amount <= vault.max_withdrawal, EWithdrawalTooLarge);
    assert!(amount <= vault.funds.value(), EInsufficientLiquidity);
    assert!(vault.committed() + amount <= vault.deployable(), EBufferBreach);

    vault.deployed = vault.deployed + amount;
    let coin = vault.funds.split(amount).into_coin(ctx);

    event::emit(TradingWithdrawn {
        vault_id,
        executor: ctx.sender(),
        amount,
        on_hand_after: vault.funds.value(),
        deployed_after: vault.deployed,
        timestamp_ms: now_ms,
    });
    coin
}

/// Returns trade proceeds to the reserve. Any profit above `notional`
/// automatically raises the share price for all providers.
public fun return_from_trading(
    cap: &ExecutorCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    proceeds: Coin<USDC>,
    notional: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_executor(registry, cap);
    let vault_id = object::id(vault);
    let now_ms = clock.timestamp_ms();
    assert!(notional <= vault.deployed, EInvalidNotional);
    let returned = proceeds.value();
    let (is_profit, pnl) = if (returned >= notional) {
        (true, returned - notional)
    } else {
        (false, notional - returned)
    };
    if (is_profit) {
        vault.total_yield_earned = vault.total_yield_earned + pnl;
        accrue_yield(vault, pnl);
    };
    vault.deployed = vault.deployed - notional;
    vault.funds.join(proceeds.into_balance());

    event::emit(TradingReturned {
        vault_id,
        executor: ctx.sender(),
        notional,
        returned,
        is_profit,
        pnl,
        on_hand_after: vault.funds.value(),
        deployed_after: vault.deployed,
        timestamp_ms: now_ms,
    });
}

/// Draws idle USDC to a yield venue, creating a tracked lending position with
/// the venue, protocol, expected APY, and maturity. Returns the coin and the
/// position ID for use when returning the capital.
public fun draw_for_lending(
    cap: &ExecutorCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    amount: u64,
    venue: String,
    protocol_id: String,
    expected_apy_bps: u64,
    maturity_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): (Coin<USDC>, u64) {
    access::assert_executor(registry, cap);
    assert!(!vault.paused, EPaused);
    let vault_id = object::id(vault);
    let now_ms = clock.timestamp_ms();
    assert!(amount > 0, EZeroAmount);
    assert!(vault.max_withdrawal == 0 || amount <= vault.max_withdrawal, EWithdrawalTooLarge);
    assert!(
        vault.allowed_venues.contains(venue) && *vault.allowed_venues.borrow(venue),
        EVenueNotAllowed,
    );
    assert!(amount <= vault.funds.value(), EInsufficientLiquidity);
    assert!(vault.committed() + amount <= vault.deployable(), EBufferBreach);
    assert!(maturity_ms > now_ms, EInvalidMaturity);
    assert!(expected_apy_bps <= MAX_APY_BPS, EInvalidApy);

    let position_id = vault.next_lending_id;
    vault.lending_positions.add(position_id, LendingPosition {
        position_id,
        venue,
        protocol_id,
        principal: amount,
        expected_apy_bps,
        maturity_ms,
        deployed_at_ms: now_ms,
        returned_at_ms: 0,
        returned_amount: 0,
        status: LendingStatus::Active,
    });
    vault.next_lending_id = position_id + 1;
    vault.active_lending_count = vault.active_lending_count + 1;
    vault.lent = vault.lent + amount;
    let coin = vault.funds.split(amount).into_coin(ctx);

    event::emit(LentToYield {
        vault_id,
        executor: ctx.sender(),
        position_id,
        venue,
        protocol_id,
        principal: amount,
        expected_apy_bps,
        maturity_ms,
        on_hand_after: vault.funds.value(),
        lent_after: vault.lent,
        active_lending_count: vault.active_lending_count,
        timestamp_ms: now_ms,
    });
    (coin, position_id)
}

/// Closes a lending position by returning the proceeds. References the position
/// by ID, marks it `Returned`, records the actual yield vs expected, and updates
/// the vault totals. Any yield above principal raises the share price for all
/// providers.
public fun return_from_lending(
    cap: &ExecutorCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    proceeds: Coin<USDC>,
    position_id: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_executor(registry, cap);
    let vault_id = object::id(vault);
    let now_ms = clock.timestamp_ms();
    let returned = proceeds.value();

    // Phase 1: borrow the position, read its terms, mark it returned. All
    // position access must finish before we touch any other vault field,
    // because the borrow_mut locks vault.lending_positions.
    let position = vault.lending_positions.borrow_mut(position_id);
    assert!(is_active(position.status), EPositionNotActive);
    let principal = position.principal;
    let venue = position.venue;
    let protocol_id = position.protocol_id;
    let expected_apy_bps = position.expected_apy_bps;
    let deployed_at_ms = position.deployed_at_ms;
    position.status = LendingStatus::Returned;
    position.returned_at_ms = now_ms;
    position.returned_amount = returned;
    // position borrow released after this point.

    // Phase 2: vault-level accounting.
    assert!(principal <= vault.lent, EInvalidPrincipal);
    let held_ms = now_ms - deployed_at_ms;
    let (is_profit, yield_amount) = if (returned >= principal) {
        (true, returned - principal)
    } else {
        (false, principal - returned)
    };
    if (is_profit) {
        vault.total_yield_earned = vault.total_yield_earned + yield_amount;
        accrue_yield(vault, yield_amount);
    };
    vault.lent = vault.lent - principal;
    vault.active_lending_count = vault.active_lending_count - 1;
    vault.funds.join(proceeds.into_balance());

    event::emit(YieldReturned {
        vault_id,
        executor: ctx.sender(),
        position_id,
        venue,
        protocol_id,
        principal,
        returned,
        is_profit,
        yield_amount,
        expected_apy_bps,
        held_ms,
        on_hand_after: vault.funds.value(),
        lent_after: vault.lent,
        active_lending_count: vault.active_lending_count,
        timestamp_ms: now_ms,
    });
}

/// Writes down a lending position that failed to return, marking it
/// `Defaulted`. Any recovered USDC is returned to the reserve; the unrecovered
/// principal is removed from `lent`, so the loss is reflected in the share price
/// for all providers. Without this, a bad loan would inflate the vault's total
/// value indefinitely.
public fun mark_lending_defaulted(
    cap: &ExecutorCap,
    registry: &AccessRegistry,
    vault: &mut VaultRegistry,
    recovery: Coin<USDC>,
    position_id: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_executor(registry, cap);
    let vault_id = object::id(vault);
    let now_ms = clock.timestamp_ms();
    let recovered = recovery.value();

    let position = vault.lending_positions.borrow_mut(position_id);
    assert!(is_active(position.status), EPositionNotActive);
    let principal = position.principal;
    let venue = position.venue;
    let protocol_id = position.protocol_id;
    position.status = LendingStatus::Defaulted;
    position.returned_at_ms = now_ms;
    position.returned_amount = recovered;

    assert!(principal <= vault.lent, EInvalidPrincipal);
    let loss = if (principal > recovered) principal - recovered else 0;
    vault.lent = vault.lent - principal;
    vault.active_lending_count = vault.active_lending_count - 1;
    vault.funds.join(recovery.into_balance());

    event::emit(LendingDefaulted {
        vault_id,
        executor: ctx.sender(),
        position_id,
        venue,
        protocol_id,
        principal,
        recovered,
        loss,
        lent_after: vault.lent,
        active_lending_count: vault.active_lending_count,
        total_value_after: total_value(vault),
        timestamp_ms: now_ms,
    });
}

// === Getters ===

/// Returns on-hand (uncommitted) funds.
public fun on_hand(vault: &VaultRegistry): u64 { vault.funds.value() }

/// Returns capital currently deployed to trading.
public fun deployed(vault: &VaultRegistry): u64 { vault.deployed }

/// Returns capital currently lent to yield.
public fun lent(vault: &VaultRegistry): u64 { vault.lent }

/// Returns the configured never-touch buffer in bps.
public fun buffer_bps(vault: &VaultRegistry): u64 { vault.buffer_bps }

/// Returns whether the vault is currently paused.
public fun is_paused(vault: &VaultRegistry): bool { vault.paused }

/// Returns the per-call withdrawal/draw ceiling (0 = no ceiling).
public fun max_withdrawal(vault: &VaultRegistry): u64 { vault.max_withdrawal }

/// Returns whether a venue is currently allowed for lending draws.
public fun is_venue_allowed(vault: &VaultRegistry, venue: String): bool {
    vault.allowed_venues.contains(venue) && *vault.allowed_venues.borrow(venue)
}

/// Returns total capital under management (on-hand plus deployed plus lent).
public fun total_capital(vault: &VaultRegistry): u64 { total_value(vault) }

/// Returns total shares outstanding across all providers.
public fun total_shares(vault: &VaultRegistry): u64 { vault.total_shares }

/// Returns the current share price (USDC per share, scaled by 1e6).
public fun current_share_price(vault: &VaultRegistry): u64 { share_price(vault) }

/// Returns the USDC value of a provider's shares at the current share price.
public fun provider_value(vault: &VaultRegistry, cap: &ProviderCap): u64 {
    if (vault.total_shares == 0) return 0;
    mul_div_down(cap.shares, total_value(vault), vault.total_shares)
}

/// Returns the number of active provider positions.
public fun provider_count(vault: &VaultRegistry): u64 { vault.provider_count }

/// Returns lifetime USDC deposited by providers.
public fun total_deposited(vault: &VaultRegistry): u64 { vault.total_deposited }

/// Returns lifetime USDC withdrawn by providers.
public fun total_withdrawn(vault: &VaultRegistry): u64 { vault.total_withdrawn }

/// Returns lifetime yield earned (trading profits, lending yield, revenue).
public fun total_yield_earned(vault: &VaultRegistry): u64 { vault.total_yield_earned }

/// Returns the number of lending positions ever created.
public fun lending_count(vault: &VaultRegistry): u64 { vault.next_lending_id }

/// Returns the number of currently active lending positions.
public fun active_lending_count(vault: &VaultRegistry): u64 { vault.active_lending_count }

/// Returns a copy of the lending position at the given ID.
public fun lending_position_at(vault: &VaultRegistry, position_id: u64): LendingPosition {
    *vault.lending_positions.borrow(position_id)
}

/// Returns a provider's total accrued yield (already synced + pending).
public fun provider_earned_yield(vault: &VaultRegistry, cap: &ProviderCap): u64 {
    let pending = if (cap.shares > 0 && vault.cumulative_yield_per_share > cap.cumulative_yield_per_share_snapshot) {
        yield_for_delta(
            vault.cumulative_yield_per_share - cap.cumulative_yield_per_share_snapshot,
            cap.shares,
        )
    } else { 0 };
    sat_add(cap.earned_yield, pending)
}

/// Returns a provider's annualized yield in bps, computed from their total
/// accrued yield, deposited value, and time held. Returns 0 on the first
/// millisecond to avoid division by zero.
public fun provider_apy_bps(vault: &VaultRegistry, cap: &ProviderCap, clock: &Clock): u64 {
    let total_yield = provider_earned_yield(vault, cap);
    let elapsed = clock.timestamp_ms() - cap.minted_at_ms;
    if (elapsed == 0 || cap.deposited_value == 0) return 0;
    let yield_per_year = mul_div_down(total_yield, YEAR_MS, elapsed);
    mul_div_down(yield_per_year, 10_000, cap.deposited_value)
}

/// Returns the number of shares a provider cap holds.
public fun cap_shares(cap: &ProviderCap): u64 { cap.shares }

/// Returns the vault's current advertised APY in bps.
public fun current_apy_bps(vault: &VaultRegistry): u64 { vault.current_apy_bps }

/// Returns the number of APY snapshots recorded.
public fun apy_snapshot_count(vault: &VaultRegistry): u64 { vault.next_apy_seq }

/// Returns a copy of the APY snapshot at the given sequence number.
public fun apy_snapshot_at(vault: &VaultRegistry, seq: u64): ApySnapshot {
    *vault.apy_history.borrow(seq)
}

/// Returns the total USDC the provider has deposited into this position.
public fun cap_deposited_value(cap: &ProviderCap): u64 { cap.deposited_value }

/// Returns the registry ID this cap belongs to.
public fun cap_registry_id(cap: &ProviderCap): ID { cap.registry_id }
