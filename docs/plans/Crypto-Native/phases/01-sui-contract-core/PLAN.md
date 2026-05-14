---
phase: 01-sui-contract-core
type: execute
depends_on: ["00-foundation"]
files_modified:
  - contracts/sui/Move.toml
  - contracts/sui/sources/oracle_adapter.move
  - contracts/sui/sources/tier_config.move
  - contracts/sui/sources/registry.move
  - contracts/sui/sources/slippage_model.move
  - contracts/sui/sources/evaluation_vault.move
  - contracts/sui/sources/cohort_sbt.move
  - contracts/sui/sources/events.move
  - contracts/sui/tests/
  - .github/workflows/contracts-sui.yml
autonomous: true
requirements: [REQ-02, REQ-06, REQ-07, REQ-12]
must_haves:
  truths:
    - "evaluation_vault is a Sui owned-object held by the trader's address."
    - "Admin holds only AdminCap with pause + allowlist capability; there is NO vault-mutating admin function."
    - "SlippageConfig is on-chain and versioned; every vault captures the version at evaluation start."
    - "All 12 canonical events match the event schema from Phase 0 (CI parity gate green)."
    - "Daily-loss reset occurs at 00:00 UTC for all vaults."
    - "Trade-intent rate limit: min_interval = 2s on Sui, MAX_INTENTS = 200."
    - "Vault auto-terminates with reason Inactive after 7 days of zero activity."
    - "Property-based tests confirm Move slippage_model output matches Rust reference impl within 1 unit of last place."
    - "Upgrade-compat CI gate is live and blocks incompatible upgrades."
  artifacts:
    - "contracts/sui/sources/*.move (7 modules)"
    - "contracts/sui/tests/*.move (unit + property tests)"
    - ".github/workflows/contracts-sui.yml (build + test + fuzz + upgrade-compat)"
  key_links:
    - from: "contracts/sui/sources/evaluation_vault.move"
      to: "contracts/sui/sources/slippage_model.move"
      type: "function_call"
    - from: "contracts/sui/sources/evaluation_vault.move"
      to: "contracts/sui/sources/oracle_adapter.move"
      type: "function_call"
    - from: "contracts/sui/sources/cohort_sbt.move"
      to: "contracts/sui/sources/evaluation_vault.move"
      type: "friend"
---

<objective>
Build the Sui Move evaluation engine: oracle integration, tier configuration, registry/allowlist, on-chain versioned slippage model, per-trader vault with full rule enforcement, and the v1 cohort SBT. The admin module is intentionally restricted to pause + allowlist with no vault-mutating capability — this is the structural enforcement of the "zero override" success criterion (REQ-02 + REQ-06). The slippage model is on-chain and versioned (REQ-07) so mid-beta recalibration can never invalidate in-flight evaluations. Property tests vs the Rust reference impl establish numerical determinism. Fuzz harness and upgrade-compat CI gate land here.
</objective>

<context>
@.claude/plans/Crypto-Native/PROJECT.md
@.claude/plans/Crypto-Native/STATE.md
@.claude/plans/Crypto-Native/ROADMAP.md
@.claude/plans/Crypto-Native/research/ARCHITECTURE.md
@.claude/plans/Crypto-Native/research/PITFALLS.md
@packages/shared/events/src/schema.ts
@packages/shared/slippage/src/lib.rs
</context>

<tasks>

<task type="auto" id="1.1" depends_on="">
  <name>Move package scaffold + oracle_adapter (Pyth on Sui + Switchboard divergence)</name>
  <files>
    contracts/sui/Move.toml
    contracts/sui/sources/oracle_adapter.move
    contracts/sui/sources/events.move
    contracts/sui/tests/oracle_adapter_tests.move
  </files>
  <context>
    Why: REQ-01 + REQ-12 — staleness > 10s on Sui must revert. Switchboard On-Demand provides halt-on-divergence (>50 bps); this prevents single-oracle failure (PITFALLS 1.3).
    Pattern: Pyth Sui receiver — post VAA then read PriceInfoObject in same tx; Switchboard On-Demand pull. Both behind a single `oracle_adapter::get_price()` interface.
  </context>
  <action>
    1. Initialize `Move.toml` with `edition = "2024.beta"`, Sui framework pinned to `framework/mainnet`, Pyth + Switchboard deps.
    2. Implement `oracle_adapter::get_price(symbol, max_age_seconds)`: reads Pyth `PriceInfoObject`, asserts `price.publish_time + max_age_seconds >= clock.timestamp_ms() / 1000`, reverts `EStaleOracle` if exceeded.
    3. Add `oracle_adapter::assert_within_divergence(pyth, switchboard, max_bps)` for Phase 1.4's use.
    4. Define `events.move` with all 12 events from Phase 0 schema. Field names lint-checked against `packages/shared/events/codegen-move-lint`.
    **Avoid:** Chainlink (poor Sui coverage); inline oracle reads (everything goes through `oracle_adapter` for replaceability).
  </action>
  <verify>cd contracts/sui && sui move build && sui move test -- oracle_adapter_tests</verify>
  <done>
    - [ ] Move package builds clean
    - [ ] `get_price` reverts `EStaleOracle` when age > 10s
    - [ ] `assert_within_divergence` reverts when |delta| > max_bps
    - [ ] events.move field names match Phase 0 schema lint
  </done>
  <rollback>git checkout -- contracts/sui/</rollback>
