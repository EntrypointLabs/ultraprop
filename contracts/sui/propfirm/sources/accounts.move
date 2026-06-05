/// The identity and performance layer. Each trader holds an owned `AccountCap`
/// (their proof of identity — transfer the cap, transfer the account) while all
/// mutable data lives in `AccountState` inside the shared `AccountRegistry`,
/// keyed by the cap's object ID. An account carries its own copy of the tier's
/// economics, snapshotted at creation from `tier_config`, so later config edits
/// never retroactively change open accounts. This module is purely the
/// accounting and risk layer: it knows no USDC, holds no balances, and never
/// touches the vault or treasury. The off-chain engine (holding an
/// `ExecutorCap`, validated against the access blacklist) drives evaluation via
/// `log_trade` and friends; the admin drives lifecycle. All bps arithmetic goes
/// through the OpenZeppelin math library.
module propfirm::user_account;

use propfirm::access::{Self, AdminCap, ExecutorCap, AccessRegistry};
use propfirm::tier_config::{Tier, TierConfig};
use sui::{
    clock::Clock,
    event,
    table::{Self, Table}
};
use openzeppelin_math::{
    u64 as oz_u64,
    rounding
};

// === Errors ===

const EUnknownAccount: u64 = 1;
const EAccountNotActive: u64 = 2;
const ENotEvaluating: u64 = 3;
const ENotPassed: u64 = 4;
const ENotBreached: u64 = 5;
const EProfitTargetNotMet: u64 = 6;
const ETierDoesNotScale: u64 = 7;
const EMathOverflow: u64 = 8;
const EZeroAmount: u64 = 9;
const EMonthNotAfterLast: u64 = 10;

// === Constants ===

/// Milliseconds per UTC day, for rolling the daily-loss baseline.
const DAY_MS: u64 = 86_400_000;

const BPS_DENOM: u64 = 10_000;

/// Reputation starts here and is clamped to `[0, MAX_REPUTATION]`.
const INITIAL_REPUTATION: u64 = 1_000;
const MAX_REPUTATION: u64 = 2_000;

/// Per-trade reputation deltas, the breach penalty, the profitable-month streak
/// bonus, and the evaluation-pass bonus.
const REP_WIN: u64 = 5;
const REP_LOSS: u64 = 5;
const REP_BREACH_PENALTY: u64 = 200;
const REP_STREAK_BONUS: u64 = 25;
const REP_PASS_BONUS: u64 = 100;

/// Breach reason codes carried on `AccountBreached`.
const REASON_DAILY_LOSS: u8 = 1;
const REASON_MAX_DRAWDOWN: u8 = 2;
const REASON_OFFCHAIN: u8 = 3;

// === Structs ===

/// Lifecycle state of an account. `Evaluating` and `Passed` both permit trading;
/// `Passed` additionally permits payouts. `Failed` and `Suspended` are terminal
/// until an admin `reactivate`s.
public enum AccountStatus has copy, drop, store {
    Evaluating,
    Passed,
    Failed,
    Suspended,
}

/// Owned proof of identity held in the trader's wallet. Its object ID is the
/// account key in the registry. Holding it is the trader's authority over the
/// account.
public struct AccountCap has key, store {
    id: UID,
    registry_id: ID,
    created_at_ms: u64,
}

/// One journal entry per closed trade.
public struct TradeEntry has store, copy, drop {
    seq: u64,
    is_win: bool,
    pnl: u64,
    equity_after: u64,
    reputation_after: u64,
    timestamp_ms: u64,
}

/// All mutable account data, stored in the shared registry. Economics
/// (`funded_size`, `profit_target`, `max_dd_floor`, `daily_loss_limit`,
/// `user_split_bps`, `trading_fee_bps`) are snapshotted from the tier at
/// creation/promotion and never re-read from config.
public struct AccountState has store {
    tier: Tier,
    status: AccountStatus,
    reputation: u64,
    funded_size: u64,
    profit_target: u64,
    max_dd_floor: u64,
    daily_loss_limit: u64,
    user_split_bps: u64,
    trading_fee_bps: u64,
    equity: u64,
    day_start_equity: u64,
    current_day: u64,
    trades: Table<u64, TradeEntry>,
    next_trade_seq: u64,
    total_trades: u64,
    wins: u64,
    losses: u64,
    gross_profit: u64,
    gross_loss: u64,
    breach_count: u64,
    total_paid: u64,
    months_closed: u64,
    last_closed_month: u64,
    profit_streak: u64,
    best_streak: u64,
    created_at_ms: u64,
    updated_at_ms: u64,
}

