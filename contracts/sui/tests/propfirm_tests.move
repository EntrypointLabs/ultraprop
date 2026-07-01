#[test_only]
module propfirm::propfirm_tests;

use propfirm::access::{Self, AdminCap, ExecutorCap, AccessRegistry};
use propfirm::tier_config::{Self, TierConfig};
use propfirm::treasury::{Self, Treasury, TreasuryCreatorCap};
use propfirm::user_account::{Self, AccountCap, AccountRegistry};
use std::string;
use sui::clock::{Self, Clock};
use sui::coin::Coin;
use sui::test_scenario::{Self as ts, Scenario};
use usdc::usdc::{Self, USDC, Faucet};

const ADMIN: address = @0xAD;
const TRADER: address = @0x77;

// Starter tier economics, mirrored from tier_config::init for assertion clarity.
// All figures are USDC base units (6 dp).
const STARTER_EVAL_FEE: u64 = 100_000_000; // $100
const STARTER_FUNDED_SIZE: u64 = 10_000_000_000; // $10k
const STARTER_PROFIT_TARGET: u64 = 10_800_000_000; // funded + 8%
const STARTER_MAX_DD_FLOOR: u64 = 9_000_000_000; // funded - 10%
const STARTER_DAILY_LOSS_LIMIT: u64 = 500_000_000; // 5% of funded

const ADDRESS_CHANGE_DELAY_MS: u64 = 86_400_000;

// === Status codes (user_account::status_code) ===
const STATUS_EVALUATING: u8 = 0;
const STATUS_PASSED: u8 = 1;
const STATUS_FAILED: u8 = 2;
const STATUS_SUSPENDED: u8 = 3;

// === Bootstrap ===

/// Runs every module's initializer and the treasury creation so a test starts
/// from the same shared-object world a fresh publish would produce. Leaves the
/// scenario in a fresh tx sent by ADMIN.
fun bootstrap(scenario: &mut Scenario) {
    // Run each package module's `init` and the mock USDC `init`.
    access::init_for_testing(scenario.ctx());
    tier_config::init_for_testing(scenario.ctx());
    treasury::init_for_testing(scenario.ctx());
    user_account::init_for_testing(scenario.ctx());
    usdc::init_for_testing(scenario.ctx());

    // Create the treasury: consumes the one-time TreasuryCreatorCap.
    scenario.next_tx(ADMIN);
    {
        let admin_cap = scenario.take_from_sender<AdminCap>();
        let registry = scenario.take_shared<AccessRegistry>();
        let creator = scenario.take_from_sender<TreasuryCreatorCap>();
        let clock = clock_at(scenario, 0);
        treasury::create_treasury(
            &admin_cap,
            &registry,
            creator,
            ADMIN,
            ADMIN,
            ADDRESS_CHANGE_DELAY_MS,
            &clock,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clock);
        scenario.return_to_sender(admin_cap);
        ts::return_shared(registry);
    };
    scenario.next_tx(ADMIN);
}

fun clock_at(scenario: &mut Scenario, ms: u64): Clock {
    let mut clock = clock::create_for_testing(scenario.ctx());
    clock.set_for_testing(ms);
    clock
}

/// Mints `amount` of mock USDC to the sender via the shared Faucet and returns it
/// to the caller as an owned coin in the next tx.
fun mint_usdc(scenario: &mut Scenario, recipient: address, amount: u64): Coin<USDC> {
    scenario.next_tx(recipient);
    let mut faucet = scenario.take_shared<Faucet>();
    usdc::faucet(&mut faucet, amount, scenario.ctx());
    ts::return_shared(faucet);
    scenario.next_tx(recipient);
    scenario.take_from_sender<Coin<USDC>>()
}

/// Opens a Starter account for TRADER by paying the exact eval fee. Returns
/// nothing; the AccountCap lands in TRADER's wallet.
fun open_starter_account(scenario: &mut Scenario) {
    let payment = mint_usdc(scenario, ADMIN, STARTER_EVAL_FEE);
    scenario.next_tx(ADMIN);
    {
        let admin_cap = scenario.take_from_sender<AdminCap>();
        let registry = scenario.take_shared<AccessRegistry>();
        let mut treasury = scenario.take_shared<Treasury>();
        let mut accounts = scenario.take_shared<AccountRegistry>();
        let config = scenario.take_shared<TierConfig>();
        let clock = clock_at(scenario, 0);
        treasury::open_account(
            &admin_cap,
            &registry,
            &mut treasury,
            &mut accounts,
            &config,
            tier_config::tier_starter(),
            payment,
            TRADER,
            &clock,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clock);
        scenario.return_to_sender(admin_cap);
        ts::return_shared(registry);
        ts::return_shared(treasury);
        ts::return_shared(accounts);
        ts::return_shared(config);
    };
    scenario.next_tx(ADMIN);
}

