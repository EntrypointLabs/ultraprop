
module propfirm::access;

use sui::{
    clock::Clock,
    event,
    table::{Self, Table}
};

// === Errors ===

const EExecutorRevoked: u64 = 1;
const EAdminRevoked: u64 = 2;

// === Capabilities ===

/// Held by the platform operator. Authorizes account onboarding, tier changes,
/// vault and registry creation, and emergency reactivation.
public struct AdminCap has key, store {
    id: UID,
}

/// Held by the off-chain execution and risk engine. Authorizes trade logging,
/// reputation updates, payout accrual, and breach enforcement. To be treated as hot and rotated often
public struct ExecutorCap has key, store {
    id: UID,
}

// === Registry ===
/// Shared singleton holding the set of revoked `ExecutorCap` IDs. Every
/// executor-gated function reads this via `assert_executor` and aborts if its
/// cap's ID is present, so the admin can disable a rogue or compromised
/// executor by ID without the holder surrendering the cap. Created once in
/// `init`; there is intentionally NO public constructor, so a second/empty
/// registry can never be substituted to bypass the check — do not add one.
/// Also holds the set of revoked `AdminCap` IDs: the deployer's AdminCap is
/// implicitly trusted, but any cap whose ID is listed here is rejected by
/// `assert_admin`, so a compromised or rogue admin can be disabled by ID
/// without surrendering the cap (the same model as executors).
public struct AccessRegistry has key {
    id: UID,
    revoked: Table<ID, bool>,
    revoked_admins: Table<ID, bool>,
}

// === Events ===

/// Emitted once at publish when the access registry is created.
public struct AccessRegistryCreated has copy, drop {
    registry_id: ID,
}

/// Emitted whenever an `ExecutorCap` is minted, so its ID is discoverable
/// off-chain for later revocation by ID.
public struct ExecutorCapMinted has copy, drop {
    cap_id: ID,
    recipient: address,
}

/// Emitted whenever an `AdminCap` is minted, for auditability.
public struct AdminCapMinted has copy, drop {
    cap_id: ID,
    recipient: address,
}

/// Emitted when an `ExecutorCap` ID is added to the blacklist.
public struct ExecutorCapRevoked has copy, drop {
    registry_id: ID,
    cap_id: ID,
    revoked_by: address,
    timestamp_ms: u64,
}

/// Emitted when an `ExecutorCap` ID is removed from the blacklist.
public struct ExecutorCapRestored has copy, drop {
    registry_id: ID,
    cap_id: ID,
    restored_by: address,
    timestamp_ms: u64,
}

/// Emitted when an `AdminCap` ID is added to the admin blacklist.
public struct AdminCapRevoked has copy, drop {
    registry_id: ID,
    cap_id: ID,
    revoked_by: address,
    timestamp_ms: u64,
}

/// Emitted when an `AdminCap` ID is removed from the admin blacklist.
public struct AdminCapRestored has copy, drop {
    registry_id: ID,
    cap_id: ID,
    restored_by: address,
    timestamp_ms: u64,
}

// === Init ===

/// Runs once at publish. Mints one AdminCap and one ExecutorCap to the deployer
/// and creates the shared access registry that gates executor authority.
fun init(ctx: &mut TxContext) {
    let admin = ctx.sender();

    let admin_cap = AdminCap { id: object::new(ctx) };
    event::emit(AdminCapMinted { cap_id: object::id(&admin_cap), recipient: admin });
    transfer::transfer(admin_cap, admin);

    let executor_cap = ExecutorCap { id: object::new(ctx) };
    event::emit(ExecutorCapMinted { cap_id: object::id(&executor_cap), recipient: admin });
    transfer::transfer(executor_cap, admin);

    let registry = AccessRegistry {
        id: object::new(ctx),
        revoked: table::new(ctx),
        revoked_admins: table::new(ctx),
    };
    event::emit(AccessRegistryCreated { registry_id: object::id(&registry) });
    transfer::share_object(registry);
}

// === Cap management ===

/// Mints an additional AdminCap and transfers it immediately to the recipient.
/// Only an existing, non-revoked admin can authorize creation of a new admin
/// capability.
public fun new_admin_cap(
    cap: &AdminCap,
    registry: &AccessRegistry,
    recipient: address,
    ctx: &mut TxContext,
) {
    assert_admin(registry, cap);
    let new_cap = AdminCap { id: object::new(ctx) };
    event::emit(AdminCapMinted { cap_id: object::id(&new_cap), recipient });
    transfer::transfer(new_cap, recipient);
}