/// The shared object holding every account's state, keyed by account ID.
public struct AccountRegistry has key {
    id: UID,
    accounts: Table<ID, AccountState>,
    total_accounts: u64,
}

// === Events ===

public struct AccountRegistryCreated has copy, drop {
    registry_id: ID,
}

public struct AccountCreated has copy, drop {
    registry_id: ID,
    account_id: ID,
    owner: address,
    tier: Tier,
    funded_size: u64,
    profit_target: u64,
    timestamp_ms: u64,
}

public struct TradeLogged has copy, drop {
    account_id: ID,
    seq: u64,
    is_win: bool,
    pnl: u64,
    equity_after: u64,
    reputation_after: u64,
    timestamp_ms: u64,
}

public struct AccountBreached has copy, drop {
    account_id: ID,
    reason: u8,
    equity: u64,
    breach_count: u64,
    timestamp_ms: u64,
}

public struct EvaluationPassed has copy, drop {
    account_id: ID,
    equity: u64,
    reputation_after: u64,
    timestamp_ms: u64,
}

public struct EvaluationFailed has copy, drop {
    account_id: ID,
    equity: u64,
    timestamp_ms: u64,
}

public struct MonthClosed has copy, drop {
    account_id: ID,
    month: u64,
    was_profitable: bool,
    profit_streak: u64,
    best_streak: u64,
    reputation_after: u64,
    timestamp_ms: u64,
}

public struct ReputationAdjusted has copy, drop {
    account_id: ID,
    is_increase: bool,
    amount: u64,
    reputation_after: u64,
    timestamp_ms: u64,
}

public struct AccountReactivated has copy, drop {
    account_id: ID,
    tier: Tier,
    funded_size: u64,
    timestamp_ms: u64,
}

public struct AccountPromoted has copy, drop {
    account_id: ID,
    previous_tier: Tier,
    new_tier: Tier,
    funded_size: u64,
    user_split_bps: u64,
    timestamp_ms: u64,
}

public struct PayoutRecorded has copy, drop {
    account_id: ID,
    amount: u64,
    total_paid_after: u64,
    timestamp_ms: u64,
}

// === Internal helpers ===

/// Multiplies then divides with floor rounding via the OpenZeppelin math lib.
fun mul_div_down(a: u64, b: u64, denominator: u64): u64 {
    let result = oz_u64::mul_div(a, b, denominator, rounding::down());
    assert!(result.is_some(), EMathOverflow);
    result.destroy_some()
}

/// Saturating subtraction (floors at 0).
fun sub_floor(a: u64, b: u64): u64 {
    if (b >= a) 0 else a - b
}

/// Adds a delta and clamps to the reputation ceiling. Overflow-safe even for a
/// huge discretionary `delta`.
fun rep_up(rep: u64, delta: u64): u64 {
    if (delta >= MAX_REPUTATION) {
        MAX_REPUTATION
    } else {
        let headroom = MAX_REPUTATION - delta;
        if (rep >= headroom) MAX_REPUTATION else rep + delta
    }
}

/// Whether the status permits logging trades.
fun trading_allowed(status: AccountStatus): bool {
    match (status) {
        AccountStatus::Evaluating => true,
        AccountStatus::Passed => true,
        _ => false,
    }
}