/// Returns the ID of the single AccountCap held by TRADER.
fun trader_account_id(scenario: &mut Scenario): ID {
    scenario.next_tx(TRADER);
    let cap = scenario.take_from_sender<AccountCap>();
    let id = user_account::cap_account_id(&cap);
    scenario.return_to_sender(cap);
    id
}

/// Executor logs one trade against `account_id`.
fun exec_log_trade(
    scenario: &mut Scenario,
    account_id: ID,
    is_win: bool,
    pnl: u64,
    ms: u64,
) {
    scenario.next_tx(ADMIN);
    let exec_cap = scenario.take_from_sender<ExecutorCap>();
    let registry = scenario.take_shared<AccessRegistry>();
    let mut accounts = scenario.take_shared<AccountRegistry>();
    let clock = clock_at(scenario, ms);
    user_account::log_trade(
        &exec_cap,
        &registry,
        &mut accounts,
        account_id,
        is_win,
        pnl,
        string::utf8(b"hyperliquid"),
        string::utf8(b"BTC-PERP"),
        &clock,
        scenario.ctx(),
    );
    clock::destroy_for_testing(clock);
    scenario.return_to_sender(exec_cap);
    ts::return_shared(registry);
    ts::return_shared(accounts);
    scenario.next_tx(ADMIN);
}

/// Executor logs one trade via the detailed path against `account_id`. The
/// extra detail args ride only in the `TradeSettled` event; state effects must
/// match `exec_log_trade` exactly.
fun exec_log_trade_detailed(
    scenario: &mut Scenario,
    account_id: ID,
    is_win: bool,
    pnl: u64,
    ms: u64,
) {
    scenario.next_tx(ADMIN);
    let exec_cap = scenario.take_from_sender<ExecutorCap>();
    let registry = scenario.take_shared<AccessRegistry>();
    let mut accounts = scenario.take_shared<AccountRegistry>();
    let clock = clock_at(scenario, ms);
    user_account::log_trade_detailed(
        &exec_cap,
        &registry,
        &mut accounts,
        account_id,
        is_win,
        pnl,
        string::utf8(b"hyperliquid"),
        string::utf8(b"BTC-PERP"),
        0, // side: long
        1_000_000_000, // size_usd: $1,000
        2, // leverage
        50_000_000_000, // entry_price: $50,000
        50_200_000_000, // exit_price: $50,200
        500_000, // entry_fee: $0.50
        0, // funding_paid
        false, // funding_is_credit
        0, // close_reason: manual
        &clock,
        scenario.ctx(),
    );
    clock::destroy_for_testing(clock);
    scenario.return_to_sender(exec_cap);
    ts::return_shared(registry);
    ts::return_shared(accounts);
    scenario.next_tx(ADMIN);
}

// === open_account ===

#[test]
fun open_account_happy_path() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        let treasury = scenario.take_shared<Treasury>();

        assert!(user_account::account_exists(&accounts, account_id), 0);
        assert!(user_account::total_accounts(&accounts) == 1, 1);
        assert!(user_account::status_code(&accounts, account_id) == STATUS_EVALUATING, 2);
        assert!(user_account::funded_size(&accounts, account_id) == STARTER_FUNDED_SIZE, 3);
        assert!(user_account::profit_target(&accounts, account_id) == STARTER_PROFIT_TARGET, 4);
        assert!(user_account::max_dd_floor(&accounts, account_id) == STARTER_MAX_DD_FLOOR, 5);
        assert!(user_account::daily_loss_limit(&accounts, account_id) == STARTER_DAILY_LOSS_LIMIT, 6);
        assert!(user_account::equity(&accounts, account_id) == STARTER_FUNDED_SIZE, 7);
        assert!(user_account::reputation(&accounts, account_id) == 1_000, 8);

        // The fee landed in the eval pool.
        assert!(treasury::eval_funds_balance(&treasury) == STARTER_EVAL_FEE, 9);
        assert!(treasury::total_eval_fees_collected(&treasury) == STARTER_EVAL_FEE, 10);

        ts::return_shared(accounts);
        ts::return_shared(treasury);
    };

    // The trader holds exactly one AccountCap.
    scenario.next_tx(TRADER);
    {
        let cap = scenario.take_from_sender<AccountCap>();
        assert!(user_account::cap_account_id(&cap) == account_id, 11);
        scenario.return_to_sender(cap);
    };

    scenario.end();
}

