/// On-chain tier economics: the single, auditable source of truth for the prop
/// firm's per-tier parameters (eval fee, funded size, profit target, max
/// drawdown, daily loss limit, profit split, trading fee, and the scaling
/// ladder). Holding this on-chain rather than as hardcoded constants lets the
/// firm retune pricing through an admin-gated, evented edit, and lets traders
/// verify the exact terms their account was opened under. The `Tier` enum lives
/// here because tiers are fundamentally config; the account module imports it.
/// All monetary figures are in USDC base units (6 decimals, so $1 = 1_000_000).


module propfirm::tier_config;

use propfirm::access::{Self, AdminCap, AccessRegistry};

use sui::{
    clock::Clock,
    event,
    vec_map::{Self, VecMap}
};

// === Errors ===

const EUnknownTier: u64 = 1;
const EInvalidParams: u64 = 2;

// === Structs ===

/// Capital tier an account can hold. Drives every economic parameter via the
/// matching `TierRow` in the shared `TierConfig`.
public enum Tier has copy, drop, store {
    Starter,
    Basic,
    Pro,
    Elite,
    Whale,
}

/// The full economic parameter set for one tier. `scales` says whether the tier
/// can be promoted; `next_tier` names the destination (equal to itself for the
/// top or non-scaling tiers).
public struct TierRow has store, copy, drop {
    eval_fee: u64,
    funded_size: u64,
    profit_target_bps: u64,
    max_dd_bps: u64,
    daily_loss_bps: u64,
    user_split_bps: u64,
    trading_fee_bps: u64,
    scales: bool,
    next_tier: Tier,
}

/// The shared config object: one `TierRow` per tier code. Admin-editable so
/// pricing can change at any time.
public struct TierConfig has key {
    id: UID,
    rows: VecMap<u8, TierRow>,
}

// === Events ===

/// Emitted when the config is created and seeded at publish.
public struct TierConfigCreated has copy, drop {
    config_id: ID,
}

/// Emitted when a tier's row is edited, carrying the full new parameter set.
public struct TierRowUpdated has copy, drop {
    config_id: ID,
    tier: Tier,
    eval_fee: u64,
    funded_size: u64,
    profit_target_bps: u64,
    max_dd_bps: u64,
    daily_loss_bps: u64,
    user_split_bps: u64,
    trading_fee_bps: u64,
    scales: bool,
    next_tier: Tier,
    timestamp_ms: u64,
}

// === Init ===

/// Runs once at publish. Seeds the five tiers with their default economics and
/// shares the config. Values are admin-editable afterwards via `set_tier_row`.
fun init(ctx: &mut TxContext) {
    let mut rows = vec_map::empty<u8, TierRow>();

    // Starter: $100 fee, $10k size, 80/20 split, 5% daily, no scaling.
    rows.insert(tier_code(Tier::Starter), TierRow {
        eval_fee: 100_000_000,
        funded_size: 10_000_000_000,
        profit_target_bps: 800,
        max_dd_bps: 1_000,
        daily_loss_bps: 500,
        user_split_bps: 8_000,
        trading_fee_bps: 50,
        scales: false,
        next_tier: Tier::Starter,
    });

    // Basic: $250 fee, $25k size, 83/17 split, 5% daily, scales to Pro.
    rows.insert(tier_code(Tier::Basic), TierRow {
        eval_fee: 250_000_000,
        funded_size: 25_000_000_000,
        profit_target_bps: 800,
        max_dd_bps: 1_000,
        daily_loss_bps: 500,
        user_split_bps: 8_300,
        trading_fee_bps: 50,
        scales: true,
        next_tier: Tier::Pro,
    });

    // Pro: $500 fee, $50k size, 85/15 split, 5% daily, scales to Elite.
    rows.insert(tier_code(Tier::Pro), TierRow {
        eval_fee: 500_000_000,
        funded_size: 50_000_000_000,
        profit_target_bps: 800,
        max_dd_bps: 1_000,
        daily_loss_bps: 500,
        user_split_bps: 8_500,
        trading_fee_bps: 50,
        scales: true,
        next_tier: Tier::Elite,
    });

    // Elite: $1k fee, $100k size, 88/12 split, 4% daily, scales to Whale.
    rows.insert(tier_code(Tier::Elite), TierRow {
        eval_fee: 1_000_000_000,
        funded_size: 100_000_000_000,
        profit_target_bps: 800,
        max_dd_bps: 1_000,
        daily_loss_bps: 400,
        user_split_bps: 8_800,
        trading_fee_bps: 50,
        scales: true,
        next_tier: Tier::Whale,
    });

    // Whale: $2.5k fee, $250k size, 92/8 split, 3% daily, scales (to $500k).
    rows.insert(tier_code(Tier::Whale), TierRow {
        eval_fee: 2_500_000_000,
        funded_size: 250_000_000_000,
        profit_target_bps: 800,
        max_dd_bps: 1_000,
        daily_loss_bps: 300,
        user_split_bps: 9_200,
        trading_fee_bps: 50,
        scales: true,
        next_tier: Tier::Whale,
    });

    let config = TierConfig {
        id: object::new(ctx),
        rows,
    };
    event::emit(TierConfigCreated { config_id: object::id(&config) });
    transfer::share_object(config);
}