/// Mints an additional ExecutorCap and transfers it immediately to the
/// recipient. Used to rotate the engine's key: mint a new cap for the new key,
/// then burn (or revoke) the old one.
public fun new_executor_cap(
    cap: &AdminCap,
    registry: &AccessRegistry,
    recipient: address,
    ctx: &mut TxContext,
) {
    assert_admin(registry, cap);
    let new_cap = ExecutorCap { id: object::new(ctx) };
    event::emit(ExecutorCapMinted { cap_id: object::id(&new_cap), recipient });
    transfer::transfer(new_cap, recipient);
}

/// Permanently destroys an ExecutorCap you hold, revoking that engine instance's
/// authority and reclaiming its storage. Requires possessing the cap, so it only
/// covers cooperative rotation; for a cap the admin cannot reach (a rogue or
/// compromised holder), use `revoke_executor_cap` instead.
public fun burn_executor_cap(cap: ExecutorCap) {
    let ExecutorCap { id } = cap;
    id.delete();
}

// === Executor revocation ===

/// Revokes an ExecutorCap by its object ID — no need for the (possibly rogue)
/// holder to sign or surrender the cap. Every executor-gated function checks
/// this set via `assert_executor`. Idempotent: re-revoking an ID is a no-op.
public fun revoke_executor_cap(
    cap: &AdminCap,
    registry: &mut AccessRegistry,
    cap_id: ID,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert_admin(registry, cap);
    if (!registry.revoked.contains(cap_id)) {
        registry.revoked.add(cap_id, true);
    };
    event::emit(ExecutorCapRevoked {
        registry_id: object::id(registry),
        cap_id,
        revoked_by: ctx.sender(),
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Removes an ExecutorCap ID from the blacklist, re-enabling it (e.g. to undo a
/// mistaken revocation). Idempotent: restoring a non-revoked ID is a no-op.
public fun restore_executor_cap(
    cap: &AdminCap,
    registry: &mut AccessRegistry,
    cap_id: ID,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert_admin(registry, cap);
    if (registry.revoked.contains(cap_id)) {
        registry.revoked.remove(cap_id);
    };
    event::emit(ExecutorCapRestored {
        registry_id: object::id(registry),
        cap_id,
        restored_by: ctx.sender(),
        timestamp_ms: clock.timestamp_ms(),
    });
}

// === Admin revocation ===

/// Revokes an `AdminCap` by its object ID. Every admin-gated function across the
/// package checks this set via `assert_admin`, so a compromised admin can be
/// disabled by ID without the holder surrendering the cap. The caller must be a
/// non-revoked admin. Idempotent: re-revoking an ID is a no-op. Note an admin
/// can revoke any admin (including itself); guard the last live cap off-chain.
public fun revoke_admin_cap(
    cap: &AdminCap,
    registry: &mut AccessRegistry,
    cap_id: ID,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert_admin(registry, cap);
    if (!registry.revoked_admins.contains(cap_id)) {
        registry.revoked_admins.add(cap_id, true);
    };
    event::emit(AdminCapRevoked {
        registry_id: object::id(registry),
        cap_id,
        revoked_by: ctx.sender(),
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Removes an `AdminCap` ID from the admin blacklist, re-enabling it. The caller
/// must be a non-revoked admin. Idempotent: restoring a non-revoked ID is a no-op.
public fun restore_admin_cap(
    cap: &AdminCap,
    registry: &mut AccessRegistry,
    cap_id: ID,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert_admin(registry, cap);
    if (registry.revoked_admins.contains(cap_id)) {
        registry.revoked_admins.remove(cap_id);
    };
    event::emit(AdminCapRestored {
        registry_id: object::id(registry),
        cap_id,
        restored_by: ctx.sender(),
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Aborts `EExecutorRevoked` if `cap`'s ID is on the blacklist. The single gate
/// every executor-gated function calls as its first line. Read-only, so it adds
/// no write contention on the shared registry.
public fun assert_executor(registry: &AccessRegistry, cap: &ExecutorCap) {
    assert!(!registry.revoked.contains(object::id(cap)), EExecutorRevoked);
}

/// Returns whether the given ExecutorCap ID is currently revoked.
public fun is_executor_revoked(registry: &AccessRegistry, cap_id: ID): bool {
    registry.revoked.contains(cap_id)
}

/// Aborts `EAdminRevoked` if `cap`'s ID is on the admin blacklist. The single
/// gate every admin-gated function across the package calls as its first line.
public fun assert_admin(registry: &AccessRegistry, cap: &AdminCap) {
    assert!(!registry.revoked_admins.contains(object::id(cap)), EAdminRevoked);
}

/// Returns whether the given AdminCap ID is currently revoked.
public fun is_admin_revoked(registry: &AccessRegistry, cap_id: ID): bool {
    registry.revoked_admins.contains(cap_id)
}