</task>

<task type="auto" id="1.2" depends_on="1.1">
  <name>tier_config + registry + AdminCap (capability split, no override path)</name>
  <files>
    contracts/sui/sources/tier_config.move
    contracts/sui/sources/registry.move
    contracts/sui/tests/registry_tests.move
  </files>
  <context>
    Why: REQ-06 — admin holds only pause + allowlist capability; vault-mutating admin functions MUST NOT EXIST. This is structural enforcement of the "zero override" success criterion (PITFALLS 4.1).
    Pattern: ARCHITECTURE.md §1 — split AdminCap into `PauseCap` + `AllowlistCap`. No `GodCap`.
  </context>
  <action>
    1. `tier_config.move`: constants for Starter ($10K, 8%/10%), Basic ($25K, 8%/8%), Pro ($50K, 10%/8%). Expose `get_tier_params(tier_id) -> TierParams`. No mutability.
    2. `registry.move`: a shared object with `allowlist: Table<address, bool>`, `paused: bool`, `MultisigCap` (issued at deploy, held by Sui MultiSig).
    3. Entry functions: `add_to_allowlist(cap: &AllowlistCap, addr)`, `remove_from_allowlist(...)`, `pause(cap: &PauseCap)`, `unpause(...)`. NO `update_vault`, NO `force_pass`, NO `adjust_pnl`.
    4. `open_evaluation(registry, tier_id, ctx)` checks `ctx.sender() ∈ allowlist && !paused` then creates `EvaluationVault` owned-object (handled in task 1.4).
    **Avoid:** any function whose code path can mutate a vault's `pnl`, `equity`, `peak_equity`, or `terminated_reason` fields. CI audit in Phase 6 will assert this structurally.
  </action>
  <verify>sui move test -- registry_tests; grep -rE "fun .*(force_|admin_mutate|override)" contracts/sui/sources/ returns no matches</verify>
  <done>
    - [ ] `tier_config` returns correct params for all 3 tiers
    - [ ] Pause flag blocks `open_evaluation`
    - [ ] Allowlist add/remove gated by `AllowlistCap`
    - [ ] No vault-mutating admin function exists (grep audit)
  </done>
  <rollback>git checkout -- contracts/sui/sources/tier_config.move contracts/sui/sources/registry.move</rollback>
</task>

<task type="auto" id="1.3" depends_on="1.1">
  <name>slippage_model + on-chain versioned SlippageConfig</name>
  <files>
    contracts/sui/sources/slippage_model.move
    contracts/sui/tests/slippage_model_tests.move
    packages/shared/slippage/src/lib.rs
    packages/shared/slippage/tests/move_parity.rs
  </files>
  <context>
    Why: REQ-07 — slippage config is on-chain and versioned; vault captures version at evaluation start; mid-beta recalibration cannot retroactively change in-flight outcomes (PITFALLS 3.6). REQ-01 — fills modeled deterministically with +2 bps tilt (Clarify R2).
    Pattern: pure Move module — no state, no oracle reads. Inputs: `(oracle_price, side, size, config)`. Output: `fill_price`. Identical Rust impl in `packages/shared/slippage` used by backend calibrator.
  </context>
  <action>
    1. `slippage_model.move`: define `SlippageConfig { version: u32, base_spread_bps: u32, depth_factor: u64, house_tilt_bps: u32 }` as a shared object (constants Phase 0 sets initial values).
    2. `compute_fill(config: &SlippageConfig, oracle_price: u128, side: u8, size: u64) -> u128`: returns fill price with side-aware spread + size-aware depth penalty + +2 bps house tilt against trader.
    3. Implement identical algorithm in `packages/shared/slippage/src/lib.rs` (Rust reference impl).
    4. Property tests in `move_parity.rs`: generate random `(oracle, side, size, config)` 10k times, assert Move output == Rust output within 1 ULP (last-bit precision).
    **Avoid:** floating point anywhere (use u128 fixed-point); reading oracle inside `slippage_model` (purity is required for testability).
  </action>
  <verify>sui move test -- slippage_model_tests && cargo test -p shared-slippage --test move_parity</verify>
  <done>
    - [ ] Move `compute_fill` is pure (no state, no aborts other than overflow)
    - [ ] 10k property tests show Move ↔ Rust parity within 1 ULP
    - [ ] +2 bps tilt empirically verified on synthetic inputs
  </done>
  <rollback>git checkout -- contracts/sui/sources/slippage_model.move packages/shared/slippage/</rollback>
