/// The firm's treasury: the central financial hub for all money flows that are
/// not LP capital. Holds three USDC pools (platform fees, evaluation fees, trader
/// payouts) and routes funds to configured destination addresses. Security
/// features: a pause switch, timelocked address changes, and admin recovery for
/// the payout pool. Funds are never returned as coins; every outflow takes an
/// explicit destination address and transfers internally. All bps arithmetic
/// goes through the OpenZeppelin math library.
module propfirm::treasury;

use propfirm::access::{Self, AdminCap, ExecutorCap, AccessRegistry};
use propfirm::user_account::{Self, AccountCap, AccountRegistry};
use propfirm::tier_config::{Tier, TierConfig};
use sui::{
    balance::{Self, Balance},
    clock::Clock,
    coin::Coin,
    event,
    table::{Self, Table}
};
use usdc::usdc::USDC;

// === Errors ===

const EZeroAddress: u64 = 1;
const EZeroAmount: u64 = 2;
const EInsufficientPayoutFunds: u64 = 5;
const EPaused: u64 = 6;
const ENoPendingChange: u64 = 8;
const ETimelockNotElapsed: u64 = 9;
const EInsufficientFunds: u64 = 10;
const EAccountSuspended: u64 = 12;
const ENothingToClaim: u64 = 13;
const EWrongRegistry: u64 = 14;
const EAccountNotPassed: u64 = 15;
const EExceedsRecoverable: u64 = 16;
const EWrongEvalFee: u64 = 17;

// === Constants ===

/// Sentinel value indicating no pending address change.
const NO_PENDING: address = @0x0;

// === Structs ===

/// The shared treasury. Holds three USDC pools, two destination addresses with
/// a timelock on changes, a pause switch, and lifetime counters for every flow.
public struct Treasury has key {
    id: UID,
    paused: bool,
    // --- destination addresses ---
    fees_address: address,
    eval_funds_address: address,
    // --- timelock for address changes ---
    pending_fees_address: address,
    pending_eval_funds_address: address,
    fees_address_proposed_at_ms: u64,
    eval_funds_address_proposed_at_ms: u64,
    address_change_delay_ms: u64,
    // --- USDC pools ---
    fees_balance: Balance<USDC>,
    eval_funds_balance: Balance<USDC>,
    payout_balance: Balance<USDC>,
    // --- per-account claimable payout ledger ---
    claimable: Table<ID, u64>,
    // Sum of all outstanding `claimable` entries. Funds up to this much are
    // owed to traders and may never be drained by admin recovery.
    total_claimable: u64,
    // --- lifetime counters ---
    total_fees_collected: u64,
    total_eval_fees_collected: u64,
    total_fees_withdrawn: u64,
    total_eval_funds_withdrawn: u64,
    total_payouts_funded: u64,
    total_payouts_disbursed: u64,
    total_payouts_recovered: u64,
}

/// A single-use ticket minted once at publish and consumed by `create_treasury`.
/// Because exactly one is ever minted (in `init`) and it is destroyed on first
/// use, the treasury can be created at most once — no duplicate treasuries.
public struct TreasuryCreatorCap has key, store {
    id: UID,
}

// === Events ===

/// Emitted when the treasury is created.
public struct TreasuryCreated has copy, drop {
    treasury_id: ID,
    created_by: address,
    fees_address: address,
    eval_funds_address: address,
    address_change_delay_ms: u64,
    timestamp_ms: u64,
}

/// Emitted when the treasury is paused or unpaused.
public struct TreasuryPauseToggled has copy, drop {
    treasury_id: ID,
    toggled_by: address,
    paused: bool,
    timestamp_ms: u64,
}

/// Emitted when a new fees address is proposed (timelock starts).
public struct FeesAddressProposed has copy, drop {
    treasury_id: ID,
    proposed_by: address,
    current_address: address,
    proposed_address: address,
    confirmable_at_ms: u64,
    timestamp_ms: u64,
}