/// Builds an economics-laden state from a tier's published row. Equity opens at
/// the funded size; the day baseline starts there too.
fun new_state(
    config: &TierConfig,
    tier: Tier,
    now_ms: u64,
    ctx: &mut TxContext,
): AccountState {
    let row = config.row(tier);
    let funded_size = row.funded_size();
    let profit_target = funded_size + mul_div_down(funded_size, row.profit_target_bps(), BPS_DENOM);
    let max_dd_floor = funded_size - mul_div_down(funded_size, row.max_dd_bps(), BPS_DENOM);
    let daily_loss_limit = mul_div_down(funded_size, row.daily_loss_bps(), BPS_DENOM);

    AccountState {
        tier,
        status: AccountStatus::Evaluating,
        reputation: INITIAL_REPUTATION,
        funded_size,
        profit_target,
        max_dd_floor,
        daily_loss_limit,
        user_split_bps: row.user_split_bps(),
        trading_fee_bps: row.trading_fee_bps(),
        equity: funded_size,
        day_start_equity: funded_size,
        current_day: now_ms / DAY_MS,
        trades: table::new(ctx),
        next_trade_seq: 0,
        total_trades: 0,
        wins: 0,
        losses: 0,
        gross_profit: 0,
        gross_loss: 0,
        breach_count: 0,
        total_paid: 0,
        months_closed: 0,
        last_closed_month: 0,
        profit_streak: 0,
        best_streak: 0,
        created_at_ms: now_ms,
        updated_at_ms: now_ms,
    }
}

/// Resets an existing state's evaluation cycle onto a (possibly new) tier's
/// economics, preserving reputation, journal, and lifetime stats. Used by
/// `reactivate` (same tier) and `promote` (next tier).
fun reset_cycle(state: &mut AccountState, config: &TierConfig, tier: Tier, now_ms: u64) {
    let row = config.row(tier);
    let funded_size = row.funded_size();
    state.tier = tier;
    state.status = AccountStatus::Evaluating;
    state.funded_size = funded_size;
    state.profit_target = funded_size + mul_div_down(funded_size, row.profit_target_bps(), BPS_DENOM);
    state.max_dd_floor = funded_size - mul_div_down(funded_size, row.max_dd_bps(), BPS_DENOM);
    state.daily_loss_limit = mul_div_down(funded_size, row.daily_loss_bps(), BPS_DENOM);
    state.user_split_bps = row.user_split_bps();
    state.trading_fee_bps = row.trading_fee_bps();
    state.equity = funded_size;
    state.day_start_equity = funded_size;
    state.current_day = now_ms / DAY_MS;
    state.updated_at_ms = now_ms;
}

fun borrow_account(accounts: &AccountRegistry, account_id: ID): &AccountState {
    assert!(accounts.accounts.contains(account_id), EUnknownAccount);
    accounts.accounts.borrow(account_id)
}

fun borrow_account_mut(accounts: &mut AccountRegistry, account_id: ID): &mut AccountState {
    assert!(accounts.accounts.contains(account_id), EUnknownAccount);
    accounts.accounts.borrow_mut(account_id)
}

// === Init ===

/// Runs once at publish, creating and sharing the single account registry. There
/// is intentionally no public constructor, so the registry is a true singleton —
/// operators and frontends can never be routed to a duplicate.
fun init(ctx: &mut TxContext) {
    let registry = AccountRegistry {
        id: object::new(ctx),
        accounts: table::new(ctx),
        total_accounts: 0,
    };
    event::emit(AccountRegistryCreated { registry_id: object::id(&registry) });
    transfer::share_object(registry);
}

// === Admin functions ===

/// Onboards a trader at a tier on the firm's published terms. Snapshots the
/// tier's economics into the new account, stores the state in the registry, and
/// transfers the owned `AccountCap` to the trader. Package-visible: the only
/// public path to open an account is `treasury::open_account`, which atomically
/// collects the tier's evaluation fee, so an account can never exist without
/// on-chain proof its fee was paid.
public(package) fun create_account(
    cap: &AdminCap,
    access_registry: &AccessRegistry,
    accounts: &mut AccountRegistry,
    config: &TierConfig,
    tier: Tier,
    owner: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    access::assert_admin(access_registry, cap);
    let registry_id = object::id(accounts);
    let now_ms = clock.timestamp_ms();

    let cap = AccountCap {
        id: object::new(ctx),
        registry_id,
        created_at_ms: now_ms,
    };
    let account_id = object::id(&cap);

    let state = new_state(config, tier, now_ms, ctx);
    let profit_target = state.profit_target;
    let funded_size = state.funded_size;

    accounts.accounts.add(account_id, state);
    accounts.total_accounts = accounts.total_accounts + 1;

    event::emit(AccountCreated {
        registry_id,
        account_id,
        owner,
        tier,
        funded_size,
        profit_target,
        timestamp_ms: now_ms,
    });
    transfer::transfer(cap, owner);
}