</task>

<task type="auto" id="1.4" depends_on="1.2,1.3">
  <name>evaluation_vault (owned-object) with full rule enforcement</name>
  <files>
    contracts/sui/sources/evaluation_vault.move
    contracts/sui/tests/evaluation_vault_tests.move
  </files>
  <context>
    Why: REQ-02 + REQ-12 — the contract is the only enforcement surface. Owned-object pattern avoids shared-object contention (PITFALLS 2.1). Inactivity timeout from Clarify R3.
    Pattern: ARCHITECTURE.md §1/§2 — each `EvaluationVault` is an owned object held by `trader`. Fields: `tier_id, shadow_balance, equity, peak_equity, daily_loss_reset_at, last_intent_at, intent_count, slippage_config_version, opened_at, last_active_at, terminated_reason`.
  </context>
  <action>
    1. Define `EvaluationVault` struct with all fields above + `has key, store` abilities.
    2. `submit_intent(vault: &mut EvaluationVault, side, size, ctx)`:
        - assert `!registry.paused`, `now - vault.last_intent_at >= 2000ms`, `vault.intent_count < 200`, `vault.terminated_reason == NONE`
        - read oracle via `oracle_adapter::get_price` (asserts staleness)
        - call `slippage_model::compute_fill` with captured config version
        - update equity, peak_equity; reset `daily_loss_at` if crossed 00:00 UTC since last update
        - check rules: max DD (10% Starter / 8% Basic+Pro), daily loss (5%), profit target (8% / 8% / 10%)
        - if rule violated → set `terminated_reason = Failed(rule_id)`, emit `VaultFailed`
        - if profit target hit → set `terminated_reason = Passed`, emit `VaultPassed`, call `cohort_sbt::level_up`
        - else emit `TradeFilled`
        - bump `last_intent_at`, `last_active_at`, `intent_count`
    3. `check_inactivity(vault: &mut EvaluationVault, ctx)`: anyone can call; if `now - vault.last_active_at > 7 days` AND `terminated_reason == NONE`, set to `Inactive`, emit `VaultInactive`. (Permissionless — operator can poke without needing capability.)
    **Avoid:** shared mutable state for the vault (forces consensus serialization); allowing operator to mutate vault fields directly.
  </action>
  <verify>sui move test -- evaluation_vault_tests (covers: rule violations, daily reset, profit pass, rate limit, intent cap, inactivity)</verify>
  <done>
    - [ ] All 6 rule paths (max DD, daily loss, profit target, rate limit, intent cap, inactivity) tested
    - [ ] Property test: vault state never mutates outside `submit_intent` and `check_inactivity`
    - [ ] Slippage config version captured at vault open and persists across evaluation
  </done>
  <rollback>git checkout -- contracts/sui/sources/evaluation_vault.move</rollback>
</task>