/// Emitted when a proposed fees address is confirmed (timelock elapsed).
public struct FeesAddressConfirmed has copy, drop {
    treasury_id: ID,
    confirmed_by: address,
    previous_address: address,
    new_address: address,
    timestamp_ms: u64,
}

/// Emitted when a new eval funds address is proposed (timelock starts).
public struct EvalFundsAddressProposed has copy, drop {
    treasury_id: ID,
    proposed_by: address,
    current_address: address,
    proposed_address: address,
    confirmable_at_ms: u64,
    timestamp_ms: u64,
}

/// Emitted when a proposed eval funds address is confirmed (timelock elapsed).
public struct EvalFundsAddressConfirmed has copy, drop {
    treasury_id: ID,
    confirmed_by: address,
    previous_address: address,
    new_address: address,
    timestamp_ms: u64,
}

/// Emitted when a pending address change is cancelled.
public struct AddressChangeCancelled has copy, drop {
    treasury_id: ID,
    cancelled_by: address,
    field: u8,
    cancelled_address: address,
    timestamp_ms: u64,
}

/// Emitted when a platform fee is collected.
public struct FeeCollected has copy, drop {
    treasury_id: ID,
    collector: address,
    amount: u64,
    fees_balance_after: u64,
    total_fees_collected_after: u64,
    timestamp_ms: u64,
}

/// Emitted when an evaluation fee is collected.
public struct EvalFeeCollected has copy, drop {
    treasury_id: ID,
    collector: address,
    amount: u64,
    eval_balance_after: u64,
    total_eval_fees_collected_after: u64,
    timestamp_ms: u64,
}

/// Emitted when the payout pool is funded.
public struct PayoutFunded has copy, drop {
    treasury_id: ID,
    funded_by: address,
    amount: u64,
    payout_balance_after: u64,
    total_payouts_funded_after: u64,
    timestamp_ms: u64,
}

/// Emitted when fees are withdrawn to the fees destination.
public struct FeesWithdrawn has copy, drop {
    treasury_id: ID,
    withdrawn_by: address,
    destination: address,
    amount: u64,
    fees_balance_after: u64,
    total_fees_withdrawn_after: u64,
    timestamp_ms: u64,
}

/// Emitted when eval funds are withdrawn to the eval destination.
public struct EvalFundsWithdrawn has copy, drop {
    treasury_id: ID,
    withdrawn_by: address,
    destination: address,
    amount: u64,
    eval_balance_after: u64,
    total_eval_funds_withdrawn_after: u64,
    timestamp_ms: u64,
}

/// Emitted when the admin recovers funds from the payout pool.
public struct PayoutRecovered has copy, drop {
    treasury_id: ID,
    recovered_by: address,
    recipient: address,
    amount: u64,
    payout_balance_after: u64,
    total_payouts_recovered_after: u64,
    timestamp_ms: u64,
}

/// Emitted when the engine credits an account's claimable payout balance.
public struct PayoutAccrued has copy, drop {
    treasury_id: ID,
    account_id: ID,
    accrued_by: address,
    amount: u64,
    claimable_after: u64,
    timestamp_ms: u64,
}

/// Emitted when a trader claims their accrued payout.
public struct PayoutClaimed has copy, drop {
    treasury_id: ID,
    account_id: ID,
    claimant: address,
    amount: u64,
    payout_balance_after: u64,
    total_payouts_disbursed_after: u64,
    timestamp_ms: u64,
}

// === Internal helpers ===

/// Aborts if the treasury is paused.
fun assert_not_paused(treasury: &Treasury) {
    assert!(!treasury.paused, EPaused);
}

// === Init ===