/// Puts a failed or suspended account back into evaluation, resetting the cycle
/// on its current tier while preserving reputation and history.
public fun reactivate(
    cap: &AdminCap,
    access_registry: &AccessRegistry,
    accounts: &mut AccountRegistry,
    account_id: ID,
    clock: &Clock,
    _ctx: &TxContext,
) {
    access::assert_admin(access_registry, cap);
    let now_ms = clock.timestamp_ms();
    let state = borrow_account_mut(accounts, account_id);
    assert!(
        match (state.status) {
            AccountStatus::Failed => true,
            AccountStatus::Suspended => true,
            _ => false,
        },
        ENotBreached,
    );
    // Re-opens the cycle on the account's existing (stored) terms — config is
    // never re-read, so published-term changes don't retroactively alter it.
    state.status = AccountStatus::Evaluating;
    state.equity = state.funded_size;
    state.day_start_equity = state.funded_size;
    state.current_day = now_ms / DAY_MS;
    state.updated_at_ms = now_ms;

    event::emit(AccountReactivated {
        account_id,
        tier: state.tier,
        funded_size: state.funded_size,
        timestamp_ms: now_ms,
    });
}

/// Scales a passed account up to the next tier (bigger allocation, better
/// split) and re-opens evaluation there. Requires the current tier to scale.
public fun promote(
    cap: &AdminCap,
    access_registry: &AccessRegistry,
    accounts: &mut AccountRegistry,
    config: &TierConfig,
    account_id: ID,
    clock: &Clock,
    _ctx: &TxContext,
) {
    access::assert_admin(access_registry, cap);
    let now_ms = clock.timestamp_ms();
    let state = borrow_account_mut(accounts, account_id);
    assert!(
        match (state.status) {
            AccountStatus::Passed => true,
            _ => false,
        },
        ENotPassed,
    );
    let previous_tier = state.tier;
    let row = config.row(previous_tier);
    assert!(row.scales(), ETierDoesNotScale);
    let new_tier = row.next_tier();

    reset_cycle(state, config, new_tier, now_ms);

    event::emit(AccountPromoted {
        account_id,
        previous_tier,
        new_tier,
        funded_size: state.funded_size,
        user_split_bps: state.user_split_bps,
        timestamp_ms: now_ms,
    });
}

// === Engine actions (executor-gated) ===

