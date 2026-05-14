---
phase: 04-solana-port
type: execute
depends_on: ["01-sui-contract-core", "02-backend-indexer"]
files_modified:
  - contracts/solana/Anchor.toml
  - contracts/solana/programs/eval/src/
  - contracts/solana/tests/
  - services/risk-engine/src/chain_adapters/solana.rs
  - apps/trader/lib/contracts/registry-solana.ts
  - .github/workflows/contracts-solana.yml
  - .github/workflows/cross-chain-parity.yml
autonomous: true
requirements: [REQ-03, REQ-06, REQ-07]
must_haves:
  truths:
    - "Solana Anchor program implements all 7 Phase 1 modules with PDA seeds [b\"vault\", trader, tier_id, nonce]."
    - "TradeLogPage paginated PDAs handle vaults that exceed single-account size limits."
    - "Anchor account-validation constraints exhaustively defined per handler (Sealevel-attacks negative test suite green)."
    - "Squads multisig is the program upgrade authority."
    - "chain-adapter/solana ingests via Helius LaserStream (Yellowstone gRPC) and writes canonical events identical to Sui's."
    - "Cross-chain parity CI gate compares canonical events from identical synthetic test cases on both chains and fails on divergence."
    - "Trader app supports Solana wallet connect (@solana/wallet-adapter-react) + SIWS sign-in."
  artifacts:
    - "contracts/solana/programs/eval/ (Anchor program)"
    - "services/risk-engine/src/chain_adapters/solana.rs"
    - ".github/workflows/cross-chain-parity.yml"
  key_links:
    - from: "contracts/solana/programs/eval/src/state/vault.rs"
      to: "contracts/sui/sources/evaluation_vault.move"
      type: "parity_target"
    - from: "services/risk-engine/src/chain_adapters/solana.rs"
      to: "services/risk-engine/src/normalizer.rs"
      type: "function_call"
---

<objective>
Port the Sui contract surface to Solana Anchor, preserving canonical event parity. Solana-specific differences: PDAs instead of owned objects, paginated trade-log accounts to escape size limits, Sealevel-attack defenses (account-validation constraints + CPI signer minimization). The cross-chain parity CI gate is the load-bearing trust primitive: identical synthetic inputs on both chains must produce byte-equal canonical events. Trader app extended with Solana wallet support; from this phase on, both chains are first-class.
</objective>

<context>
@.claude/plans/Crypto-Native/PROJECT.md
@.claude/plans/Crypto-Native/STATE.md
@.claude/plans/Crypto-Native/ROADMAP.md
@.claude/plans/Crypto-Native/research/ARCHITECTURE.md (§2 Sui vs Solana mapping)
@.claude/plans/Crypto-Native/research/PITFALLS.md (§2.6 - 2.10 Sealevel attacks)
@contracts/sui/sources/evaluation_vault.move
@packages/shared/events/codegen/rust/lib.rs
</context>

<tasks>