#[test]
// treasury::EWrongEvalFee = 17 (private const; matched by literal + location).
#[expected_failure(abort_code = 17, location = propfirm::treasury)]
fun open_account_wrong_fee_aborts() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);

    // Underpay by $1.
    let payment = mint_usdc(&mut scenario, ADMIN, STARTER_EVAL_FEE - 1_000_000);
    scenario.next_tx(ADMIN);
    let admin_cap = scenario.take_from_sender<AdminCap>();
    let registry = scenario.take_shared<AccessRegistry>();
    let mut treasury = scenario.take_shared<Treasury>();
    let mut accounts = scenario.take_shared<AccountRegistry>();
    let config = scenario.take_shared<TierConfig>();
    let clock = clock_at(&mut scenario, 0);
    treasury::open_account(
        &admin_cap,
        &registry,
        &mut treasury,
        &mut accounts,
        &config,
        tier_config::tier_starter(),
        payment,
        TRADER,
        &clock,
        scenario.ctx(),
    );
    // Unreachable: open_account aborts above. Cleanup kept for the type checker.
    clock::destroy_for_testing(clock);
    scenario.return_to_sender(admin_cap);
    ts::return_shared(registry);
    ts::return_shared(treasury);
    ts::return_shared(accounts);
    ts::return_shared(config);
    scenario.end();
}

// === log_trade ===

#[test]
fun log_trade_win_raises_equity() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    exec_log_trade(&mut scenario, account_id, true, 200_000_000, 0); // +$200

    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        assert!(user_account::equity(&accounts, account_id) == STARTER_FUNDED_SIZE + 200_000_000, 0);
        assert!(user_account::status_code(&accounts, account_id) == STATUS_EVALUATING, 1);
        let (total, wins, losses) = user_account::trade_counts(&accounts, account_id);
        assert!(total == 1 && wins == 1 && losses == 0, 2);
        assert!(user_account::reputation(&accounts, account_id) == 1_005, 3); // +REP_WIN
        ts::return_shared(accounts);
    };
    scenario.end();
}

#[test]
fun log_trade_loss_lowers_equity() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    // A modest loss that stays above both the daily and max-dd floors.
    exec_log_trade(&mut scenario, account_id, false, 200_000_000, 0); // -$200

    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        assert!(user_account::equity(&accounts, account_id) == STARTER_FUNDED_SIZE - 200_000_000, 0);
        assert!(user_account::status_code(&accounts, account_id) == STATUS_EVALUATING, 1);
        let (total, wins, losses) = user_account::trade_counts(&accounts, account_id);
        assert!(total == 1 && wins == 0 && losses == 1, 2);
        assert!(user_account::breach_count(&accounts, account_id) == 0, 3);
        ts::return_shared(accounts);
    };
    scenario.end();
}

#[test]
fun log_trade_daily_loss_suspends() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    // Loss equal to the $500 daily-loss limit trips the daily gate (>= limit),
    // while staying above the $9k max-dd floor (equity = $9,500).
    exec_log_trade(&mut scenario, account_id, false, STARTER_DAILY_LOSS_LIMIT, 0);

    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        assert!(
            user_account::equity(&accounts, account_id) == STARTER_FUNDED_SIZE - STARTER_DAILY_LOSS_LIMIT,
            0,
        );
        assert!(user_account::status_code(&accounts, account_id) == STATUS_SUSPENDED, 1);
        assert!(user_account::breach_count(&accounts, account_id) == 1, 2);
        // Above the max-dd floor, so this is a daily-loss breach, not max-dd.
        assert!(user_account::equity(&accounts, account_id) > STARTER_MAX_DD_FLOOR, 3);
        ts::return_shared(accounts);
    };
    scenario.end();
}

#[test]
fun log_trade_max_drawdown_suspends() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    // A $1,001 loss drops equity to $8,999, at or below the $9k max-dd floor.
    // (It also exceeds the daily limit, but max-dd is the binding breach here.)
    exec_log_trade(&mut scenario, account_id, false, 1_001_000_000, 0);

    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        assert!(user_account::equity(&accounts, account_id) <= STARTER_MAX_DD_FLOOR, 0);
        assert!(user_account::status_code(&accounts, account_id) == STATUS_SUSPENDED, 1);
        assert!(user_account::breach_count(&accounts, account_id) == 1, 2);
        ts::return_shared(accounts);
    };
    scenario.end();
}