/// Applies a closed trade's PnL to equity, rolls the daily-loss baseline at UTC
/// day boundaries, enforces the daily-loss and static max-drawdown gates
/// (suspending on breach), updates reputation, and appends the journal entry.
public fun log_trade(
    cap: &ExecutorCap,
    access_registry: &AccessRegistry,
    accounts: &mut AccountRegistry,
    account_id: ID,
    is_win: bool,
    pnl: u64,
    clock: &Clock,
    _ctx: &TxContext,
) {
    access::assert_executor(access_registry, cap);
    let now_ms = clock.timestamp_ms();
    let state = borrow_account_mut(accounts, account_id);
    assert!(trading_allowed(state.status), EAccountNotActive);

    let now_day = now_ms / DAY_MS;
    if (now_day > state.current_day) {
        state.day_start_equity = state.equity;
        state.current_day = now_day;
    };

    if (is_win) {
        state.equity = state.equity + pnl;
        state.wins = state.wins + 1;
        state.gross_profit = state.gross_profit + pnl;
        state.reputation = rep_up(state.reputation, REP_WIN);
    } else {
        state.equity = sub_floor(state.equity, pnl);
        state.losses = state.losses + 1;
        state.gross_loss = state.gross_loss + pnl;
        state.reputation = sub_floor(state.reputation, REP_LOSS);
    };
    state.total_trades = state.total_trades + 1;

    let daily_drawdown = sub_floor(state.day_start_equity, state.equity);
    let breached_daily = daily_drawdown > 0 && daily_drawdown >= state.daily_loss_limit;
    let breached_dd = state.equity <= state.max_dd_floor;

    if (breached_daily || breached_dd) {
        state.status = AccountStatus::Suspended;
        state.breach_count = state.breach_count + 1;
        state.reputation = sub_floor(state.reputation, REP_BREACH_PENALTY);
    };

    let seq = state.next_trade_seq;
    state.trades.add(seq, TradeEntry {
        seq,
        is_win,
        pnl,
        equity_after: state.equity,
        reputation_after: state.reputation,
        timestamp_ms: now_ms,
    });
    state.next_trade_seq = seq + 1;
    state.updated_at_ms = now_ms;

    event::emit(TradeLogged {
        account_id,
        seq,
        is_win,
        pnl,
        equity_after: state.equity,
        reputation_after: state.reputation,
        timestamp_ms: now_ms,
    });

    if (breached_daily || breached_dd) {
        let reason = if (breached_daily) REASON_DAILY_LOSS else REASON_MAX_DRAWDOWN;
        event::emit(AccountBreached {
            account_id,
            reason,
            equity: state.equity,
            breach_count: state.breach_count,
            timestamp_ms: now_ms,
        });
    };
}

/// Marks an evaluating account as passed once its equity meets the profit
/// target. Awards a reputation bonus.
public fun pass_evaluation(
    cap: &ExecutorCap,
    access_registry: &AccessRegistry,
    accounts: &mut AccountRegistry,
    account_id: ID,
    clock: &Clock,
    _ctx: &TxContext,
) {
    access::assert_executor(access_registry, cap);
    let now_ms = clock.timestamp_ms();
    let state = borrow_account_mut(accounts, account_id);
    assert!(
        match (state.status) {
            AccountStatus::Evaluating => true,
            _ => false,
        },
        ENotEvaluating,
    );
    assert!(state.equity >= state.profit_target, EProfitTargetNotMet);
    state.status = AccountStatus::Passed;
    state.reputation = rep_up(state.reputation, REP_PASS_BONUS);
    state.updated_at_ms = now_ms;

    event::emit(EvaluationPassed {
        account_id,
        equity: state.equity,
        reputation_after: state.reputation,
        timestamp_ms: now_ms,
    });
}

/// Marks an evaluating account as failed (e.g. the engine's evaluation window
/// expired without the target being met).
public fun fail_evaluation(
    cap: &ExecutorCap,
    access_registry: &AccessRegistry,
    accounts: &mut AccountRegistry,
    account_id: ID,
    clock: &Clock,
    _ctx: &TxContext,
) {
    access::assert_executor(access_registry, cap);
    let now_ms = clock.timestamp_ms();
    let state = borrow_account_mut(accounts, account_id);
    assert!(
        match (state.status) {
            AccountStatus::Evaluating => true,
            _ => false,
        },
        ENotEvaluating,
    );
    state.status = AccountStatus::Failed;
    state.updated_at_ms = now_ms;

    event::emit(EvaluationFailed {
        account_id,
        equity: state.equity,
        timestamp_ms: now_ms,
    });
}

/// Suspends an active account for an off-chain risk event the engine detected
/// outside the per-trade gates.
public fun register_dd_breach(
    cap: &ExecutorCap,
    access_registry: &AccessRegistry,
    accounts: &mut AccountRegistry,
    account_id: ID,
    clock: &Clock,
    _ctx: &TxContext,
) {
    access::assert_executor(access_registry, cap);
    let now_ms = clock.timestamp_ms();
    let state = borrow_account_mut(accounts, account_id);
    assert!(trading_allowed(state.status), EAccountNotActive);
    state.status = AccountStatus::Suspended;
    state.breach_count = state.breach_count + 1;
    state.reputation = sub_floor(state.reputation, REP_BREACH_PENALTY);
    state.updated_at_ms = now_ms;

    event::emit(AccountBreached {
        account_id,
        reason: REASON_OFFCHAIN,
        equity: state.equity,
        breach_count: state.breach_count,
        timestamp_ms: now_ms,
    });
}

