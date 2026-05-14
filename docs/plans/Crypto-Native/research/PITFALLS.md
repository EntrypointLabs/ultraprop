# Domain Pitfalls — Crypto-Native Prop Firm v1 Closed Beta

**Domain:** Two-chain (Sui Move + Solana Anchor) paper-trading evaluation platform with on-chain rule enforcement, mutable cohort SBT, and public leaderboard.
**Researched:** 2026-05-14
**Researcher confidence note:** Web search and web fetch were both denied at the environment level during this research pass. All findings below derive from training-data knowledge of public incidents and documented ecosystem patterns through January 2026. Real-incident citations are marked MEDIUM confidence and flagged for verification by the SC engineer during Phase 1 scaffolding. Every recommendation includes a concrete metric or check so the phase planner can convert it into a gate or alert.

**Severity legend:**
- **P0** — kills the product if it happens (violates a stated success criterion or causes irrecoverable trust loss)
- **P1** — significant pain (degrades a success criterion, requires patch + comms)
- **P2** — annoyance (fixable in-stride, no permanent damage)

**Confidence-in-mitigation legend:**
- **High** — mitigation is mechanical, can be validated by a test or metric
- **Medium** — mitigation is procedural, requires discipline to hold
- **Low** — mitigation is partial; pitfall can still occur despite the strategy

---

## 1. Paper-Trading / Simulation-Fidelity Pitfalls

> The core essence per `PROJECT.md`: "paper-trading is indistinguishable from mainnet execution." Every pitfall in this section attacks that essence. None of them are theoretical — they show up the first time a beta trader runs the same trade on mainnet with their own funds and gets a different fill.

### Pitfall 1.1: Slippage model too generous (overfills the trader)
**Severity:** P0
**Confidence in mitigation:** Medium

**What goes wrong:** The simulated fill is consistently better than the mainnet fill at the same size. Traders pass evaluations they would have failed on a real venue. When v2 launches, the funded cohort underperforms beta results, the SBT loses meaning, and trust is gone.

**Why it happens:**
- Calibration uses *executed* mainnet swaps (which are a survivorship-biased sample — failed/cancelled trades are absent).
- Model parameters fitted to a calm 30-day window do not generalize to a volatile week.
- Oracle midpoint is used as the fill anchor without applying the maker/taker spread that a real router would have paid.
- Fees (router fee, gas equivalent, MEV tip) are excluded.

**Warning signs (automated):**
- Backtest residuals are systematically negative (sim fill price > realized fill price for buys; reverse for sells) by more than 2 bps on rolling 7-day window.
- Pass rate on Starter tier > 40% in first cohort week. Real prop firm pass rates trade in the 5–15% band; significant deviation upward implies a generous model. (Confidence: Medium — public prop-firm pass-rate disclosures vary.)
- Top-quartile P&L is bunched above the historical mainnet 95th-percentile equivalent for the same size and pair.

**Prevention strategy:**
1. Calibrate against *both* the 30-day historical replay (per `PROJECT.md` success criterion) *and* a continuous shadow comparison: every trade intent simultaneously simulates fill *and* queries a live router quote (e.g., Jupiter on Solana, Cetus/Aftermath on Sui aggregator). Persist `(sim_fill, live_quote, delta_bps)` for every trade. Alert when 7-day median `|delta_bps|` > 3 bps on majors.
2. Apply a deliberate "house-conservative" tilt of +1–2 bps against the trader in v1. Documented up front in trader-facing docs as "v1 simulates a slightly worse-than-mainnet fill so v2 results never disappoint." Easier to relax than tighten.
3. Include explicit modeled fees (router fee bps + gas equivalent priced in USD per trade) in the fill price, not just slippage.
4. Freeze model parameters at the moment beta opens. Any post-launch tuning is a **versioned model** — old evaluations finish on their original version (see Pitfall 1.7 and Pitfall 3.6).

**Phase mapping:** Phase 0 (calibration harness scaffold), Phase 2 (BE — model + shadow-quote logger), Phase 4 (beta hardening — alerting on residual drift).

---

### Pitfall 1.2: Latency model absent (free-edge fills)
**Severity:** P1
**Confidence in mitigation:** High

**What goes wrong:** Trader's intent is "filled" at the oracle price observed at submission time. On mainnet, the price would have moved during slot/checkpoint inclusion. Traders earn alpha from a delay that doesn't exist on real venues.

**Why it happens:**
- Solana slot time is ~400ms (Confidence: High — well-documented). Sui checkpoint commit cadence is ~250–500ms (Confidence: Medium — varies by epoch and validator config; SC engineer to confirm against current testnet docs in Phase 1).
- Pyth on Solana publishes at sub-second cadence; on Sui via Wormhole bridge with additional latency.
- A trader spamming intents during a volatile candle can effectively pick tops/bottoms with zero exposure to confirmation drift.

**Warning signs:**
- High intent-rate trader cohort (>X intents/min) has anomalously high Sharpe (>3) on backtest.
- Distribution of trade timestamps is non-uniform — cluster around price-move boundaries.

**Prevention strategy:**
1. Model an explicit **submission-to-fill latency** as part of the fill: `fill_price = oracle_price_at(t_submit + latency_window)` where `latency_window` is the empirical median chain-inclusion-to-DEX-fill on the comparable mainnet venue. Default: Solana 600ms, Sui 800ms (Confidence: Medium — calibrate during Phase 2 against measured Jupiter/Cetus inclusion-to-event distributions).
2. Add Gaussian noise around the latency mean (std ≈ 30% of mean) so traders can't precision-snipe.
3. Use Pyth's `publish_time` field as a sanity bound: if `current_time - publish_time` > staleness threshold, revert (see Pitfall 1.3). Never extrapolate forward.

**Phase mapping:** Phase 1 (Sui SC — `oracle_adapter.move` must expose `publish_time`), Phase 2 (BE — latency window in slippage_model), Phase 4 (calibration).

---

### Pitfall 1.3: Oracle staleness handling
**Severity:** P0
**Confidence in mitigation:** High