<task type="auto" id="4.1" depends_on="">
  <name>Anchor program scaffold + oracle_adapter (Pyth Solana + Switchboard) + tier_config + registry</name>
  <files>
    contracts/solana/Anchor.toml
    contracts/solana/Cargo.toml
    contracts/solana/programs/eval/Cargo.toml
    contracts/solana/programs/eval/src/lib.rs
    contracts/solana/programs/eval/src/oracle.rs
    contracts/solana/programs/eval/src/state/tier_config.rs
    contracts/solana/programs/eval/src/state/registry.rs
    contracts/solana/programs/eval/src/instructions/admin.rs
    contracts/solana/programs/eval/src/error.rs
    contracts/solana/programs/eval/src/events.rs
  </files>
  <context>
    Why: REQ-03 — feature parity with Sui Phase 1. REQ-06 — capability split (no override path) preserved on Solana.
    Pattern: Anchor 0.30+ workspace; Pyth Solana program CPI; Switchboard On-Demand CPI; Registry as a single PDA `[b"registry"]` with allowlist as PDA-per-trader to avoid one big account.
  </context>
  <action>
    1. `anchor init eval`; pin Anchor + Agave to versions from `VERSIONS.md`.
    2. `oracle.rs`: `get_price(symbol, max_age_seconds)` via Pyth Solana program CPI; reverts `StaleOracle` if `pyth_price.publish_time + max_age_seconds < clock.unix_timestamp`. Staleness threshold = 5s on Solana (Clarify R2).
    3. `tier_config.rs`: 3 tier param structs; constants; no mutability.
    4. `registry.rs`: Registry PDA holds `paused: bool` + `multisig_authority: Pubkey`. Allowlist is `[b"allow", trader]` PDA (existence == allowed). Admin instructions: `add_to_allowlist`, `remove_from_allowlist`, `pause`, `unpause`. No vault-mutating instruction exists.
    5. `events.rs`: `#[event]` structs matching `packages/shared/events/codegen/rust` field names exactly; CI parity gate enforces this.
    **Avoid:** single giant allowlist account (rent + serialization cost); admin instructions that touch vaults; `init_if_needed` on the Registry (must be explicitly initialized at deploy).
  </action>
  <verify>cd contracts/solana && anchor build && anchor test --skip-deploy</verify>
  <done>
    - [ ] Anchor build green
    - [ ] Registry initialization works via multisig
    - [ ] Pyth + Switchboard CPIs read price + revert on staleness
    - [ ] Event struct names lint-match the schema codegen
  </done>
  <rollback>git checkout -- contracts/solana/</rollback>
</task>

<task type="auto" id="4.2" depends_on="4.1">
  <name>evaluation_vault as PDA + slippage_model + paginated TradeLogPage</name>
  <files>
    contracts/solana/programs/eval/src/state/vault.rs
    contracts/solana/programs/eval/src/state/trade_log.rs
    contracts/solana/programs/eval/src/slippage.rs
    contracts/solana/programs/eval/src/instructions/open_evaluation.rs
    contracts/solana/programs/eval/src/instructions/submit_intent.rs
  </files>
  <context>
    Why: REQ-03 + REQ-07 — Solana vault state must mirror Sui's evaluation_vault. PITFALLS 2.7 — Solana account size limits force pagination for `trade_log`.
    Pattern: Vault PDA = `[b"vault", trader, tier_id_u8, nonce_u32]`. TradeLog as separate `[b"log", vault_pda, page_u32]` PDAs created lazily as trade count grows past page capacity.
  </context>
  <action>
    1. `vault.rs`: same fields as Sui evaluation_vault — `tier_id, shadow_balance, equity, peak_equity, daily_loss_reset_at, last_intent_at, intent_count, slippage_config_version, opened_at, last_active_at, terminated_reason`. Anchor `#[account]` derives Discriminator.
    2. `slippage.rs`: ports `slippage_model.move` 1:1; pure function over `(oracle_price, side, size, config)`. Property tests in `packages/shared/slippage` extended to fuzz Anchor output == Move output == Rust reference within 1 ULP.
    3. `open_evaluation.rs`: instruction creates Vault PDA + first TradeLog page; captures current `slippage_config_version` at open.
    4. `submit_intent.rs`: full enforcement parity with Sui — rate limit (1s on Solana per Clarify R2), intent cap, daily-loss UTC reset, max-DD, profit-target, inactivity. Writes to TradeLog page; rolls to next page if size limit approached (via `init_if_needed` or explicit "open page" instruction — pick one per ARCHITECTURE.md open item 4).
    5. Anchor account validation constraints exhaustively: `#[account(seeds=[...], bump, has_one=trader, constraint=...)]` for every account on every instruction.
    **Avoid:** any instruction that mutates Vault from a non-trader signer; sharing TradeLog pages across vaults; `init_if_needed` on Vault (one-time deliberate init only).
  </action>
  <verify>anchor test -- vault_tests trade_log_paging slippage_parity; cargo test -p shared-slippage --test all_three_parity</verify>
  <done>
    - [ ] Vault PDA correctly seeded
    - [ ] TradeLog paging rolls to a new page at capacity
    - [ ] Anchor slippage matches Move slippage matches Rust reference within 1 ULP
    - [ ] All Sui rule paths replicate on Solana with identical outcomes for identical inputs
  </done>
  <rollback>git checkout -- contracts/solana/programs/eval/src/state contracts/solana/programs/eval/src/slippage.rs contracts/solana/programs/eval/src/instructions</rollback>