/// Records the close of a calendar month for streak tracking. A profitable
/// month extends the streak and awards a reputation bonus; an unprofitable one
/// resets the streak. `month` is a strictly increasing period identifier (e.g.
/// `year * 12 + month_index`); each must exceed the last one closed, so a month
/// can never be replayed to inflate streaks, `months_closed`, or reputation.
public fun close_month(
    cap: &ExecutorCap,
    access_registry: &AccessRegistry,
    accounts: &mut AccountRegistry,
    account_id: ID,
    month: u64,
    was_profitable: bool,
    clock: &Clock,
    _ctx: &TxContext,
) {
    access::assert_executor(access_registry, cap);
    let now_ms = clock.timestamp_ms();
    let state = borrow_account_mut(accounts, account_id);
    assert!(month > state.last_closed_month, EMonthNotAfterLast);
    state.last_closed_month = month;
    state.months_closed = state.months_closed + 1;
    if (was_profitable) {
        state.profit_streak = state.profit_streak + 1;
        if (state.profit_streak > state.best_streak) {
            state.best_streak = state.profit_streak;
        };
        state.reputation = rep_up(state.reputation, REP_STREAK_BONUS);
    } else {
        state.profit_streak = 0;
    };
    state.updated_at_ms = now_ms;

    event::emit(MonthClosed {
        account_id,
        month,
        was_profitable,
        profit_streak: state.profit_streak,
        best_streak: state.best_streak,
        reputation_after: state.reputation,
        timestamp_ms: now_ms,
    });
}

/// Applies a discretionary reputation bonus or penalty, clamped to the ceiling.
public fun adjust_reputation(
    cap: &ExecutorCap,
    access_registry: &AccessRegistry,
    accounts: &mut AccountRegistry,
    account_id: ID,
    is_increase: bool,
    amount: u64,
    clock: &Clock,
    _ctx: &TxContext,
) {
    access::assert_executor(access_registry, cap);
    assert!(amount > 0, EZeroAmount);
    let now_ms = clock.timestamp_ms();
    let state = borrow_account_mut(accounts, account_id);
    if (is_increase) {
        state.reputation = rep_up(state.reputation, amount);
    } else {
        state.reputation = sub_floor(state.reputation, amount);
    };
    state.updated_at_ms = now_ms;

    event::emit(ReputationAdjusted {
        account_id,
        is_increase,
        amount,
        reputation_after: state.reputation,
        timestamp_ms: now_ms,
    });
}

/// Syncs an account's lifetime paid total after a payout is disbursed.
/// Package-visible so only the treasury's claim flow (same package) can move it,
/// after it has verified the trader's `AccountCap` and that the account is not
/// suspended — traders cannot call it directly to inflate their own total.
public(package) fun record_payout(
    accounts: &mut AccountRegistry,
    account_id: ID,
    amount: u64,
    clock: &Clock,
) {
    assert!(amount > 0, EZeroAmount);
    let now_ms = clock.timestamp_ms();
    let state = borrow_account_mut(accounts, account_id);
    state.total_paid = state.total_paid + amount;
    state.updated_at_ms = now_ms;

    event::emit(PayoutRecorded {
        account_id,
        amount,
        total_paid_after: state.total_paid,
        timestamp_ms: now_ms,
    });
}

// === Getters ===

/// The account ID this cap controls (its own object ID).
public fun cap_account_id(cap: &AccountCap): ID { object::id(cap) }

/// The registry this cap's account lives in.
public fun cap_registry_id(cap: &AccountCap): ID { cap.registry_id }

/// Total accounts ever created.
public fun total_accounts(accounts: &AccountRegistry): u64 { accounts.total_accounts }

/// Whether an account currently exists in the registry.
public fun account_exists(accounts: &AccountRegistry, account_id: ID): bool {
    accounts.accounts.contains(account_id)
}