/// Runs once at publish, minting the single `TreasuryCreatorCap` to the deployer
/// so the treasury can be created exactly once via `create_treasury`.
fun init(ctx: &mut TxContext) {
    transfer::transfer(TreasuryCreatorCap { id: object::new(ctx) }, ctx.sender());
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

// === Admin functions ===

/// Creates and shares the treasury, consuming the one-time `TreasuryCreatorCap`
/// so it can never be created twice. `address_change_delay_ms` sets the timelock
/// period for any future address change (e.g. 86_400_000 for 24 hours).
public fun create_treasury(
    cap: &AdminCap,
    registry: &AccessRegistry,
    creator: TreasuryCreatorCap,
    fees_address: address,
    eval_funds_address: address,
    address_change_delay_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    access::assert_admin(registry, cap);
    let TreasuryCreatorCap { id } = creator;
    id.delete();
    assert!(fees_address != @0x0, EZeroAddress);
    assert!(eval_funds_address != @0x0, EZeroAddress);

    let treasury = Treasury {
        id: object::new(ctx),
        paused: false,
        fees_address,
        eval_funds_address,
        pending_fees_address: NO_PENDING,
        pending_eval_funds_address: NO_PENDING,
        fees_address_proposed_at_ms: 0,
        eval_funds_address_proposed_at_ms: 0,
        address_change_delay_ms,
        fees_balance: balance::zero<USDC>(),
        eval_funds_balance: balance::zero<USDC>(),
        payout_balance: balance::zero<USDC>(),
        claimable: table::new(ctx),
        total_claimable: 0,
        total_fees_collected: 0,
        total_eval_fees_collected: 0,
        total_fees_withdrawn: 0,
        total_eval_funds_withdrawn: 0,
        total_payouts_funded: 0,
        total_payouts_disbursed: 0,
        total_payouts_recovered: 0,
    };

    event::emit(TreasuryCreated {
        treasury_id: object::id(&treasury),
        created_by: ctx.sender(),
        fees_address,
        eval_funds_address,
        address_change_delay_ms,
        timestamp_ms: clock.timestamp_ms(),
    });

    transfer::share_object(treasury);
}

/// Pauses the treasury. All deposits, withdrawals, and payouts are blocked until
/// unpaused.
public fun pause(
    cap: &AdminCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_admin(registry, cap);
    treasury.paused = true;
    event::emit(TreasuryPauseToggled {
        treasury_id: object::id(treasury),
        toggled_by: ctx.sender(),
        paused: true,
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Unpauses the treasury, re-enabling all operations.
public fun unpause(
    cap: &AdminCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_admin(registry, cap);
    treasury.paused = false;
    event::emit(TreasuryPauseToggled {
        treasury_id: object::id(treasury),
        toggled_by: ctx.sender(),
        paused: false,
        timestamp_ms: clock.timestamp_ms(),
    });
}

// === Address changes (admin-only, timelocked) ===

/// Proposes a new fees destination address. The change cannot be confirmed until
/// `address_change_delay_ms` has elapsed.
public fun propose_fees_address(
    cap: &AdminCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    new_address: address,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_admin(registry, cap);
    assert!(new_address != @0x0, EZeroAddress);
    let now_ms = clock.timestamp_ms();
    treasury.pending_fees_address = new_address;
    treasury.fees_address_proposed_at_ms = now_ms;

    event::emit(FeesAddressProposed {
        treasury_id: object::id(treasury),
        proposed_by: ctx.sender(),
        current_address: treasury.fees_address,
        proposed_address: new_address,
        confirmable_at_ms: now_ms + treasury.address_change_delay_ms,
        timestamp_ms: now_ms,
    });
}

/// Confirms the pending fees address change after the timelock has elapsed.
public fun confirm_fees_address(
    cap: &AdminCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_admin(registry, cap);
    assert!(treasury.pending_fees_address != NO_PENDING, ENoPendingChange);
    let now_ms = clock.timestamp_ms();
    assert!(
        now_ms >= treasury.fees_address_proposed_at_ms + treasury.address_change_delay_ms,
        ETimelockNotElapsed,
    );

    let previous_address = treasury.fees_address;
    treasury.fees_address = treasury.pending_fees_address;
    treasury.pending_fees_address = NO_PENDING;
    treasury.fees_address_proposed_at_ms = 0;

    event::emit(FeesAddressConfirmed {
        treasury_id: object::id(treasury),
        confirmed_by: ctx.sender(),
        previous_address,
        new_address: treasury.fees_address,
        timestamp_ms: now_ms,
    });
}

/// Proposes a new eval funds destination address with the same timelock.
public fun propose_eval_funds_address(
    cap: &AdminCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    new_address: address,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_admin(registry, cap);
    assert!(new_address != @0x0, EZeroAddress);
    let now_ms = clock.timestamp_ms();
    treasury.pending_eval_funds_address = new_address;
    treasury.eval_funds_address_proposed_at_ms = now_ms;

    event::emit(EvalFundsAddressProposed {
        treasury_id: object::id(treasury),
        proposed_by: ctx.sender(),
        current_address: treasury.eval_funds_address,
        proposed_address: new_address,
        confirmable_at_ms: now_ms + treasury.address_change_delay_ms,
        timestamp_ms: now_ms,
    });
}

/// Confirms the pending eval funds address change after the timelock has elapsed.
public fun confirm_eval_funds_address(
    cap: &AdminCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_admin(registry, cap);
    assert!(treasury.pending_eval_funds_address != NO_PENDING, ENoPendingChange);
    let now_ms = clock.timestamp_ms();
    assert!(
        now_ms >= treasury.eval_funds_address_proposed_at_ms + treasury.address_change_delay_ms,
        ETimelockNotElapsed,
    );

    let previous_address = treasury.eval_funds_address;
    treasury.eval_funds_address = treasury.pending_eval_funds_address;
    treasury.pending_eval_funds_address = NO_PENDING;
    treasury.eval_funds_address_proposed_at_ms = 0;

    event::emit(EvalFundsAddressConfirmed {
        treasury_id: object::id(treasury),
        confirmed_by: ctx.sender(),
        previous_address,
        new_address: treasury.eval_funds_address,
        timestamp_ms: now_ms,
    });
}

/// Cancels a pending fees address change.
public fun cancel_fees_address_change(
    cap: &AdminCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_admin(registry, cap);
    assert!(treasury.pending_fees_address != NO_PENDING, ENoPendingChange);
    let cancelled = treasury.pending_fees_address;
    treasury.pending_fees_address = NO_PENDING;
    treasury.fees_address_proposed_at_ms = 0;

    event::emit(AddressChangeCancelled {
        treasury_id: object::id(treasury),
        cancelled_by: ctx.sender(),
        field: 0,
        cancelled_address: cancelled,
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Cancels a pending eval funds address change.
public fun cancel_eval_funds_address_change(
    cap: &AdminCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_admin(registry, cap);
    assert!(treasury.pending_eval_funds_address != NO_PENDING, ENoPendingChange);
    let cancelled = treasury.pending_eval_funds_address;
    treasury.pending_eval_funds_address = NO_PENDING;
    treasury.eval_funds_address_proposed_at_ms = 0;

    event::emit(AddressChangeCancelled {
        treasury_id: object::id(treasury),
        cancelled_by: ctx.sender(),
        field: 1,
        cancelled_address: cancelled,
        timestamp_ms: clock.timestamp_ms(),
    });
}

// === Admin withdrawals ===

/// Withdraws a specific amount of accumulated fees to the fees destination.
public fun withdraw_fees(
    cap: &AdminCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    access::assert_admin(registry, cap);
    assert_not_paused(treasury);
    assert!(amount > 0, EZeroAmount);
    assert!(amount <= treasury.fees_balance.value(), EInsufficientFunds);

    let coin = treasury.fees_balance.split(amount).into_coin(ctx);
    let destination = treasury.fees_address;
    treasury.total_fees_withdrawn = treasury.total_fees_withdrawn + amount;

    event::emit(FeesWithdrawn {
        treasury_id: object::id(treasury),
        withdrawn_by: ctx.sender(),
        destination,
        amount,
        fees_balance_after: treasury.fees_balance.value(),
        total_fees_withdrawn_after: treasury.total_fees_withdrawn,
        timestamp_ms: clock.timestamp_ms(),
    });

    transfer::public_transfer(coin, destination);
}

/// Withdraws a specific amount of accumulated eval funds to the eval destination.
public fun withdraw_eval_funds(
    cap: &AdminCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    access::assert_admin(registry, cap);
    assert_not_paused(treasury);
    assert!(amount > 0, EZeroAmount);
    assert!(amount <= treasury.eval_funds_balance.value(), EInsufficientFunds);

    let coin = treasury.eval_funds_balance.split(amount).into_coin(ctx);
    let destination = treasury.eval_funds_address;
    treasury.total_eval_funds_withdrawn = treasury.total_eval_funds_withdrawn + amount;

    event::emit(EvalFundsWithdrawn {
        treasury_id: object::id(treasury),
        withdrawn_by: ctx.sender(),
        destination,
        amount,
        eval_balance_after: treasury.eval_funds_balance.value(),
        total_eval_funds_withdrawn_after: treasury.total_eval_funds_withdrawn,
        timestamp_ms: clock.timestamp_ms(),
    });

    transfer::public_transfer(coin, destination);
}

/// Recovers *unobligated* funds from the payout pool to a specified address.
/// Only the surplus above `total_claimable` — the sum already promised to
/// traders — can ever be recovered, so admin recovery can never strand a trader
/// who has accrued but not yet claimed. Used to pull back overfunded payouts.
public fun recover_payout_funds(
    cap: &AdminCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    amount: u64,
    recipient: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    access::assert_admin(registry, cap);
    assert_not_paused(treasury);
    assert!(amount > 0, EZeroAmount);
    assert!(recipient != @0x0, EZeroAddress);
    let balance = treasury.payout_balance.value();
    let recoverable = if (balance > treasury.total_claimable) {
        balance - treasury.total_claimable
    } else {
        0
    };
    assert!(amount <= recoverable, EExceedsRecoverable);

    let coin = treasury.payout_balance.split(amount).into_coin(ctx);
    treasury.total_payouts_recovered = treasury.total_payouts_recovered + amount;

    event::emit(PayoutRecovered {
        treasury_id: object::id(treasury),
        recovered_by: ctx.sender(),
        recipient,
        amount,
        payout_balance_after: treasury.payout_balance.value(),
        total_payouts_recovered_after: treasury.total_payouts_recovered,
        timestamp_ms: clock.timestamp_ms(),
    });

    transfer::public_transfer(coin, recipient);
}

// === Executor functions ===

/// Deposits a collected platform fee into the treasury's fee pool.
public fun collect_fee(
    cap: &ExecutorCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    payment: Coin<USDC>,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_executor(registry, cap);
    assert_not_paused(treasury);
    let amount = payment.value();
    assert!(amount > 0, EZeroAmount);
    treasury.fees_balance.join(payment.into_balance());
    treasury.total_fees_collected = treasury.total_fees_collected + amount;

    event::emit(FeeCollected {
        treasury_id: object::id(treasury),
        collector: ctx.sender(),
        amount,
        fees_balance_after: treasury.fees_balance.value(),
        total_fees_collected_after: treasury.total_fees_collected,
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Deposits a collected evaluation fee into the treasury's eval fund pool. The
/// payment must exactly equal the tier's published `eval_fee`, so an executor
/// can neither under- nor over-charge a trader relative to on-chain pricing.
public fun collect_eval_fee(
    cap: &ExecutorCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    config: &TierConfig,
    tier: Tier,
    payment: Coin<USDC>,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_executor(registry, cap);
    assert_not_paused(treasury);
    let amount = payment.value();
    assert!(amount > 0, EZeroAmount);
    assert!(amount == config.row(tier).eval_fee(), EWrongEvalFee);
    treasury.eval_funds_balance.join(payment.into_balance());
    treasury.total_eval_fees_collected = treasury.total_eval_fees_collected + amount;

    event::emit(EvalFeeCollected {
        treasury_id: object::id(treasury),
        collector: ctx.sender(),
        amount,
        eval_balance_after: treasury.eval_funds_balance.value(),
        total_eval_fees_collected_after: treasury.total_eval_fees_collected,
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Funds the payout pool so traders' profit shares can be disbursed.
public fun fund_payouts(
    cap: &ExecutorCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    payment: Coin<USDC>,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_executor(registry, cap);
    assert_not_paused(treasury);
    let amount = payment.value();
    assert!(amount > 0, EZeroAmount);
    treasury.payout_balance.join(payment.into_balance());
    treasury.total_payouts_funded = treasury.total_payouts_funded + amount;

    event::emit(PayoutFunded {
        treasury_id: object::id(treasury),
        funded_by: ctx.sender(),
        amount,
        payout_balance_after: treasury.payout_balance.value(),
        total_payouts_funded_after: treasury.total_payouts_funded,
        timestamp_ms: clock.timestamp_ms(),
    });
}

// === Onboarding ===

/// Atomically onboards a trader: takes the trader's `Coin<USDC>`, asserts it
/// equals the tier's published `eval_fee`, deposits it into the eval pool, and
/// creates the account in the same transaction. This is the only public path to
/// open an account, so an account can never exist without on-chain proof its
/// evaluation fee was paid at the correct price. Admin-gated because onboarding
/// commits the firm to the tier's funded allocation.
public fun open_account(
    cap: &AdminCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    accounts: &mut AccountRegistry,
    config: &TierConfig,
    tier: Tier,
    payment: Coin<USDC>,
    owner: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    access::assert_admin(registry, cap);
    assert_not_paused(treasury);
    let amount = payment.value();
    assert!(amount == config.row(tier).eval_fee(), EWrongEvalFee);

    treasury.eval_funds_balance.join(payment.into_balance());
    treasury.total_eval_fees_collected = treasury.total_eval_fees_collected + amount;

    event::emit(EvalFeeCollected {
        treasury_id: object::id(treasury),
        collector: ctx.sender(),
        amount,
        eval_balance_after: treasury.eval_funds_balance.value(),
        total_eval_fees_collected_after: treasury.total_eval_fees_collected,
        timestamp_ms: clock.timestamp_ms(),
    });

    user_account::create_account(cap, registry, accounts, config, tier, owner, clock, ctx);
}

// === Payouts ===

/// Credits an account's claimable payout balance. The engine calls this after
/// computing a trader's profit share off-chain; the trader later pulls it via
/// `claim`. Executor-gated and blacklist-checked. The account must exist and be
/// `Passed` — payouts can never be accrued to an evaluating, failed, or
/// suspended account. The credited amount is also tracked in `total_claimable`
/// so admin recovery can never drain it.
public fun accrue_payout(
    cap: &ExecutorCap,
    registry: &AccessRegistry,
    treasury: &mut Treasury,
    accounts: &AccountRegistry,
    account_id: ID,
    amount: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    access::assert_executor(registry, cap);
    assert_not_paused(treasury);
    assert!(amount > 0, EZeroAmount);
    assert!(user_account::account_exists(accounts, account_id), EAccountNotPassed);
    assert!(user_account::is_passed(accounts, account_id), EAccountNotPassed);

    if (treasury.claimable.contains(account_id)) {
        let owed = treasury.claimable.borrow_mut(account_id);
        *owed = *owed + amount;
    } else {
        treasury.claimable.add(account_id, amount);
    };
    treasury.total_claimable = treasury.total_claimable + amount;
    let claimable_after = *treasury.claimable.borrow(account_id);

    event::emit(PayoutAccrued {
        treasury_id: object::id(treasury),
        account_id,
        accrued_by: ctx.sender(),
        amount,
        claimable_after,
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Disburses a trader's full accrued payout to them. The trader proves identity
/// with their `AccountCap`; suspended accounts are blocked. Funds transfer
/// internally to the claimant and the account's lifetime paid total is synced.
#[allow(lint(self_transfer))]
public fun claim(
    cap: &AccountCap,
    accounts: &mut AccountRegistry,
    treasury: &mut Treasury,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_not_paused(treasury);
    let account_id = user_account::cap_account_id(cap);
    assert!(user_account::cap_registry_id(cap) == object::id(accounts), EWrongRegistry);
    assert!(!user_account::is_suspended(accounts, account_id), EAccountSuspended);
    assert!(treasury.claimable.contains(account_id), ENothingToClaim);

    let amount = treasury.claimable.remove(account_id);
    treasury.total_claimable = treasury.total_claimable - amount;
    assert!(amount > 0, ENothingToClaim);
    assert!(amount <= treasury.payout_balance.value(), EInsufficientPayoutFunds);

    let coin = treasury.payout_balance.split(amount).into_coin(ctx);
    treasury.total_payouts_disbursed = treasury.total_payouts_disbursed + amount;
    user_account::record_payout(accounts, account_id, amount, clock);

    let claimant = ctx.sender();
    event::emit(PayoutClaimed {
        treasury_id: object::id(treasury),
        account_id,
        claimant,
        amount,
        payout_balance_after: treasury.payout_balance.value(),
        total_payouts_disbursed_after: treasury.total_payouts_disbursed,
        timestamp_ms: clock.timestamp_ms(),
    });

    transfer::public_transfer(coin, claimant);
}

// === Getters ===

/// Returns whether the treasury is currently paused.
public fun is_paused(treasury: &Treasury): bool { treasury.paused }

/// Returns the current fees destination address.
public fun fees_address(treasury: &Treasury): address { treasury.fees_address }

/// Returns the current eval funds destination address.
public fun eval_funds_address(treasury: &Treasury): address { treasury.eval_funds_address }

/// Returns the pending fees address (0x0 if none).
public fun pending_fees_address(treasury: &Treasury): address { treasury.pending_fees_address }

/// Returns the pending eval funds address (0x0 if none).
public fun pending_eval_funds_address(treasury: &Treasury): address { treasury.pending_eval_funds_address }

/// Returns the timelock delay for address changes in milliseconds.
public fun address_change_delay_ms(treasury: &Treasury): u64 { treasury.address_change_delay_ms }

/// Returns the current fees balance pending withdrawal.
public fun fees_balance(treasury: &Treasury): u64 { treasury.fees_balance.value() }

/// Returns the current eval funds balance pending withdrawal.
public fun eval_funds_balance(treasury: &Treasury): u64 { treasury.eval_funds_balance.value() }

/// Returns the current payout pool balance available for disbursement.
public fun payout_balance(treasury: &Treasury): u64 { treasury.payout_balance.value() }

/// Returns lifetime fees collected.
public fun total_fees_collected(treasury: &Treasury): u64 { treasury.total_fees_collected }

/// Returns lifetime eval fees collected.
public fun total_eval_fees_collected(treasury: &Treasury): u64 { treasury.total_eval_fees_collected }

/// Returns lifetime fees withdrawn.
public fun total_fees_withdrawn(treasury: &Treasury): u64 { treasury.total_fees_withdrawn }

/// Returns lifetime eval funds withdrawn.
public fun total_eval_funds_withdrawn(treasury: &Treasury): u64 { treasury.total_eval_funds_withdrawn }

/// Returns lifetime USDC funded into the payout pool.
public fun total_payouts_funded(treasury: &Treasury): u64 { treasury.total_payouts_funded }

/// Returns lifetime USDC disbursed to traders.
public fun total_payouts_disbursed(treasury: &Treasury): u64 { treasury.total_payouts_disbursed }

/// Returns the claimable payout balance accrued for an account.
public fun claimable(treasury: &Treasury, account_id: ID): u64 {
    if (treasury.claimable.contains(account_id)) *treasury.claimable.borrow(account_id) else 0
}

/// Returns lifetime USDC recovered from the payout pool by admin.
public fun total_payouts_recovered(treasury: &Treasury): u64 { treasury.total_payouts_recovered }

/// Returns the sum of all outstanding claimable payouts owed to traders. Funds
/// up to this amount are protected from admin recovery.
public fun total_claimable(treasury: &Treasury): u64 { treasury.total_claimable }