</task>

<task type="auto" id="4.3" depends_on="4.2">
  <name>cohort_sbt on Solana + Sealevel-attacks negative test suite + Trident fuzzer</name>
  <files>
    contracts/solana/programs/eval/src/state/sbt.rs
    contracts/solana/programs/eval/src/instructions/mint_or_level_up_sbt.rs
    contracts/solana/tests/sealevel-attacks.ts
    contracts/solana/trident-tests/
  </files>
  <context>
    Why: REQ-04 + REQ-06 — SBT must be non-transferable on Solana too. SBT mutability mechanism is "custom program-owned PDA" per ARCHITECTURE.md recommendation (simpler than Token-2022 NonTransferable). PITFALLS 2.6–2.10 — Sealevel attacks need a deliberate negative test suite.
    Pattern: SBT as `[b"sbt", trader]` PDA owned by the program; mint_or_level_up is a CPI from the vault flow; no transfer instruction exists. Trident fuzzer for Anchor.
  </context>
  <action>
    1. `sbt.rs`: PDA struct with 5 fields matching Sui cohort_sbt schema for v2 in-place evolution.
    2. `mint_or_level_up_sbt.rs`: instruction callable only with `vault.terminated_reason == Passed` and signer is the vault's trader. Idempotent.
    3. `sealevel-attacks.ts`: negative tests covering: signer/account confusion, PDA seed swap, account substitution across types, missing rent exemption, CPI privilege escalation. Each should fail with a specific error.
    4. Trident fuzzer config in `trident-tests/`; CI runs ~60s budget.
    **Avoid:** Token-2022 NonTransferable extension for v1 (more plumbing); a transfer instruction (must literally not exist); blanket `Signer` checks without account constraints.
  </action>
  <verify>anchor test -- sealevel-attacks; trident fuzz; gh workflow contracts-solana shows all 5 jobs green</verify>
  <done>
    - [ ] SBT cannot be transferred (no instruction exists)
    - [ ] All 5+ Sealevel negative tests fail with the expected program errors
    - [ ] Trident fuzz runs in CI within budget
  </done>
  <rollback>git checkout -- contracts/solana/programs/eval/src/state/sbt.rs contracts/solana/programs/eval/src/instructions/mint_or_level_up_sbt.rs contracts/solana/tests/sealevel-attacks.ts contracts/solana/trident-tests</rollback>
</task>

<task type="auto" id="4.4" depends_on="4.2">
  <name>chain-adapter/solana via Helius LaserStream (Yellowstone gRPC) + canonical event normalization</name>
  <files>
    services/risk-engine/src/chain_adapters/solana.rs
    services/risk-engine/src/normalizer.rs
  </files>
  <context>
    Why: REQ-08 — Solana events normalize into the same canonical rows as Sui. STACK.md §2 — Helius LaserStream is the entrenched 2026 pattern.
    Pattern: Yellowstone gRPC subscription filtered by program ID; decode Anchor events; normalize to the same canonical rows already written by Sui adapter.
  </context>
  <action>
    1. Add `tonic` + `yellowstone-grpc-client` deps to risk-engine.
    2. Implement `SolanaChainAdapter`: connects to Helius LaserStream gRPC endpoint with program ID filter; processes account-update + transaction-update messages; decodes Anchor events using IDL.
    3. Extend `normalizer.rs` to handle Solana raw events → canonical rows. Same DB writer reused.
    4. Cursor in `indexer_cursor.solana.last_slot`; advance atomically with row writes.
    5. `lag_seconds` metric exported per chain.
    **Avoid:** polling `getSignaturesForAddress` for the indexer (rate-limit hell); running your own validator with a Geyser plugin (out of v1 scope).
  </action>
  <verify>cargo test -p risk-engine chain_adapters::solana; cold-replay test: stop adapter, reset cursor, restart, assert identical rows reproduced</verify>
  <done>
    - [ ] Helius LaserStream connection works in production-like setup
    - [ ] Same canonical event types land in DB from both chains
    - [ ] Cold replay deterministic
  </done>
  <rollback>git checkout -- services/risk-engine/src/chain_adapters/solana.rs services/risk-engine/src/normalizer.rs</rollback>
