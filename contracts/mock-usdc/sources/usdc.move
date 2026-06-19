/// Firm-controlled mock USDC for Sui testnet. This is a drop-in stand-in for
/// Circle's `usdc::usdc::USDC` so the prop-firm contracts can be exercised on
/// testnet without a real stablecoin: the same module path (`usdc::usdc`) and
/// type name (`USDC`) let `treasury` and `vault` compile against it unchanged.
///
/// TESTNET ONLY. The `faucet` is deliberately open — anyone may mint themselves
/// test dollars. Never publish this on mainnet; there, revert the `usdc`
/// dependency back to the Circle git package.
module usdc::usdc;

use sui::coin::{Self, TreasuryCap};

// === Constants ===

/// Decimal places, matching real USDC (1 USDC = 1_000_000 base units).
const DECIMALS: u8 = 6;

// === Structs ===

/// One-time witness for the `USDC` currency. Consumed by `init`.
public struct USDC has drop {}

/// Shared holder of the `TreasuryCap`, exposing the open testnet `faucet`. The
/// cap is wrapped (never owned by an address) so minting is only reachable
/// through this object's public entry point.
public struct Faucet has key {
    id: UID,
    treasury_cap: TreasuryCap<USDC>,
}

// === Init ===

/// Runs once at publish. Creates the `USDC` currency, freezes its metadata, and
/// shares a `Faucet` wrapping the `TreasuryCap` so anyone can self-mint on
/// testnet.
fun init(witness: USDC, ctx: &mut TxContext) {
    let (treasury_cap, metadata) = coin::create_currency(
        witness,
        DECIMALS,
        b"USDC",
        b"USD Coin (testnet mock)",
        b"Firm-minted testnet USDC",
        option::none(),
        ctx,
    );
    transfer::public_freeze_object(metadata);
    transfer::share_object(Faucet { id: object::new(ctx), treasury_cap });
}

// === Faucet ===

/// Mints `amount` base units (6 dp) of mock USDC to the caller. Open by design —
/// testnet only.
public entry fun faucet(faucet: &mut Faucet, amount: u64, ctx: &mut TxContext) {
    let coin = coin::mint(&mut faucet.treasury_cap, amount, ctx);
    transfer::public_transfer(coin, ctx.sender());
}