/// Whether the account is suspended (breached). The claiming module reads this
/// to block payouts to breached accounts.
public fun is_suspended(accounts: &AccountRegistry, account_id: ID): bool {
    match (borrow_account(accounts, account_id).status) {
        AccountStatus::Suspended => true,
        _ => false,
    }
}

/// Whether the account has passed evaluation (funded and payout-eligible).
public fun is_passed(accounts: &AccountRegistry, account_id: ID): bool {
    match (borrow_account(accounts, account_id).status) {
        AccountStatus::Passed => true,
        _ => false,
    }
}

/// Status as a code: 0 Evaluating, 1 Passed, 2 Failed, 3 Suspended.
public fun status_code(accounts: &AccountRegistry, account_id: ID): u8 {
    match (borrow_account(accounts, account_id).status) {
        AccountStatus::Evaluating => 0,
        AccountStatus::Passed => 1,
        AccountStatus::Failed => 2,
        AccountStatus::Suspended => 3,
    }
}

/// The account's tier.
public fun account_tier(accounts: &AccountRegistry, account_id: ID): Tier {
    borrow_account(accounts, account_id).tier
}

/// Current reputation score.
public fun reputation(accounts: &AccountRegistry, account_id: ID): u64 {
    borrow_account(accounts, account_id).reputation
}

/// Current evaluation equity.
public fun equity(accounts: &AccountRegistry, account_id: ID): u64 {
    borrow_account(accounts, account_id).equity
}

/// Funded size (allocation) for the current cycle.
public fun funded_size(accounts: &AccountRegistry, account_id: ID): u64 {
    borrow_account(accounts, account_id).funded_size
}

/// Absolute equity needed to pass evaluation.
public fun profit_target(accounts: &AccountRegistry, account_id: ID): u64 {
    borrow_account(accounts, account_id).profit_target
}

/// Equity floor below which the static max-drawdown gate trips.
public fun max_dd_floor(accounts: &AccountRegistry, account_id: ID): u64 {
    borrow_account(accounts, account_id).max_dd_floor
}

/// Daily loss (from the day's start equity) that trips the daily gate.
public fun daily_loss_limit(accounts: &AccountRegistry, account_id: ID): u64 {
    borrow_account(accounts, account_id).daily_loss_limit
}

/// The trader's profit split in bps for the current cycle.
public fun user_split_bps(accounts: &AccountRegistry, account_id: ID): u64 {
    borrow_account(accounts, account_id).user_split_bps
}

/// The per-trade trading fee in bps for the current cycle.
public fun trading_fee_bps(accounts: &AccountRegistry, account_id: ID): u64 {
    borrow_account(accounts, account_id).trading_fee_bps
}

/// Lifetime payouts recorded against the account.
public fun total_paid(accounts: &AccountRegistry, account_id: ID): u64 {
    borrow_account(accounts, account_id).total_paid
}

/// Lifetime trade counts: (total, wins, losses).
public fun trade_counts(accounts: &AccountRegistry, account_id: ID): (u64, u64, u64) {
    let state = borrow_account(accounts, account_id);
    (state.total_trades, state.wins, state.losses)
}

/// Streak stats: (current profitable-month streak, best streak, months closed).
public fun streaks(accounts: &AccountRegistry, account_id: ID): (u64, u64, u64) {
    let state = borrow_account(accounts, account_id);
    (state.profit_streak, state.best_streak, state.months_closed)
}

/// The most recent month period closed; the next `close_month` must exceed it.
public fun last_closed_month(accounts: &AccountRegistry, account_id: ID): u64 {
    borrow_account(accounts, account_id).last_closed_month
}

/// Number of breaches the account has incurred.
public fun breach_count(accounts: &AccountRegistry, account_id: ID): u64 {
    borrow_account(accounts, account_id).breach_count
}

/// A copy of the journal entry at the given sequence number.
public fun trade_at(accounts: &AccountRegistry, account_id: ID, seq: u64): TradeEntry {
    *borrow_account(accounts, account_id).trades.borrow(seq)
}

/// Number of journal entries recorded.
public fun trade_journal_len(accounts: &AccountRegistry, account_id: ID): u64 {
    borrow_account(accounts, account_id).next_trade_seq
}