</task>

<task type="auto" id="4.5" depends_on="4.4,3.6">
  <name>Cross-chain parity CI gate + Solana wallet support in trader app</name>
  <files>
    .github/workflows/cross-chain-parity.yml
    tests/parity/synthetic_inputs.json
    tests/parity/run_parity.ts
    apps/trader/lib/contracts/registry-solana.ts
    apps/trader/components/WalletConnect.tsx
    apps/trader/e2e/solana-happy-path.spec.ts
  </files>
  <context>
    Why: REQ-03 + REQ-08 — feature parity is a CI-enforced invariant, not a manual review item. PITFALLS 4.4 — parity rot kills the second-chain user experience.
    Pattern: synthetic input set (50 representative `(oracle_price, side, size, config_version)` tuples); replay on both chains via test-validator + sui-test-validator; assert canonical events match byte-for-byte.
  </context>
  <action>
    1. `synthetic_inputs.json`: 50 tuples covering edge cases — boundary slippage, near-max DD, exact profit target, rate limit edge, inactivity timeout.
    2. `run_parity.ts`: deploys fresh Sui devnet + Solana localnet; opens identical synthetic vaults on both; replays each input; diffs canonical events; fails on any field difference.
    3. `.github/workflows/cross-chain-parity.yml`: runs `run_parity.ts` on every PR touching contracts or events schema.
    4. Trader app: `WalletConnect.tsx` extended with @solana/wallet-adapter-react + SIWS via Phantom/Backpack/Solflare. `registry-solana.ts` mirrors `registry-sui.ts` interface.
    5. Add Playwright `solana-happy-path.spec.ts` mirroring Sui's, using a Phantom-compatible test wallet.
    **Avoid:** synthetic inputs that miss rounding edge cases (slippage compute is where parity bugs hide); manually running parity checks (CI must enforce).
  </action>
  <verify>gh workflow run cross-chain-parity; assert all 50 synthetic inputs match byte-for-byte; npx playwright test solana-happy-path.spec.ts</verify>
  <done>
    - [ ] Cross-chain parity CI gate active on every contracts PR
    - [ ] 50 synthetic inputs produce identical canonical events
    - [ ] Solana wallet sign-in works for at least Phantom + Backpack
    - [ ] Playwright Solana happy path green
  </done>
  <rollback>git checkout -- .github/workflows/cross-chain-parity.yml tests/parity apps/trader/lib/contracts/registry-solana.ts apps/trader/components/WalletConnect.tsx apps/trader/e2e/solana-happy-path.spec.ts</rollback>
</task>

</tasks>

<verification>
- [ ] `anchor build && anchor test` — green
- [ ] `trident fuzz` — green within CI budget
- [ ] Sealevel-attacks negative test suite — all expected failures fire
- [ ] Cross-chain parity CI gate — 50/50 synthetic inputs match
- [ ] Helius LaserStream ingest writes canonical rows
- [ ] Solana wallet sign-in works for Phantom + Backpack
- [ ] Playwright Solana happy-path green
</verification>

<success_criteria>
Phase 4 is complete when an allowlisted Solana wallet can complete the exact same evaluation flow as a Sui wallet (open → trade → terminal state → SBT mint), and the canonical events written to the indexer from both chains for identical inputs match byte-for-byte. The cross-chain parity CI gate is live and enforces on every contracts PR. Sealevel-attacks negative test suite + Trident fuzzer cover the Solana-specific failure modes. The trader app is now first-class on both chains.
</success_criteria>

<output>
Create `.claude/plans/Crypto-Native/phases/04-solana-port/SUMMARY.md` after completion, documenting task results and any deviations from the plan.
</output>