#[test]
// user_account::EAccountNotActive = 2.
#[expected_failure(abort_code = 2, location = propfirm::user_account)]
fun log_trade_on_suspended_aborts() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    // Suspend via a max-dd breach, then try to log another trade.
    exec_log_trade(&mut scenario, account_id, false, 1_001_000_000, 0);
    exec_log_trade(&mut scenario, account_id, true, 1_000_000, 0);

    scenario.end();
}

// === log_trade_detailed ===

#[test]
fun log_trade_detailed_applies_same_state_as_log_trade() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    // A +$200 win must move equity, counts and reputation exactly as log_trade.
    exec_log_trade_detailed(&mut scenario, account_id, true, 200_000_000, 0);

    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        assert!(user_account::equity(&accounts, account_id) == STARTER_FUNDED_SIZE + 200_000_000, 0);
        assert!(user_account::status_code(&accounts, account_id) == STATUS_EVALUATING, 1);
        let (total, wins, losses) = user_account::trade_counts(&accounts, account_id);
        assert!(total == 1 && wins == 1 && losses == 0, 2);
        assert!(user_account::reputation(&accounts, account_id) == 1_005, 3); // +REP_WIN
        ts::return_shared(accounts);
    };
    scenario.end();
}

#[test]
fun log_trade_detailed_max_drawdown_suspends() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    // The detailed path must enforce the same max-dd breach and suspension.
    exec_log_trade_detailed(&mut scenario, account_id, false, 1_001_000_000, 0);

    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        assert!(user_account::equity(&accounts, account_id) <= STARTER_MAX_DD_FLOOR, 0);
        assert!(user_account::status_code(&accounts, account_id) == STATUS_SUSPENDED, 1);
        assert!(user_account::breach_count(&accounts, account_id) == 1, 2);
        ts::return_shared(accounts);
    };
    scenario.end();
}

// === pass_evaluation ===

#[test]
fun pass_evaluation_succeeds_at_target() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    // Reach the $10,800 profit target with an $800 win.
    exec_log_trade(&mut scenario, account_id, true, 800_000_000, 0);

    scenario.next_tx(ADMIN);
    {
        let exec_cap = scenario.take_from_sender<ExecutorCap>();
        let registry = scenario.take_shared<AccessRegistry>();
        let mut accounts = scenario.take_shared<AccountRegistry>();
        let clock = clock_at(&mut scenario, 0);
        user_account::pass_evaluation(&exec_cap, &registry, &mut accounts, account_id, &clock, scenario.ctx());
        clock::destroy_for_testing(clock);
        scenario.return_to_sender(exec_cap);
        ts::return_shared(registry);
        ts::return_shared(accounts);
    };

    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        assert!(user_account::status_code(&accounts, account_id) == STATUS_PASSED, 0);
        assert!(user_account::is_passed(&accounts, account_id), 1);
        assert!(user_account::reputation(&accounts, account_id) == 1_005 + 100, 2); // win + pass bonus
        ts::return_shared(accounts);
    };
    scenario.end();
}

#[test]
// user_account::EProfitTargetNotMet = 6.
#[expected_failure(abort_code = 6, location = propfirm::user_account)]
fun pass_evaluation_below_target_aborts() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    // $100 short of the target.
    exec_log_trade(&mut scenario, account_id, true, 700_000_000, 0);

    scenario.next_tx(ADMIN);
    let exec_cap = scenario.take_from_sender<ExecutorCap>();
    let registry = scenario.take_shared<AccessRegistry>();
    let mut accounts = scenario.take_shared<AccountRegistry>();
    let clock = clock_at(&mut scenario, 0);
    user_account::pass_evaluation(&exec_cap, &registry, &mut accounts, account_id, &clock, scenario.ctx());
    clock::destroy_for_testing(clock);
    scenario.return_to_sender(exec_cap);
    ts::return_shared(registry);
    ts::return_shared(accounts);
    scenario.end();
}

// === fail_evaluation ===

#[test]
fun fail_evaluation_moves_to_failed() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    scenario.next_tx(ADMIN);
    {
        let exec_cap = scenario.take_from_sender<ExecutorCap>();
        let registry = scenario.take_shared<AccessRegistry>();
        let mut accounts = scenario.take_shared<AccountRegistry>();
        let clock = clock_at(&mut scenario, 0);
        user_account::fail_evaluation(&exec_cap, &registry, &mut accounts, account_id, &clock, scenario.ctx());
        clock::destroy_for_testing(clock);
        scenario.return_to_sender(exec_cap);
        ts::return_shared(registry);
        ts::return_shared(accounts);
    };

    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        assert!(user_account::status_code(&accounts, account_id) == STATUS_FAILED, 0);
        ts::return_shared(accounts);
    };
    scenario.end();
}

// === reactivate ===