**What goes wrong:** Pyth or Switchboard feed lags during a market move. Contract accepts trades at a stale price; trader either gets free profit (oracle hasn't caught up to the move they front-ran) or unfair loss (oracle catches up mid-evaluation).

**Why it happens:** Pyth/Switchboard publishers can fall behind during congestion or feed outages. Bridges (Wormhole for Pyth-on-Sui) add latency. Network-level Solana congestion has historically pushed price-feed updates into the seconds-stale range. (Confidence: Medium — multiple Solana DEX postmortems through 2024–2025 cite this class of issue; SC engineer to source specific incidents.)

**Warning signs:**
- Indexer alert: `now - last_publish_time > 5s` for any active pair.
- `confidence_interval / price > 50 bps` on any active pair (Pyth confidence interval blow-out signal).
- Diverging Pyth vs Switchboard prices for the same asset > 30 bps for > 10s.

**Prevention strategy:**
1. **Hard staleness revert** in the contract. Reject intents where `slot_time - publish_time > MAX_STALENESS` (default: 5 seconds on Solana, 10 seconds on Sui via Wormhole). Module: `oracle_adapter.move` / `oracle_adapter` Anchor module.
2. **Confidence-interval gate.** Reject intents where Pyth confidence > 50 bps of price. Pyth's own docs recommend rejecting on excessive confidence widening. (Confidence: Medium — needs verification against current Pyth docs.)
3. **Dual-feed divergence halt.** If Pyth and Switchboard diverge > 30 bps for > 10s, halt new intents (existing positions continue against the more recently updated feed). Per `STATE.md` risk table this is already planned.
4. **User-facing UX.** When a stale-price revert fires, surface in the trader dashboard as "market data paused — protecting your fill" not "trade failed." Trust-preserving copy is part of the spec.

**Phase mapping:** Phase 1 (oracle adapter modules, both chains), Phase 2 (BE — staleness alerting), Phase 3 (frontend — paused-feed UX), Phase 4 (drill: simulate a feed outage).

---

### Pitfall 1.4: Self-referential price impact (none, when there should be some)
**Severity:** P2 at retail size, P1 at scale
**Confidence in mitigation:** Medium

**What goes wrong:** A paper trader can dump $50k into a thin pair and get filled at midpoint because their "trades" never move the market. They never get squeezed. The model under-reports slippage for any trade size that approaches a meaningful fraction of pool depth.

**Why it matters in v1:** The closed beta runs at ~$10k–$50k shadow allocations per `PROJECT.md` tier ladder. For SOL/ETH/BTC majors this is sub-noise on mainnet pools. For any non-major (if added), this becomes a free-edge cliff fast.

**Warning signs:**
- Trader concentrates in lower-liquidity pairs (if multi-pair is enabled). v1 should restrict pairs to majors only.
- Backtest residuals widen for trades > $25k notional even on majors.

**Prevention strategy:**
1. **Restrict v1 to BTC/ETH/SOL majors only** (already implied by success-criterion language; make it an explicit allowlist in the slippage model config).
2. **Square-root impact model.** Apply `impact_bps = k * sqrt(trade_notional / pool_depth)` even though no real pool is touched. Calibrate `k` against historical Jupiter/Cetus swap data (median realized impact for similar-size swaps).
3. **Notional cap per intent.** Cap single-intent notional at e.g. 20% of pool depth; reject larger intents. Forces traders to slice, which itself models a more realistic execution path.

**Phase mapping:** Phase 2 (BE slippage model — impact term), Phase 4 (calibration).

---

### Pitfall 1.5: No order-book queue reality (HFT free edge)
**Severity:** P1
**Confidence in mitigation:** Low

**What goes wrong:** A trader with a scripted client submits 1000 intents/minute timed to oracle ticks. Since there's no queue, no priority fee competition, and no risk of being out-raced by another taker, they get a free edge a mainnet HFT trader does not.

**Why it happens:** v1 has no live order book to queue behind. The simulated fill is deterministic given the oracle price.

**Warning signs:**
- Intent rate per trader > 60/min sustained.
- Hit-rate (profitable trades / total trades) > 70% for any single trader on majors. Mainnet HFT hit-rates rarely exceed this band cleanly; sustained high hit-rate is a flag.
- Trade clustering within 1 slot/checkpoint of oracle publish events.

**Prevention strategy:**
1. **Rate-limit intents** at the contract level: enforce `min_interval_between_intents` per vault (e.g., 1s on Solana, 2s on Sui). Document as "v1 paper trading is not a latency game; v2 mainnet will be."
2. **Add a simulated "queue position" penalty** for back-to-back intents within the same slot: each subsequent intent in a slot gets a worse fill (e.g., +0.5 bps per consecutive intent). Models the realistic situation that on mainnet your second tx of the slot would race other takers.
3. **Hard cap intents per evaluation period** (e.g., 200 trades per evaluation cycle). Forces trade selectivity; matches realistic prop-firm evaluation rules.
4. Acknowledge in trader docs that v1 is **not the venue for HFT strategies** and v2 will model queue contention explicitly.

**Phase mapping:** Phase 1 (SC — rate limit), Phase 2 (BE — queue-penalty parameter), Phase 4 (calibration + abuse detection).

---

### Pitfall 1.6: Backtest-vs-forward-test validation gap
**Severity:** P0
**Confidence in mitigation:** Medium

**What goes wrong:** Model is calibrated against the 30-day historical window (the success-criterion gate), passes, beta opens. Live conditions during beta diverge from the calibration window. Model is wrong on live data and nobody notices for weeks.

**Why it happens:** 30 days of historical replay validates the *model class* and parameter neighborhood, not live-condition robustness. Real-time conditions can have feed quirks, volatility regimes, or oracle-publish patterns that historical replay didn't expose.

**Warning signs:**
- Live residual distribution mean/variance drifts from historical residual distribution beyond 1 std.
- "Live shadow quote vs sim fill" 7-day median absolute delta > 5 bps.
- Operator alert on consecutive volatile sessions where pass-rate spikes or crashes.

**Prevention strategy:**
1. **Forward-test gate before beta opens.** After backtest passes, run model in shadow against live mainnet for 7 days *without any traders*. Compare sim fill against live Jupiter/Cetus quotes in real time. Must hold ±5 bps median on majors. This is a second gate after the historical backtest.
2. **Continuous calibration dashboard** during beta. Per `STATE.md` this is already planned — make it a visible Phase 4 deliverable, not an afterthought.
3. **Versioned model with public changelog.** If parameters change mid-beta, version bumps; new evaluations use new version, in-flight evaluations finish on old version (see Pitfall 3.6).

**Phase mapping:** Phase 0 (backtest harness), Phase 2 (shadow-quote pipeline), Phase 4 (forward-test gate, 7 days before beta open; calibration dashboard).

---

### Pitfall 1.7: Determinism break from off-chain inputs
**Severity:** P0
**Confidence in mitigation:** High

**What goes wrong:** A pass/fail decision cannot be reproduced from on-chain data alone (violates `PROJECT.md` success criterion). Some off-chain input — backend-injected slippage parameter, indexer-computed value, operator-tuned config — silently affects the contract's fill calculation.

**Why it happens:**
- "Just one config tweak" that lives in the backend and gets read by the contract via an admin call.
- Slippage model lives off-chain in the indexer and is only periodically committed on-chain; in-between, the contract has stale parameters.
- Random seed used in noise injection isn't sourced from a deterministic on-chain source.

**Prevention strategy:**
1. **Slippage parameters live on-chain.** A versioned `SlippageConfig` object/account, updateable only via a publicly auditable tx. Contract reads from on-chain config only. No off-chain config path.
2. **All randomness deterministic.** If noise injection is part of the latency model (Pitfall 1.2), derive seed from `(vault_id, tx_digest, oracle_publish_time)` — all on-chain.
3. **Replayability test.** A CI test ingests an event log + initial on-chain state and reproduces every pass/fail decision in the beta. If any decision is irreproducible from on-chain data alone, fail CI.

**Warning signs:**
- A pass/fail outcome cannot be re-derived from on-chain state in the indexer's reconciliation job.
- Any operator UI control writes config that the contract reads at fill time.

**Phase mapping:** Phase 1 (SC — on-chain SlippageConfig), Phase 2 (BE — replayability harness), Phase 4 (CI gate before beta open).

---

## 2. Smart-Contract Correctness Pitfalls

### Pitfall 2.1: Sui Move — shared-object contention on evaluation vaults
**Severity:** P0
**Confidence in mitigation:** High

**What goes wrong:** Evaluation vault is modelled as a shared object. Multiple concurrent intents from the same trader cause consensus contention; under load, some intents fail with object-not-available errors; in worst case, a trader can race their own intents to bypass an `assert!` that depends on the previous trade's state.

**Why it happens:** Sui's parallel execution model relies on object ownership. Shared objects go through consensus; owned objects do not. Mixing the two in the same flow is a classic Sui correctness/performance trap. (Confidence: High — well-documented Sui pattern.)

**Prevention strategy:**
1. **Per-trader vault as an owned object**, not shared. The trader owns their evaluation vault; only they can submit intents against it. Eliminates consensus contention by design.
2. Global state that *must* be shared (e.g., oracle adapter, leaderboard aggregator) is read-only on the hot path; mutations are out-of-band.
3. **No race-condition tests.** Property-based test in `sui move test`: submit N concurrent intents, assert exactly N effects, no double-spends of DD budget.

**Phase mapping:** Phase 1 (Sui contract architecture review — confirm vault ownership model before any code).

---

### Pitfall 2.2: Sui Move — capability/witness pattern misuse
**Severity:** P1
**Confidence in mitigation:** Medium

**What goes wrong:**
- Witness type accidentally has `drop`/`store`/`copy` ability, breaking its one-shot guarantee.
- Capability struct is `store`-able and gets stashed in a public object, allowing privilege escalation.
- One-time-witness (`OTW`) not actually a one-time witness because the module exposes a public constructor.

**Why it matters:** SBT mint, tier promotion, and admin pause should all use witness/capability gating. Sloppy ability flags here let any module that gets the type instantiate one and bypass intent.

**Prevention strategy:**
1. Witnesses are `drop`-only, never `store`/`copy`/`key`. CI lint: grep module sources for capability/witness types with extra abilities.
2. Capabilities use `key` only when the cap is itself a transferable on-chain object the holder intentionally owns; otherwise `store` inside a parent object with controlled access.
3. OTW pattern: module's witness type matches the module name in ALL_CAPS and is consumed in `init` only.

**Warning signs:**
- A witness/capability type has more than `drop` ability without a documented reason in the module header.
- Any `public fun new_<cap>()` constructor exists outside `init`.

**Phase mapping:** Phase 1 (SC — module-by-module review checklist).

---

### Pitfall 2.3: Sui Move — package-upgrade compatibility breakage
**Severity:** P0
**Confidence in mitigation:** Medium

**What goes wrong:** A v1.1 patch (e.g., bug fix in the slippage model) changes a struct layout or function signature in a way that breaks the upgrade-compatibility check. The package can no longer be upgraded; the only path is a fresh publish, which orphans every existing trader's vault object.

**Why it happens:** Sui's package upgrade rules require that public struct field layout and function signatures remain compatible. New public fields can be added in some cases; removing or reordering is breaking. (Confidence: Medium — exact rules evolve with Sui releases; SC engineer to verify against current Sui upgrade docs in Phase 1.)

**Prevention strategy:**
1. **Upgrade-compat CI gate.** A CI job builds the published v1 package + the candidate next version and runs `sui client verify-source` / `sui move build --skip-fetch-latest-git-deps` with the upgrade check. Fails if upgrade would be rejected.
2. **Public structs are minimal and additive.** Vault state fields are private; expose accessors. Adding a new field is additive via dynamic fields, not struct expansion.
3. **Dynamic-field-based extensibility.** Where forward compatibility matters (SBT fields per `PROJECT.md`), use Sui's dynamic fields so adding a field is a new field name, not a struct layout change.
4. **Reserved upgrade cap.** Upgrade cap stored in a multisig from day one; never burned in v1.

**Phase mapping:** Phase 1 (SC — upgrade-compat CI gate at first publish).

---

### Pitfall 2.4: Sui Move — dynamic-field key collisions
**Severity:** P1
**Confidence in mitigation:** High

**What goes wrong:** Two modules use the same dynamic-field key type and string for unrelated state on the same parent object. Reads return wrong values; writes corrupt the other module's state.

**Prevention strategy:**
1. Every dynamic-field key is a **typed witness struct** namespaced to the module: `struct EvalState has copy, drop, store { id: ID }` — type identity prevents collision even with the same string.
2. Lint: grep for `df::add(...)` with string keys; require typed key structs.

**Phase mapping:** Phase 1 (SC — coding convention + CI grep).

---

### Pitfall 2.5: Cetus-class precision/rounding exploits (Sui CLMM lesson)
**Severity:** P0
**Confidence in mitigation:** Medium

**What goes wrong:** A precision/rounding bug in fixed-point math lets a crafted trade extract value disproportionate to inputs. The Cetus 2025 incident (Confidence: Medium — incident widely reported in 2025; SC engineer to source the post-mortem and confirm specifics) reportedly involved a mishandled bitshift / overflow in CLMM math that allowed value extraction with negligible input. Loss in the tens of millions.

**Relevance here:** v1 has no real capital, so direct theft is not the issue. But the slippage / fill model is the load-bearing essence. A precision bug in fill math means pass/fail decisions are wrong, the SBT levels wrong people, and the leaderboard is corrupt.

**Prevention strategy:**
1. **No hand-rolled fixed-point.** Use a vetted library (Sui's `sui::math` / `std::u128` patterns; Anchor: a well-known crate like `fixed` or `spl-math` if applicable). Document choice in module header.
2. **Property-based tests** on the slippage/fill function: random inputs across the full domain, assert invariants (`fill_price` between oracle and worst-case bound; `output_amount > 0` for `input_amount > 0`; no overflow).
3. **Fuzzing in CI.** Move/Anchor fuzz harness on the fill function for at least N seconds per CI run.
4. **External audit** of the fill/slippage math before beta opens, even though no real capital is at stake. Cost is non-trivial but the credibility cost of a public "your sim is broken" finding mid-beta is higher.

**Warning signs:**
- Any commit to the slippage/fill module from a non-SC engineer.
- Any new fixed-point literal in code that isn't a documented model constant.

**Phase mapping:** Phase 1 (SC — fuzz harness from day 1), Phase 4 (audit gate before beta open).

---

### Pitfall 2.6: Solana Anchor — missing account constraints
**Severity:** P0
**Confidence in mitigation:** High

**What goes wrong:** A handler accepts an `Account<'info, EvalVault>` without `has_one = owner`, `seeds = [...]`, or signer constraints. Attacker passes a vault that isn't theirs, or an unsigned vault, and the handler proceeds. (This is the #1 class of Anchor exploit historically — see Sealevel Attacks / coral-xyz documented patterns. Confidence: Medium — pattern is well-documented; SC engineer to reference the canonical Sealevel Attacks repo during Phase 1.)

**Prevention strategy:**
1. **Every account in every handler context has explicit constraints.** Mandatory checklist per handler: `signer`, `owner`, `seeds`, `bump`, `mut` flags.
2. **CI lint** against Anchor IDL: every account in every instruction must have at least one of `signer`/`has_one`/`seeds`/`address` or be marked `UncheckedAccount` with a `/// CHECK:` comment explaining why.
3. **Negative tests.** For every handler, a test that submits with the wrong owner / unsigned / wrong PDA and asserts revert.

**Phase mapping:** Phase 1 (Anchor port — written with Sealevel Attacks checklist as a code-review aid).

---

### Pitfall 2.7: Solana Anchor — PDA seed collisions
**Severity:** P1
**Confidence in mitigation:** High

**What goes wrong:** Two PDAs in different programs (or different account types in the same program) derive to the same address because seed prefixes aren't disambiguated. Account-confusion attack: attacker gets one type stored where another is expected.

**Prevention strategy:**
1. Every PDA seed list starts with a **typed string discriminator** unique per account type: `seeds = [b"eval_vault_v1", trader.key().as_ref()]`, never `seeds = [trader.key().as_ref()]`.
2. CI grep: every PDA derivation includes a string seed as first element matching the account type name.

**Phase mapping:** Phase 1 (Anchor port).

---

### Pitfall 2.8: Solana Anchor — account size / rent / resize traps
**Severity:** P1
**Confidence in mitigation:** Medium

**What goes wrong:** Vault account allocated with a fixed size; mid-beta, schema grows (e.g., new field for v1.1). Resize logic is buggy or rent isn't topped up. Vault becomes uninitializable for new traders, or worse, existing vaults' data is corrupted on resize.

**Prevention strategy:**
1. **Allocate generously.** Vault accounts size = max foreseeable v1 schema + 50% headroom. Rent is paid once at creation; over-allocation is cheap.
2. **No mid-evaluation resize.** Any schema change ships in a new program version; new vaults use new size; old vaults complete on old layout.
3. **Rent-exemption explicit at creation.** Anchor's `init` handles this; never bypass with manual `system_program::create_account`.

**Phase mapping:** Phase 1 (Anchor port — vault sizing decision).

---

### Pitfall 2.9: Solana Anchor — CPI privilege escalation / signer leakage
**Severity:** P0
**Confidence in mitigation:** High

**What goes wrong:** Program A invokes Program B via CPI with signer seeds, but the signer-seeds set leaks authority that B then uses to act on A's behalf in unintended ways.

**Relevance:** SBT mint will likely CPI to a token program (Metaplex Token Metadata or a v1 custom token program). Oracle reads CPI to Pyth.

**Prevention strategy:**
1. **Minimal CPI signer seeds.** Only sign what's strictly needed for the invoked instruction.
2. **Read-only CPIs** for oracle reads (Pyth's price account is read-only; no signer needed).
3. Negative test: assert that CPI-invoked program cannot act on accounts beyond the explicit account list.

**Phase mapping:** Phase 1 (Anchor SBT mint module).

---

### Pitfall 2.10: Solana Anchor — Anchor version pinning + sysvar deprecations
**Severity:** P2
**Confidence in mitigation:** High

**What goes wrong:** Anchor 0.30+ deprecated several sysvar imports / changed account validation defaults. Mid-project upgrade silently changes semantics; a constraint that was checked is no longer checked.

**Prevention strategy:**
1. Pin Anchor version in `Cargo.toml` and `Anchor.toml`. Pin Solana CLI version in `rust-toolchain`. Pin in CI image.
2. Upgrade in a dedicated branch with full test suite re-run; never as a transitive bump.

**Phase mapping:** Phase 0 (toolchain pinning decision in scaffolding).

---

### Pitfall 2.11: Cross-chain — event schema drift
**Severity:** P0
**Confidence in mitigation:** High

**What goes wrong:** Sui emits `TradeExecuted { ..., shadow_pnl: i128, ... }`; Solana emits `TradeExecuted { ..., shadow_pnl: i64, ... }`. Indexer ingests both into the same Postgres column; one of them silently truncates or sign-extends wrong. Leaderboard is incorrect for one chain's traders, possibly only at edge cases.

**Why it matters here:** `STATE.md` already flags this as H impact; this section grounds the specific mechanism.

**Prevention strategy:**
1. **Single schema source of truth** in `packages/shared/events/`, per `STATE.md` decision.
2. **Codegen, not hand-translation.** Move struct definitions and Anchor `#[event]` structs generated from the same schema file. CI fails if codegen output differs from committed source.
3. **Indexer schema test.** Sample events from both chains in the test corpus; assert identical Postgres row after ingest for semantically identical trades.
4. **Cross-chain event parity test** in CI: same trade scenario submitted to both chains' local validators (sui-test-validator + solana-test-validator), diff the emitted events normalized to JSON.

**Phase mapping:** Phase 0 (schema + codegen scaffolding), Phase 1 (both contracts consume codegen), Phase 2 (indexer parity test), Phase 4 (beta hardening — schema-drift CI gate is blocking).

---

### Pitfall 2.12: Cross-chain — identical state evolves differently due to timing
**Severity:** P1
**Confidence in mitigation:** Medium

**What goes wrong:** A trade submitted at "the same time" on Sui and Solana fills at different oracle prices because Sui's checkpoint and Solana's slot have different cadences and Pyth on Sui is bridged via Wormhole (additional ~1–3s latency, Confidence: Medium). The two chains' leaderboards reward different things for the same strategy.

**Prevention strategy:**
1. **Per-chain leaderboards** displayed alongside a combined one. Traders see "Sui leaderboard", "Solana leaderboard", "Combined." Combined uses normalized P&L (% of allocation) not raw P&L.
2. **Document timing differences** in trader-facing docs. Don't pretend the two chains are interchangeable second-by-second; the *evaluation outcome* is comparable, not the per-tick fill.
3. **Backtest both chains against the same 30-day window.** Confirm that median fills converge within 2 bps when normalized; if not, the slippage model needs a chain-specific latency term.

**Phase mapping:** Phase 2 (BE — chain-specific latency calibration), Phase 3 (frontend — per-chain + combined leaderboards), Phase 4 (calibration gate per chain).

---

## 3. Engagement-Loop / Retention Pitfalls

### Pitfall 3.1: Sybil / leaderboard farming despite invite-only
**Severity:** P1 in v1, P0 in v2
**Confidence in mitigation:** Low

**What goes wrong:** Even with invite-only, an invited trader spins up 5 wallets and runs the same strategy on each to maximize their odds of a top-leaderboard slot. The SBT becomes a measure of wallet count, not skill. When v2 launches with real capital, the leaderboard signal has been corrupted from the start.

**Why "invite-only mitigates partly":** It bounds the *attacker pool* but not the per-attacker behavior. A motivated invited trader can still multi-wallet.

**Warning signs:**
- Multiple wallets with near-identical trade timing patterns (within tens of ms).
- Multiple wallets routinely funded from the same source.
- Same IP / device fingerprint behind multiple wallets (only detectable client-side — see UX caveat).

**Prevention strategy:**
1. **One invite = one wallet.** Allowlist is keyed by wallet address; second wallet from the same human is technically possible but requires a second invite they don't have. Founder networks (Octant, Bungee per `PROJECT.md`) make this socially enforced in v1.
2. **Behavioral Sybil detection.** Indexer job: cluster wallets by trade-timing correlation, funding-source overlap (cross-chain bridge originator), and intent-pattern fingerprint. Flag clusters for operator review. Detect, do not auto-punish (false positives are reputation-destroying).
3. **Single SBT per human, not per wallet, is a v2 problem.** Document the v1 cohort SBT as **wallet-scoped** explicitly; do not promise human-uniqueness in v1.
4. **Optional:** Discord-account binding (per-invite Discord verification). Lightweight, not bulletproof, but raises Sybil cost by an order of magnitude.

**Phase mapping:** Phase 2 (BE — Sybil clustering job), Phase 4 (beta hardening — operator review workflow).

---

### Pitfall 3.2: Tier-collapse — top users finish in week 1
**Severity:** P1
**Confidence in mitigation:** Medium

**What goes wrong:** A skilled trader runs through Starter → Basic → Pro in 5 days. They are now ranked #1 with 3 SBT levels and have *nothing to do* for the remaining 14+ weeks of beta. They lose interest, churn, and the leaderboard freezes.

**Why it happens:** Three tiers with 8–10% targets are achievable in a handful of profitable sessions for someone good. v1 has no fourth-tier off-ramp.

**Prevention strategy:**
1. **Recurring "challenge" sub-evaluations** at the Pro tier. After passing Pro, the trader can attempt repeated harder sub-challenges that level the SBT further (e.g., +1 SBT level per Pro-pass at increasing target). These don't unlock new tiers — they keep the top engaged with a marginal cost-benefit gradient.
2. **Time-gated cooldowns** between tier attempts (e.g., must accrue 5 trading days at tier N before attempting N+1). Slows the speed-run path without penalizing skill.
3. **Daily streak SBT field** (per `PROJECT.md` SBT has `last_active_at`). Add a `streak_days` field; visible on leaderboard.
4. **"Consistency" leaderboard column** weighted toward Sharpe / day-over-day variance, not just peak P&L. Different ranking surface keeps "I'm good but already finished" users engaged.

**Phase mapping:** Phase 1 (SBT schema — confirm streak/consistency fields), Phase 2 (BE — leaderboard math with multiple ranking surfaces), Phase 3 (frontend — leaderboard tabs).

---

### Pitfall 3.3: Bottom-quartile attrition — fail once, never return
**Severity:** P1
**Confidence in mitigation:** Medium

**What goes wrong:** Trader fails Starter on day 1. Per typical prop-firm semantics, they're "out." With no fee paid (per `PROJECT.md` no fees in v1) the marginal cost of disengagement is zero. They never come back. Total beta cohort shrinks faster than expected; the 30-completion success criterion misses.

**Adjacent reference:** Hyperliquid, Drift, GMX, dYdX have all run trader competitions; the public retrospectives (Confidence: Low — specific public numbers are sparse) generally show participant numbers falling 50%+ between rounds without explicit re-engagement mechanics.

**Prevention strategy:**
1. **"Retry" semantics from day 1.** Failed Starter can be retried after a 24-hour cooldown. The SBT records `total_failures` (not in current `PROJECT.md` schema — propose adding `total_attempts` if not already implied by `total_trades`).
2. **Failure-debrief in trader UI.** On fail, show exactly which rule tripped (DD breach? daily-loss? timeout?), at what timestamp, with the chart. Educational, not punitive. Reduces "the platform is rigged" perception.
3. **Cohort-wide retry events.** Once per fortnight, operator triggers a "fresh start" event — all failed-but-not-passed traders get a free retry slot. Marketed in Discord. Re-engagement vehicle.
4. **Quiet leaderboard floor.** Failures don't appear on the public leaderboard at all (only passes do). Avoid Pitfall 3.5 reinforcement.

**Phase mapping:** Phase 1 (SC — retry semantics + cooldown), Phase 3 (frontend — debrief UI), Phase 4 (operator playbook — fresh-start events).

---

### Pitfall 3.4: SBT "promise inflation"
**Severity:** P0
**Confidence in mitigation:** Medium

**What goes wrong:** Crypto-native users hear "cohort SBT" and read "future airdrop allocation." They take Pro tier risks. When v2 ships and the SBT *doesn't* equal an airdrop, community backlash is permanent. The `PROJECT.md` strategy explicitly leans into "soft-airdrop psychology" without making "explicit airdrop promises" — this is the exact gap where promise inflation lives.

**Why it's P0:** Once trust is broken on this axis, no future relaunch fixes it.

**Prevention strategy:**
1. **Anti-promise copy.** Every SBT/leaderboard mention in trader UI and Discord carries a single boilerplate disclaimer: "The v1 cohort SBT documents your trading record. It is not a claim on any token or capital. Future products may or may not consider it."
2. **Operator messaging discipline.** No team member, in any channel, says anything resembling "the SBT will be valuable" or "this is for the airdrop." Treat it like an SEC-level discipline issue internally. Maintain a Notion canon of "approved language" / "banned language" updated before beta opens.
3. **Public leaderboard de-financialization.** Display tier, consistency, total trades. Do NOT display dollar P&L prominently (or only as % of shadow allocation). Reduces "I'm farming dollars for a future drop" framing.
4. **Active expectation management.** Quarterly written update to the cohort: "Here's what the SBT represents this quarter. Here's what we have NOT promised."

**Warning signs:**
- Discord sentiment analysis: rising frequency of "airdrop," "TGE," "allocation" tokens in trader messages.
- Trader-side X/Twitter posts framing the SBT as airdrop farming.

**Phase mapping:** Phase 3 (frontend — disclaimer copy in every SBT/leaderboard view), Phase 4 (operator playbook — language canon, Discord moderation guide).

---

### Pitfall 3.5: Public-leaderboard demoralization (mid-tier flight)
**Severity:** P1
**Confidence in mitigation:** Medium

**What goes wrong:** Public leaderboard means every trader's rank is visible. Mid-tier traders (rank 20–50 of 100) feel exposed, become risk-averse, then disengage entirely. Beta participation rate collapses to top + bottom dropouts.

**Prevention strategy:**
1. **Pseudonymous leaderboard.** Traders pick a handle at signup; default to "trader_<base58-of-pubkey-prefix>". Anyone can opt-in to reveal wallet. Removes social-cost-of-being-mid-tier.
2. **Cohort-relative metrics.** "You're in the top 40%" rather than "rank 41 of 100." Same data, lower social pain.
3. **Multiple leaderboard surfaces.** Top P&L is one tab; "biggest improvement this week" is another; "longest consistency streak" is another. Mid-tier in P&L can be top-tier in consistency.
4. **Anti-doxxing in operator playbook.** Operator does not publicly call out specific failed evaluations even in Discord. Outcomes are between trader and platform.

**Phase mapping:** Phase 3 (frontend — pseudonymous handles, multiple leaderboard tabs), Phase 4 (operator playbook).

---

### Pitfall 3.6: Mid-beta model recalibration invalidates in-flight evaluations
**Severity:** P0
**Confidence in mitigation:** High

**What goes wrong:** Week 4 of beta: BE engineer notices slippage residual has drifted (Pitfall 1.6 detection fires). Re-tunes the model. In-flight evaluations now run on a model that's different from the one they started on. Two failures:
- Trader who was on pace to pass under old model now fails under new model. Trust gone.
- Trader who passed under old model has a less-credible SBT than one who passed under new model. Leaderboard now mixes apples and oranges.

**Prevention strategy:**
1. **Versioned slippage model.** On-chain `SlippageConfig` (per Pitfall 1.7) carries a `version` field. Each vault captures `model_version_at_start`. Vault uses its captured version for the duration of its evaluation.
2. **Model deprecation, not in-place rewrite.** New version is published; new vaults use new version; in-flight vaults complete on old version. SBT level captures `model_version`; future leaderboard surfaces can normalize.
3. **Recalibration cadence.** Model is **frozen at beta open**. Any change between beta open and beta close is a versioned event, announced 7 days in advance to the cohort with a written rationale, and applies only to NEW vault starts.
4. **Public model changelog.** Markdown file in repo, dated, version-tagged. Operator playbook: every recalibration produces a changelog entry before the on-chain update.

**Phase mapping:** Phase 1 (SC — on-chain SlippageConfig with version field; vault captures version at start), Phase 4 (operator playbook — model-change protocol, public changelog).

---

## 4. Operational Pitfalls

### Pitfall 4.1: Operator-override creep (success-criterion killer)
**Severity:** P0
**Confidence in mitigation:** High
**This is the stated success criterion: "Zero pass/fail decisions during beta require operator override or re-adjudication."**

**What goes wrong:** Trader's evaluation ends in a marginal fail — DD breach at 8.01% when limit is 8.00%, with a clear case that "the oracle was momentarily glitchy." Operator hand-overrides "just this once." Word spreads in Discord. Next week, three more traders appeal. Then ten. Within a month, the platform is run on operator vibes, not on-chain rules; v2 launches and the same expectations carry over to real money.

**Prevention strategy (this needs the strongest possible enforcement):**
1. **No override path exists in the contract.** Operator role has exactly two capabilities: `pause()` (halts new intents) and `update_allowlist()` (adds/removes traders). Operator role *cannot* mutate vault outcomes, cannot reverse pass/fail events, cannot mint SBTs out-of-band. **Enforced in Move/Anchor, not in policy.**
2. **Admin dashboard is read-only for evaluation state.** No "edit vault" button exists in the UI. There is no admin RPC method that mutates vault outcomes. If an emergency forces a fix, it requires a deliberate, audited contract upgrade — friction is the feature.
3. **"Appeals" channel = data-collection channel, not action channel.** Discord has a `#feedback` channel; appeals go there. They generate model-improvement tickets (recalibration with versioning, per Pitfall 3.6); they do NOT generate per-trader fixes.
4. **Public commitment in trader docs.** Trader-facing FAQ states verbatim: "Pass/fail outcomes are determined by on-chain rules and cannot be reversed. The operator team cannot and will not override an evaluation outcome."
5. **Audit metric.** Success criterion has a quantitative form: count of vault outcomes that required any operator action beyond `pause` / `allowlist` = 0. Report this number in every weekly beta status.

**Warning signs:**
- Any operator action on the admin dashboard touches a vault PDA / Sui object that is not the allowlist.
- Any `#feedback` Discord thread where the operator's response is "I'll look into it" rather than "I logged this for the next model version."
- Any private DM to the operator requesting reversal.

**Phase mapping:** Phase 1 (SC — capability split: pause/allowlist only; no override capability exists), Phase 2 (BE — admin RPC has zero vault-mutating methods), Phase 3 (frontend — admin dashboard read-only for vaults; only allowlist + pause are editable), Phase 4 (operator playbook + public FAQ + weekly audit metric).

---

### Pitfall 4.2: Slippage calibration drift undetected
**Severity:** P0
**Confidence in mitigation:** High

**What goes wrong:** Model is accurate at launch. Market regime shifts (a quiet calibration window → a volatile beta period). Residuals widen. Nobody is looking at the calibration dashboard because nothing is broken on the surface. By week 6, pass-rate is wildly off, but nobody has looked at the residuals.

**Prevention strategy:**
1. **Automated daily calibration job.** Runs on indexer VM. Computes 7-day rolling median absolute residual on `(sim_fill, live_quote)` pairs. Posts to operator Slack/Discord every day at fixed time.
2. **Alert thresholds.** Hard alert (page operator) at 5 bps. Soft alert (Discord) at 3 bps. Tracked since launch.
3. **Stale dashboard alert.** If the calibration job hasn't posted in 48h, page operator. (Detects the "job itself broke and nobody noticed" failure mode.)
4. **Pre-launch threshold lock.** The 5 bps / 3 bps thresholds are committed to the repo before beta opens. Changing them mid-beta requires the same versioned-model discipline as Pitfall 3.6.

**Phase mapping:** Phase 2 (BE — calibration job + alert), Phase 4 (operator playbook — escalation steps when alert fires).

---

### Pitfall 4.3: Indexer falls behind / Postgres SPOF
**Severity:** P1 (per `STATE.md` risks table)
**Confidence in mitigation:** Medium

**What goes wrong:** Single-VM Postgres + TimescaleDB stack chokes on two-chain event volume during a high-activity window. Dashboard goes stale. Traders see "live P&L" that's 30 seconds behind reality. Trust erodes ("is my last trade even counted?"). Worse: VM dies; entire dashboard is dark.

**Why it's P1 not P0:** On-chain is the source of truth; events can be re-indexed. But the *trader-visible* dashboard going dark for hours during beta will lose users.

**Prevention strategy:**
1. **Cursor-based ingest with replay.** Every ingest job tracks `(chain, last_checkpoint_or_slot, last_event_seq)` in Postgres. Restart = resume from cursor. Per `STATE.md` "events can be re-indexed" — actually test this. A documented restore drill is in `STATE.md`; **make it a phase deliverable, not a future task.**
2. **Indexer lag alert.** Indexer publishes its own lag metric: `(now - last_chain_event_timestamp)`. Alert at >30s; page at >5min.
3. **Backups.** Daily Postgres dump to off-VM storage (e.g., S3). Weekly restore drill into a fresh VM (timed; goal < 1 hour to restore-and-resume).
4. **TimescaleDB continuous aggregates** for leaderboard math, not live aggregation. Reduces query pressure during peak.
5. **Static fallback page.** If WebSocket dies, dashboard falls back to a "last updated 30s ago" REST-polled view, not a blank screen.

**Phase mapping:** Phase 2 (indexer cursor + lag metric), Phase 4 (backup + restore drill before beta open; static fallback in trader UI).

---

### Pitfall 4.4: Cross-chain parity rot
**Severity:** P1
**Confidence in mitigation:** Medium

**What goes wrong:** Sui contract ships a v1.1 patch that subtly changes an edge case. Solana port doesn't get the patch for two weeks. Solana traders silently get worse fills, complain in Discord, feel like second-class citizens. By the time the team notices, half the Solana cohort has churned.

**Why it happens:** Sui-first sequencing (per `PROJECT.md`) plus a small team plus the natural tendency to "ship to Sui, port later" creates a permanent lag.

**Prevention strategy:**
1. **No Sui-only patches after beta opens.** Post-launch contract changes ship to both chains in the same release window or not at all. Pre-launch this is relaxed (Sui can be ahead during dev); post-launch it is policy.
2. **Cross-chain parity CI gate.** Every PR touching `contracts/sui/` flags the corresponding `contracts/solana/` file in PR review checklist. CI fails if Sui contract changes without a corresponding Solana change ticket linked.
3. **Parity diff dashboard.** Indexer tracks: same-trade fill price delta between chains for the same oracle window. If >2 bps median over 24h, page.
4. **Per-chain pass-rate metric.** If Sui pass rate and Solana pass rate diverge by >5pp over a week, page. (Detects the "subtle bug only affects one chain" failure.)
5. **Honest about Sui-first in launch comms.** If Solana parity slips, **acknowledge publicly** and set a re-parity date. Silence is worse than slippage.

**Phase mapping:** Phase 1 (SC — codegen + cross-chain CI gate), Phase 2 (indexer parity diff), Phase 4 (operator playbook — comms protocol when parity slips).

---

### Pitfall 4.5: Wallet-adapter UX cliff
**Severity:** P1
**Confidence in mitigation:** Medium

**What goes wrong:** Trader receives invite, clicks "connect wallet," wallet adapter hangs / shows a confusing chain-mismatch error / fails to sign the intent payload. Trader drops off. With a 30-trader success criterion against a 50–100 invite list, every drop-off in connection flow is a meaningful percentage.

**Why it happens:**
- Sui wallet ecosystem has multiple adapters (Sui Wallet, Suiet, Backpack-on-Sui, Phantom-on-Sui). Adapter-version interactions break.
- Solana wallet ecosystem (Phantom, Backpack, Solflare) has fewer issues but more users → more long-tail edge cases.
- Trade-intent signing UX is non-standard; a wallet prompt showing raw bytes triggers "is this a scam?" instinct.

**Prevention strategy:**
1. **Pre-launch wallet matrix test.** Before beta opens, founder + designer + SC engineer each test the connection + intent-signing flow on each of: Phantom, Backpack, Solflare (Solana side); Sui Wallet, Suiet, Backpack-on-Sui (Sui side). Matrix lives in `STATE.md` or a wiki; any "fail" cell blocks beta open.
2. **Human-readable intent payloads.** Use Sui's transaction-block intent description and Solana's `versioned transaction + simulation` to surface "Trade: BUY 0.5 SOL at ~$X, max slippage Y bps" in the wallet UI, not raw bytes. (Confidence: Medium — exact wallet UI varies; designer to spec.)
3. **Connect-flow funnel metric.** Indexer logs: invites issued → wallet connected → first intent signed → first evaluation started → first evaluation completed. Operator reviews funnel weekly. Drop > 20% at any step triggers investigation.
4. **Wallet-recovery copy.** If connection fails, the failure screen tells the trader exactly what to try (refresh, switch network, update adapter), not "something went wrong."
5. **Discord live-test channel.** Two weeks before public beta open, run a "test cohort" of 5 invitees through the full flow. Treat their stumbles as P0 bugs.

**Phase mapping:** Phase 3 (frontend — wallet matrix + intent-signing UX), Phase 4 (test cohort + funnel metric).

---

### Pitfall 4.6: Discord-as-support breakdown
**Severity:** P1
**Confidence in mitigation:** Medium

**What goes wrong:** All support runs through Discord in v1 (per `STATE.md` Discord + Notion fallback for admin). Complaints get lost in scrollback; no audit trail; the operator forgets what they promised whom; the same bug gets reported six times without a single ticket; when beta scales up, the chaos is unrecoverable.

**Prevention strategy:**
1. **Linear (or any ticket tool) shadow.** Every reported issue in Discord gets a Linear ticket within 24h. Operator's discipline; not delegated to the user. Even a one-line ticket beats no ticket.
2. **Discord channel structure.** `#bug-reports` (templated), `#feedback` (per Pitfall 4.1, data-collection only), `#announcements` (one-way), `#general` (community). Templates in `#bug-reports` capture: chain, wallet address, trade IDs, screenshot.
3. **Weekly status post.** Operator posts every Friday: "This week we shipped X, fixed Y, are working on Z. Open bugs: link to Linear filter." Sets the expectation of a structured response loop.
4. **Pre-public-launch graduation.** Before any public launch beyond closed beta, the support stack migrates to a real ticketing tool (Linear forms, Intercom, etc.). v1 closed beta is the latest moment Discord-only is acceptable.

**Phase mapping:** Phase 4 (operator playbook — Discord structure + Linear shadow process + weekly status template).

---

### Pitfall 4.7: Premature feature creep
**Severity:** P0
**Confidence in mitigation:** Medium

**What goes wrong:** Mid-Phase 2 a top invitee says "this would be amazing with perps." Founder agrees in a Discord DM. Backend engineer spends two weeks scoping perps integration. Slippage calibration slips. Beta-open date slips. Tier ladder doesn't ship. Cohort SBT half-built.

**Per `PROJECT.md` "Out of Scope":** Perps, prediction markets, airdrop hunting, multi-category unlocks, token, KYC — all explicitly deferred. The pitfall is not that the team doesn't know they're out of scope; it's that mid-build, a charismatic asks nicely, and discipline breaks.

**Prevention strategy:**
1. **Scope-lock at Phase 1 close.** Once Phase 1 (SC scaffolding + slippage model harness) is complete, the v1 feature set is locked in writing. Any addition requires explicit reopening of the priority stack with cuts to compensate.
2. **The "survives 50% cut" priority stack in `PROJECT.md`** is the contract. Anything not in P0/P1 doesn't ship in v1. Anything in P2 is explicitly cuttable.
3. **"Roadmap doc" for v2.** When an invitee asks for perps, the answer is "logged for v2; here's the v2 roadmap link" not "interesting, let me think." Public roadmap = pressure release valve.
4. **Founder commits to scope review cadence.** Weekly check: "Did anything not in the priority stack get committed this week?" If yes, revert or formally cut something else.

**Warning signs:**
- New PRs adding modules not in `STATE.md`'s files-to-create map.
- New Discord channels for non-v1 categories (e.g., `#perps-discussion`).
- Slippage-model calibration gate slipping past week 12.

**Phase mapping:** Phase 0 (scope-lock document), every phase (scope-review weekly), Phase 4 (refuse-to-creep operator discipline).

---

### Pitfall 4.8: Off-VM secrets and key management
**Severity:** P1
**Confidence in mitigation:** High

**What goes wrong:** Indexer needs an RPC key, oracle subscription keys, Discord bot token, Postgres password. They live on the single VM. VM is compromised or operator's laptop is. Beta dashboard tampered with; worst case, leaderboard data corrupted on-chain trust loss.

**Prevention strategy:**
1. **Secrets in a managed store** (Doppler, 1Password CLI, or even a per-VM `systemd-creds` setup). Not in `.env` files committed to anywhere.
2. **Admin/upgrade caps in a multisig** (Sui `MultiSigAuthority`, Solana Squads or similar). Operator alone cannot push a contract upgrade.
3. **Quarterly key rotation drill** before any production-token-or-capital touch (v2). For v1, document the rotation path; rotating in v1 is optional.

**Phase mapping:** Phase 0 (secrets-management scaffolding + multisig setup for upgrade caps).

---

### Pitfall 4.9: Timezone/cohort-event blindness
**Severity:** P2
**Confidence in mitigation:** High

**What goes wrong:** Beta cohort is global (Africa, SEA, LatAm per `PROJECT.md`). Daily-loss / daily-DD rules use a single timezone for "day" boundaries. SEA trader's "trading day" rolls over at an awkward time. They breach DD during what feels to them like the middle of a session.

**Prevention strategy:**
1. **Per-trader "day" anchor.** Vault stores `day_anchor_utc_offset` chosen at trader signup. Daily rule resets on that anchor.
2. Default: UTC if not chosen, with a one-time prompt at first evaluation start: "What time should your trading day reset? You can pick once, then it's locked for the evaluation."
3. Surface the anchor in the dashboard ("Your trading day resets in X hours").

**Phase mapping:** Phase 1 (SC — vault stores per-trader day anchor), Phase 3 (frontend — anchor selection at signup).

---

## Phase-Specific Warnings Summary

| Phase | Topic | Likely Pitfall | Severity | Mitigation Reference |
|-------|-------|----------------|----------|----------------------|
| Phase 0 (scaffolding) | Toolchain pinning | Anchor/Move version drift | P2 | 2.10 |
| Phase 0 | Schema source of truth | Cross-chain event drift | P0 | 2.11 |
| Phase 0 | Secrets/multisig | Key compromise / unilateral upgrade | P1 | 4.8 |
| Phase 0 | Scope lock | Feature creep | P0 | 4.7 |
| Phase 1 (Sui SC) | Vault ownership model | Shared-object contention | P0 | 2.1 |
| Phase 1 | Capability/witness abilities | Privilege escalation | P1 | 2.2 |
| Phase 1 | Upgrade-compat CI gate | Package upgrade breakage | P0 | 2.3 |
| Phase 1 | Dynamic-field key types | DF collision | P1 | 2.4 |
| Phase 1 | Fixed-point math + fuzz | Precision exploit (Cetus-class) | P0 | 2.5 |
| Phase 1 | Operator capability split | Override creep | P0 | 4.1 |
| Phase 1 | On-chain SlippageConfig + version | Determinism break + mid-beta recalibration | P0 | 1.7, 3.6 |
| Phase 1 | Rate-limit + intent cap | HFT free edge | P1 | 1.5 |
| Phase 1 (Anchor) | Account constraints checklist | Sealevel-class account confusion | P0 | 2.6 |
| Phase 1 (Anchor) | PDA seed discriminators | Seed collision | P1 | 2.7 |
| Phase 1 (Anchor) | Vault sizing + rent | Resize trap | P1 | 2.8 |
| Phase 1 (Anchor) | CPI signer minimization | Privilege escalation | P0 | 2.9 |
| Phase 2 (BE) | Shadow live-quote logger | Generous slippage | P0 | 1.1 |
| Phase 2 | Latency model with noise | HFT free edge / latency absence | P1 | 1.2, 1.5 |
| Phase 2 | Forward-test gate (7 days) | Backtest ≠ forward test | P0 | 1.6 |
| Phase 2 | Indexer cursor + lag metric | Stale dashboard | P1 | 4.3 |
| Phase 2 | Sybil clustering job | Multi-wallet farming | P1 | 3.1 |
| Phase 2 | Calibration daily job + alert | Calibration drift | P0 | 4.2 |
| Phase 2 | Cross-chain parity diff | Parity rot | P1 | 4.4 |
| Phase 3 (frontend) | Wallet matrix test | Connect-flow cliff | P1 | 4.5 |
| Phase 3 | SBT disclaimer copy everywhere | Promise inflation | P0 | 3.4 |
| Phase 3 | Pseudonymous handles + multi-leaderboard | Mid-tier demoralization | P1 | 3.5 |
| Phase 3 | Failure debrief UI | Bottom-quartile attrition | P1 | 3.3 |
| Phase 3 | Admin dashboard read-only for vaults | Override creep | P0 | 4.1 |
| Phase 3 | Stale-feed pause UX | Oracle staleness comms | P0 | 1.3 |
| Phase 4 (beta hardening) | Forward-test gate must pass | Live divergence | P0 | 1.6 |
| Phase 4 | Backup + restore drill | Indexer SPOF | P1 | 4.3 |
| Phase 4 | Model changelog discipline | Mid-beta recalibration | P0 | 3.6 |
| Phase 4 | External audit of fill math | Cetus-class precision | P0 | 2.5 |
| Phase 4 | Operator playbook + language canon | Promise inflation + override creep | P0 | 3.4, 4.1 |
| Phase 4 | Test cohort dry-run | Wallet-adapter / UX cliff | P1 | 4.5 |
| Phase 4 | Linear-shadow + weekly status | Discord-support breakdown | P1 | 4.6 |
| Phase 4 | Weekly scope-review | Feature creep | P0 | 4.7 |

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|-----------|--------|
| Anchor account-validation pitfalls (Sealevel Attacks) | High | Patterns are well-documented in the public Coral / Anchor ecosystem; SC engineer can verify against the canonical Sealevel Attacks repo |
| Sui Move pattern misuse | Medium-High | Documented in Sui's own ecosystem; specific upgrade-compatibility rules evolve per Sui release |
| Cetus 2025 incident specifics | Medium | Incident widely reported through 2025; specific Move-level root cause should be verified by SC engineer against the public post-mortem |
| Pyth/Switchboard staleness thresholds | Medium | Pyth docs recommend the pattern; exact numeric thresholds are conventions, not standards — BE engineer to verify against current Pyth on-Sui and on-Solana docs |
| Hyperliquid/Drift retention-mechanic specifics | Low | Public retrospectives are sparse; recommendations here are derived from general engagement-loop patterns, not specific public numbers |
| Operator-override discipline | High | The mitigation is structural (no override capability exists in the contract); discipline can be enforced by code, not just policy |
| Slippage-model fidelity techniques (shadow-quote, forward-test gate) | High | Standard quant-trading validation practice adapted to the on-chain setting |
| Cross-chain event-schema codegen | High | Mechanical: a single schema + codegen + CI parity gate is a solved-problem pattern |
| Wallet-adapter UX edge cases | Medium | Specific failure modes vary by wallet version; only a real test matrix surfaces them |

---

## Open Questions

These need resolution during Phase 0 / Phase 1 setup; the pitfalls above assume answers will arrive but they are not yet decided:

1. **Will the team commission a Phase 4 audit of the fill/slippage math?** Cost and timing TBD; Pitfall 2.5 assumes yes.
2. **Is Linear (or equivalent) committed as the v1 ticket tool**, or does the team want to stay Discord+Notion-only? Pitfall 4.6 assumes the former.
3. **Multisig provider choice for upgrade caps** on both chains (Sui MultiSigAuthority? Solana Squads?). Pitfall 4.8 assumes multisig from day 1.
4. **Pyth/Switchboard staleness thresholds**: 5s/10s are conventions; the team should set definitive values after a Phase 1 review of current Pyth on-Sui (Wormhole-bridged) latency characteristics.
5. **Live shadow-quote source on Sui**: Cetus and Aftermath are candidates; Pitfall 1.1 assumes one is chosen by Phase 2 start.
6. **Per-trader timezone anchor in v1** (Pitfall 4.9) — is this in scope, or is "UTC for everyone" acceptable for closed beta? Recommended in scope; final call needed.
7. **Behavioral Sybil-detection thresholds** (Pitfall 3.1): operator review only, or any automated action? Recommended: review only in v1.

---

## Sources

Direct verification via WebFetch / WebSearch was blocked in this research environment. The following are the sources downstream phases should consult to verify the historical incident claims and current best-practice citations marked Medium confidence above:

- Cetus Sui exploit (May 2025) post-mortem: rekt.news / Cetus official blog (to be verified by SC engineer in Phase 1)
- Sealevel Attacks (canonical Anchor vulnerability catalog): github.com/coral-xyz/sealevel-attacks (to be referenced by SC engineer during Anchor port)
- Sui Move patterns documentation: docs.sui.io/concepts/sui-move-concepts/patterns
- Sui package upgrade compatibility: docs.sui.io/concepts/sui-move-concepts/packages/upgrade
- Pyth Network best practices: docs.pyth.network/price-feeds/best-practices
- Switchboard On-Demand docs: docs.switchboard.xyz
- Solana slot timing: docs.solana.com / agave validator docs
- Anchor security checklist: book.anchor-lang.com (current Anchor version)
- Wormhole-bridged Pyth on Sui latency characteristics: Pyth Sui integration docs

Phase 1 SC engineer is the right owner to fetch and verify each above before scaffolding begins.