// === Internal helpers ===

/// Stable numeric code for a tier, used as the VecMap key.
fun tier_code(tier: Tier): u8 {
    match (tier) {
        Tier::Starter => 0,
        Tier::Basic => 1,
        Tier::Pro => 2,
        Tier::Elite => 3,
        Tier::Whale => 4,
    }
}

// === Admin functions ===

/// Edits a tier's full parameter set. The single lever for retuning pricing,
/// limits, splits, or the scaling ladder.
public fun set_tier_row(
    cap: &AdminCap,
    registry: &AccessRegistry,
    config: &mut TierConfig,
    tier: Tier,
    eval_fee: u64,
    funded_size: u64,
    profit_target_bps: u64,
    max_dd_bps: u64,
    daily_loss_bps: u64,
    user_split_bps: u64,
    trading_fee_bps: u64,
    scales: bool,
    next_tier: Tier,
    clock: &Clock,
) {
    access::assert_admin(registry, cap);
    assert!(profit_target_bps > 0 && profit_target_bps <= 10_000, EInvalidParams);
    assert!(max_dd_bps > 0 && max_dd_bps <= 10_000, EInvalidParams);
    assert!(daily_loss_bps > 0 && daily_loss_bps <= max_dd_bps, EInvalidParams);
    assert!(user_split_bps <= 10_000, EInvalidParams);
    assert!(trading_fee_bps <= 10_000, EInvalidParams);
    assert!(funded_size > 0, EInvalidParams);

    let row = TierRow {
        eval_fee,
        funded_size,
        profit_target_bps,
        max_dd_bps,
        daily_loss_bps,
        user_split_bps,
        trading_fee_bps,
        scales,
        next_tier,
    };
    let code = tier_code(tier);
    if (config.rows.contains(&code)) {
        *config.rows.get_mut(&code) = row;
    } else {
        config.rows.insert(code, row);
    };

    event::emit(TierRowUpdated {
        config_id: object::id(config),
        tier,
        eval_fee,
        funded_size,
        profit_target_bps,
        max_dd_bps,
        daily_loss_bps,
        user_split_bps,
        trading_fee_bps,
        scales,
        next_tier,
        timestamp_ms: clock.timestamp_ms(),
    });
}

// === Getters ===

/// Returns a copy of a tier's full row, aborting if the tier is not configured.
public fun row(config: &TierConfig, tier: Tier): TierRow {
    let code = tier_code(tier);
    assert!(config.rows.contains(&code), EUnknownTier);
    *config.rows.get(&code)
}

/// Returns the eval fee for a tier.
public fun eval_fee(row: &TierRow): u64 { row.eval_fee }
/// Returns the funded size for a tier.
public fun funded_size(row: &TierRow): u64 { row.funded_size }
/// Returns the profit target (bps) for a tier.
public fun profit_target_bps(row: &TierRow): u64 { row.profit_target_bps }
/// Returns the max drawdown limit (bps) for a tier.
public fun max_dd_bps(row: &TierRow): u64 { row.max_dd_bps }
/// Returns the daily loss limit (bps) for a tier.
public fun daily_loss_bps(row: &TierRow): u64 { row.daily_loss_bps }
/// Returns the user profit split (bps) for a tier.
public fun user_split_bps(row: &TierRow): u64 { row.user_split_bps }
/// Returns the per-trade trading fee (bps) for a tier.
public fun trading_fee_bps(row: &TierRow): u64 { row.trading_fee_bps }
/// Returns whether the tier can be scaled up.
public fun scales(row: &TierRow): bool { row.scales }
/// Returns the tier this tier scales into.
public fun next_tier(row: &TierRow): Tier { row.next_tier }

// === Tier constructors ===

/// Returns the Starter tier value.
public fun tier_starter(): Tier { Tier::Starter }
/// Returns the Basic tier value.
public fun tier_basic(): Tier { Tier::Basic }
/// Returns the Pro tier value.
public fun tier_pro(): Tier { Tier::Pro }
/// Returns the Elite tier value.
public fun tier_elite(): Tier { Tier::Elite }
/// Returns the Whale tier value.
public fun tier_whale(): Tier { Tier::Whale }