#[test]
fun reactivate_resets_failed_account() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    // Drop reputation with a loss (1000 -> 995), then fail the account.
    exec_log_trade(&mut scenario, account_id, false, 200_000_000, 0);

    scenario.next_tx(ADMIN);
    {
        let exec_cap = scenario.take_from_sender<ExecutorCap>();
        let registry = scenario.take_shared<AccessRegistry>();
        let mut accounts = scenario.take_shared<AccountRegistry>();
        let clock = clock_at(&mut scenario, 0);
        user_account::fail_evaluation(&exec_cap, &registry, &mut accounts, account_id, &clock, scenario.ctx());
        clock::destroy_for_testing(clock);
        scenario.return_to_sender(exec_cap);
        ts::return_shared(registry);
        ts::return_shared(accounts);
    };

    // Capture reputation while Failed, then reactivate.
    let rep_before;
    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        assert!(user_account::status_code(&accounts, account_id) == STATUS_FAILED, 0);
        rep_before = user_account::reputation(&accounts, account_id);
        ts::return_shared(accounts);
    };

    scenario.next_tx(ADMIN);
    {
        let admin_cap = scenario.take_from_sender<AdminCap>();
        let registry = scenario.take_shared<AccessRegistry>();
        let mut accounts = scenario.take_shared<AccountRegistry>();
        let clock = clock_at(&mut scenario, 0);
        user_account::reactivate(&admin_cap, &registry, &mut accounts, account_id, &clock, scenario.ctx());
        clock::destroy_for_testing(clock);
        scenario.return_to_sender(admin_cap);
        ts::return_shared(registry);
        ts::return_shared(accounts);
    };

    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        // Same tier, reset to Evaluating, equity back to funded size, reputation kept.
        assert!(user_account::status_code(&accounts, account_id) == STATUS_EVALUATING, 1);
        assert!(user_account::equity(&accounts, account_id) == STARTER_FUNDED_SIZE, 2);
        assert!(user_account::funded_size(&accounts, account_id) == STARTER_FUNDED_SIZE, 3);
        assert!(user_account::reputation(&accounts, account_id) == rep_before, 4);
        let (total, _wins, _losses) = user_account::trade_counts(&accounts, account_id);
        assert!(total == 1, 5); // lifetime trade history preserved
        ts::return_shared(accounts);
    };
    scenario.end();
}

#[test]
fun reactivate_resets_suspended_account() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    // Suspend via a max-dd breach.
    exec_log_trade(&mut scenario, account_id, false, 1_001_000_000, 0);

    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        assert!(user_account::status_code(&accounts, account_id) == STATUS_SUSPENDED, 0);
        ts::return_shared(accounts);
    };

    scenario.next_tx(ADMIN);
    {
        let admin_cap = scenario.take_from_sender<AdminCap>();
        let registry = scenario.take_shared<AccessRegistry>();
        let mut accounts = scenario.take_shared<AccountRegistry>();
        let clock = clock_at(&mut scenario, 0);
        user_account::reactivate(&admin_cap, &registry, &mut accounts, account_id, &clock, scenario.ctx());
        clock::destroy_for_testing(clock);
        scenario.return_to_sender(admin_cap);
        ts::return_shared(registry);
        ts::return_shared(accounts);
    };

    scenario.next_tx(ADMIN);
    {
        let accounts = scenario.take_shared<AccountRegistry>();
        assert!(user_account::status_code(&accounts, account_id) == STATUS_EVALUATING, 1);
        assert!(user_account::equity(&accounts, account_id) == STARTER_FUNDED_SIZE, 2);
        ts::return_shared(accounts);
    };
    scenario.end();
}

#[test]
// user_account::ENotBreached = 5.
#[expected_failure(abort_code = 5, location = propfirm::user_account)]
fun reactivate_evaluating_account_aborts() {
    let mut scenario = ts::begin(ADMIN);
    bootstrap(&mut scenario);
    open_starter_account(&mut scenario);
    let account_id = trader_account_id(&mut scenario);

    // Account is still Evaluating; reactivate must abort.
    scenario.next_tx(ADMIN);
    let admin_cap = scenario.take_from_sender<AdminCap>();
    let registry = scenario.take_shared<AccessRegistry>();
    let mut accounts = scenario.take_shared<AccountRegistry>();
    let clock = clock_at(&mut scenario, 0);
    user_account::reactivate(&admin_cap, &registry, &mut accounts, account_id, &clock, scenario.ctx());
    clock::destroy_for_testing(clock);
    scenario.return_to_sender(admin_cap);
    ts::return_shared(registry);
    ts::return_shared(accounts);
    scenario.end();
}