<task type="auto" id="1.5" depends_on="1.4">
  <name>cohort_sbt (mutable, non-transferable, friend-only, v2-evolution-ready schema)</name>
  <files>
    contracts/sui/sources/cohort_sbt.move
    contracts/sui/tests/cohort_sbt_tests.move
  </files>
  <context>
    Why: REQ-04 — engagement loop. SBT is non-transferable, mint-once per wallet, mutable via friend module only (evaluation_vault). Schema designed for in-place v2 evolution per Clarify R3.
    Pattern: ARCHITECTURE.md §1 — SBT object stored under trader's address, has `key` ability but no `store` (non-transferable). Mutation only via `friend`.
  </context>
  <action>
    1. Define `CohortSbt` struct: `highest_tier: u8, total_passes: u32, total_shadow_pnl: i128, total_trades: u32, last_active_at: u64`. `has key` (not `store`).
    2. `friend evaluation_vault;` — only evaluation_vault can call `mint_or_level_up`.
    3. `mint_or_level_up(trader, tier_passed, pnl_delta, ctx)`: idempotent — if SBT doesn't exist, mint; if exists, update fields. Emit `SbtMinted` or `SbtLeveledUp`.
    4. No transfer entrypoint. `display::register` for marketplaces shows tier-static image URI based on `highest_tier`.
    **Avoid:** Token-standard wrappers; transfer functions; any non-friend mutation path.
  </action>
  <verify>sui move test -- cohort_sbt_tests; grep -E "fun.*transfer" contracts/sui/sources/cohort_sbt.move returns no matches</verify>
  <done>
    - [ ] Idempotent mint/level-up
    - [ ] Non-transferable (no transfer entrypoint exists)
    - [ ] Only `evaluation_vault` can mutate (friend-only)
    - [ ] Display config wired for wallet rendering
  </done>
  <rollback>git checkout -- contracts/sui/sources/cohort_sbt.move</rollback>
</task>

<task type="auto" id="1.6" depends_on="1.5">
  <name>Fuzz harness + upgrade-compat CI gate</name>
  <files>
    contracts/sui/tests/fuzz.move
    .github/workflows/contracts-sui.yml
    contracts/sui/scripts/upgrade-compat-check.sh
  </files>
  <context>
    Why: PITFALLS 2.3 + 2.5 — Cetus-class precision bugs and Sui upgrade-compat regressions kill products. CI gates are the only durable mitigation.
    Pattern: Sui's built-in test framework supports random input generation; upgrade-compat is checked by attempting `sui client upgrade` against the previous build artifact in CI.
  </context>
  <action>
    1. `fuzz.move`: 100k random `(oracle_price, side, size, slippage_config)` inputs; asserts: no aborts other than expected reverts; `compute_fill` is monotonic in size; rule enforcement is consistent.
    2. `.github/workflows/contracts-sui.yml`: jobs `build`, `test`, `fuzz` (~60s budget per CI run), `upgrade-compat`.
    3. `upgrade-compat-check.sh`: checks out `main` HEAD, builds artifact A; checks out PR head, builds artifact B; runs `sui client upgrade --dry-run` against artifact A using artifact B. Fails on incompatibility.
    **Avoid:** running fuzz for >2 minutes in CI (developer iteration slows); doing upgrade-compat only manually (PRs will break it).
  </action>
  <verify>gh workflow run contracts-sui --ref pr-test-branch; verify all 4 jobs pass</verify>
  <done>
    - [ ] Fuzz job runs 100k inputs in ≤60s, asserts pass
    - [ ] Upgrade-compat gate fails an intentionally incompatible PR (verified)
    - [ ] CI workflow active on all contracts/sui changes
  </done>
  <rollback>git checkout -- contracts/sui/tests/fuzz.move .github/workflows/contracts-sui.yml</rollback>
</task>

</tasks>

<verification>
- [ ] `sui move build && sui move test` — green
- [ ] `cargo test -p shared-slippage --test move_parity` — green (10k random inputs match within 1 ULP)
- [ ] `grep -rE "fun .*(force_|admin_mutate|override|adjust_pnl|set_pnl)" contracts/sui/sources/` — no matches
- [ ] CI workflow `contracts-sui` has 4 jobs all green
- [ ] Upgrade-compat gate verified to fail on intentional incompatibility
- [ ] All 12 canonical events emit from expected code paths
</verification>

<success_criteria>
Phase 1 is complete when a trader on Sui devnet can call `registry::open_evaluation(tier)` after being allowlisted, receive an `EvaluationVault` owned object, submit ~10 trade intents that pass through `oracle_adapter::get_price` + `slippage_model::compute_fill`, and either pass (target hit → SBT minted/leveled) or fail (rule violated → `Failed` reason emitted), with no path for an operator to override the outcome. The on-chain `SlippageConfig` version is captured at open and the vault uses that version for the duration. Property tests demonstrate Move ↔ Rust slippage parity within 1 ULP. Fuzz + upgrade-compat CI gates are live and enforce on every PR.
</success_criteria>

<output>
Create `.claude/plans/Crypto-Native/phases/01-sui-contract-core/SUMMARY.md` after completion, documenting task results and any deviations from the plan.
</output>
