# Architecture Patterns

**Domain:** Two-chain (Sui Move + Solana Anchor) paper-trading evaluation platform with on-chain rule enforcement, calibrated slippage modeling, SBT tier ladder, leaderboard, and real-time dashboards.
**Researched:** 2026-05-14
**Sources:** Project context (PROJECT.md, STATE.md) + Claude's training-data knowledge of Sui Move (Sui framework ~1.x), Anchor (~0.30/0.31), Pyth, and Switchboard ecosystems. WebSearch and WebFetch were unavailable during this run, so external 2026-current docs could not be cross-checked. Specific version numbers and recently-introduced APIs (e.g., Sui Move 2024 edition features, Anchor 0.31+ realloc semantics) are flagged with confidence levels rather than asserted as fact.

---

## Executive Summary

The architecture has three concentric rings:

```
[ Ring 1: On-chain (Sui + Solana) ]   - source of truth for every pass/fail
        |
        | events (canonical schema)
        v
[ Ring 2: Indexer + Postgres/Timescale ] - durable mirror of ring 1
        |
        | WebSocket + REST
        v
[ Ring 3: Trader app + Admin app ]    - view layer, never authoritative
```

Two chains, one event schema, one indexer, one read API, two view apps.

The single hardest architectural invariant: **every pass/fail decision must be reproducible from on-chain data alone**. This forces (a) the slippage model to run on-chain (or commit its inputs on-chain), (b) the oracle read to be inside the same transaction as the state mutation, and (c) the indexer to be a strict mirror with no business logic that affects outcomes.

---

## Section 1 — Smart Contract Decomposition

### Sui Move modules (`contracts/sui/sources/`)

| Module | Owns (state) | Emits (events) | Access control |
|--------|--------------|----------------|----------------|
| `evaluation_vault` | `EvaluationVault` object per (trader, tier, attempt): `balance_micro`, `equity_micro`, `peak_equity_micro`, `daily_loss_anchor_micro`, `daily_loss_anchor_epoch`, `realized_pnl_micro`, `unrealized_pnl_micro`, `open_positions: VecMap<Symbol, Position>`, `status: u8` (Active / Passed / Failed / Halted), `tier_id: u8`, `attempt_nonce: u64`, `trader: address`, `started_at_ms: u64`, `last_trade_ms: u64`. | `TradeIntentSubmitted`, `TradeExecuted`, `PositionOpened`, `PositionClosed`, `EquityUpdated`, `RuleViolated`, `EvaluationPassed`, `EvaluationFailed`, `EvaluationHalted`. | `entry fun submit_intent` requires `&signer == vault.trader`. Admin paths (`halt`, `unhalt`) gated by `AdminCap` resource. |
| `oracle_adapter` | No persistent state; a thin wrapper over Pyth `PriceInfoObject` and Switchboard `Aggregator`. | `OracleStale`, `OracleDivergence` (only when used as halt path). | Public read; staleness threshold is a module constant (e.g. `MAX_STALENESS_MS = 10_000`). |
| `slippage_model` | No persistent state. Pure functions: `quote_fill(symbol, side, size_micro, oracle_px_micro, depth_param_micro, spread_bps) -> FillQuote { fill_px_micro, slippage_bps, fee_micro }`. | None. | `public(friend)` to `evaluation_vault`; not callable directly by traders. |
| `tier_config` | `TierRegistry` shared object containing `vector<TierParams>` where `TierParams { tier_id, profit_target_bps, max_drawdown_bps, daily_loss_bps, shadow_allocation_micro, max_position_count, allowed_symbols: vector<Symbol> }`. | `TierUpdated`. | Mutations gated by `AdminCap`. Readable by anyone. |
| `registry` | `EvaluationRegistry` shared object: `allowlist: Table<address, AllowlistEntry>`, `current_attempts: Table<address, ID>`, `attempt_counter: u64`. Factory function `open_evaluation(tier_id, &mut TierRegistry, &mut EvaluationRegistry, ctx)` that mints an `EvaluationVault` object owned by the trader. | `EvaluationOpened`, `AllowlistAdded`, `AllowlistRemoved`. | Allowlist mutations gated by `AdminCap`. Open path requires caller to be in allowlist + not have an active attempt at that tier. |
| `cohort_sbt` | `CohortSBT` object owned by the trader's address. Fields: `highest_tier: u8`, `total_passes: u32`, `total_shadow_pnl_micro: i128`, `total_trades: u32`, `last_active_at_ms: u64`. Non-transferable: no public transfer entry; only `public(friend) fun level_up` callable from `evaluation_vault`. | `SBTMinted`, `SBTLeveled`. | Friend-only mutation. SBT object holds no `store` ability (or holds it but the module exposes no transfer) — pick one canonical pattern per Sui Move conventions. **MEDIUM confidence**: Sui's idiomatic non-transferable token uses `key` without `store` so the object can't be moved off the address; verify against current `sui::object` docs. |
| `admin` | `AdminCap` (key-only resource), `PauseState` shared object with `paused: bool`, `paused_modules: vector<u8>`. | `Paused`, `Unpaused`, `AdminTransferred`. | `AdminCap` is single-holder; bootstrapping mints one to the deployer. |
| `leaderboard` | **Off-chain.** No on-chain module. The indexer computes leaderboard rankings from event history. (Materializing on-chain would force every trader's pass to write to a hot shared object, serializing all evaluations through one consensus path — unacceptable for Sui throughput.) | N/A | N/A |

### Solana Anchor programs (`contracts/solana/programs/`)

| Program | Account types (PDAs) | Events (Anchor `emit!`) | Access control |
|---------|----------------------|--------------------------|----------------|
| `evaluation_vault` | `EvaluationVault` PDA seeds `[b"vault", trader.key().as_ref(), &[tier_id], &attempt_nonce.to_le_bytes()]`. Same fields as Sui's `EvaluationVault`. `TradeLogPage` PDAs seeded `[b"log", vault.key().as_ref(), &page_idx.to_le_bytes()]` (see §2 for sizing). | Same names as Sui events. | `submit_intent` requires `trader.key() == vault.trader`. Admin via PDA `AdminConfig` storing admin pubkey + multisig optional. |
| `oracle_adapter` | No persistent accounts; uses Pyth `PriceUpdateV2` account passed in remaining_accounts. | Same. | Public read. |
| `slippage_model` | None — implemented as a Rust module compiled into the `evaluation_vault` crate (Anchor doesn't have `friend` modules; the cleanest path is in-crate, not a separate program with CPI). | None. | Internal. |
| `tier_config` | `TierRegistry` PDA seeded `[b"tiers"]` storing `Vec<TierParams>` (bounded). | Same. | Admin signer check. |
| `registry` | `Allowlist` PDA seeded `[b"allowlist"]` (single account) OR per-trader `AllowlistEntry` PDA seeded `[b"allow", trader.key().as_ref()]` (preferred — avoids contention on a single hot account). `AttemptCounter` PDA seeded `[b"counter", trader.key().as_ref(), &[tier_id]]`. | Same. | Admin. |
| `cohort_sbt` | `CohortSBT` PDA seeded `[b"sbt", trader.key().as_ref()]`. Non-transferable: program owns the account, never closes or reassigns it; no instruction to transfer authority. Same fields as Sui. | Same. | CPI from `evaluation_vault` on pass; otherwise read-only. |
| `admin` | `AdminConfig` PDA seeded `[b"admin"]`: `admin: Pubkey`, `pending_admin: Option<Pubkey>`, `paused: bool`. | Same. | Signer == `admin.admin`. |

**Rationale for the decomposition:**
- The vault is the *only* mutator of the trader's evaluation state, so it cleanly co-locates rule enforcement with state changes. No "outer keeper" can desync.
- Oracle + slippage are pure (no persistent state) so they're hot-swappable and unit-testable in isolation.
- Tier config is shared/readable so the vault can validate "you opened a Starter, you can only trade Starter-allowed symbols at Starter-allowed sizes" inside the same tx.
- Registry as a thin allowlist + factory is intentional: it does NOT hold per-trader balances — those live inside each per-trader vault object/PDA. This avoids a hot shared object on Sui and avoids account-size pressure on Solana.
- Leaderboard off-chain is a deliberate boundary call: ranking is a view-layer concern, and putting it on-chain creates a global-write hotspot that degrades the vault path. Indexer recomputes from events.

**Confidence: HIGH** for the decomposition shape. **MEDIUM** for the exact friend-module syntax on Sui and `emit!` macro patterns in Anchor (these are ecosystem-standard but specific API names may have shifted in 2026).

---

## Section 2 — Sui Object Model vs Solana Account Model

### The same logical concept, two physical realizations

| Concept | Sui realization | Solana realization |
|---------|-----------------|---------------------|
| Per-trader evaluation state | `EvaluationVault` is a Move object with `key`, owned by the trader's address. Direct ownership; trader signs and passes the object by ID into `submit_intent`. | `EvaluationVault` PDA owned by the `evaluation_vault` program. Trader signs the transaction; program checks `vault.trader == ctx.accounts.trader.key()`. PDA seeds `[b"vault", trader, tier_id, nonce]`. |
| Shared, read-only config | `TierRegistry` as a shared object (mutated via `&mut TierRegistry` from admin path only). | `TierRegistry` PDA, single account, mutated by admin instruction. |
| Allowlist | Shared `EvaluationRegistry` with `Table<address, AllowlistEntry>` — dynamic field reads scale per-entry. | Per-trader `AllowlistEntry` PDA — avoids one giant allowlist account. |
| SBT (non-transferable) | Object with `key` ability, no `store`, so it cannot be moved out of the address. Mutated via `public(friend)` from vault. | PDA owned by `cohort_sbt` program; no instruction exposes account close or owner reassignment. |
| "Address" | Sui address = 32-byte BLAKE2b-256 of public key. | Solana pubkey = 32-byte ed25519 (or PDA via SHA256). |
| txid | 32-byte digest of TransactionEffects. | 64-byte ed25519 signature (canonically base58-encoded). |
| Atomicity | Programmable Transaction Block — multiple Move calls in one tx, all-or-nothing. | Single transaction containing instruction list, all-or-nothing. Max ~1232 bytes per transaction including signatures and account list. |

### Transaction-semantics differences that affect the design

1. **Sui's owned-object fast path vs Solana's serialized-by-write-locks model.** Sui can run `submit_intent` against an owned `EvaluationVault` *without consensus* (fast path), because no other tx can touch that object — owned-object txs are serialized only by the owner. This is a big latency win for the trader (sub-second finality typical). Solana serializes by write-lock per account; the vault PDA is written every trade, but it's per-trader so contention is naturally sharded. **HIGH confidence** (Sui fast path is documented behavior); concrete latency numbers are MEDIUM confidence.

2. **Shared-object contention on Sui matters.** The `TierRegistry` and `EvaluationRegistry` are shared and therefore go through consensus. We mitigate by (a) only mutating them on rare admin paths, (b) reading them via `&TierRegistry` (immutable reference) in the `submit_intent` hot path, which on Sui still requires consensus scheduling for the shared object but is the canonical pattern. **MEDIUM confidence** — there is ongoing work in Sui around "consensus-less" shared reads; do not assume the optimization exists at v1 launch.

3. **Solana account-size limit.** A single account is bounded (10 MiB hard cap, but practically smaller because rent-exempt minimum balance grows with size and runtime CPU constraints make larger accounts expensive to deserialize). An evaluation may accumulate thousands of trades — storing them all inline in `EvaluationVault` will blow the budget. Solution: **store rule-relevant aggregates inline; spill the trade log to paginated `TradeLogPage` PDAs.** The vault keeps `balance`, `equity`, `peak`, `daily_loss_anchor`, `open_positions` (bounded — cap at e.g. 8 concurrent positions per evaluation), and `trade_count`. Each trade appends to the current `TradeLogPage` (e.g., 64 trades per page); when full, the program initializes the next page. This keeps the hot vault small and bounded.

4. **Sui has no account-size pressure of the same kind.** Move objects can grow, and `VecMap`/`Table` dynamic fields scale gracefully. Trade log can live inside the vault as a `vector<TradeRecord>` or as dynamic fields under the vault object. Recommended: dynamic fields keyed by `trade_seq: u64` so a single trade-detail read doesn't deserialize the whole log. **MEDIUM confidence** on dynamic-field cost characteristics.

5. **Signing semantics.** Sui: trader signs a `TransactionData` that names the gas object, the function, and the inputs (including the owned vault by ID). The transaction can only be authorized by the address that owns the vault. Solana: trader signs the transaction; the program enforces `trader.is_signer && trader.key == vault.trader`. Equivalent guarantee, different mechanism.

6. **PDA derivation must be deterministic and reversible from the indexer's perspective.** Recommend seed convention: `[b"vault", trader_pubkey, &[tier_id], &attempt_nonce.to_le_bytes()]`. `attempt_nonce` is per-(trader, tier) and stored in `AttemptCounter` PDA, incremented on each new evaluation. This lets the indexer reconstruct "which evaluation does this event belong to" purely from the PDA address present in the event log.

### Keeping events cross-chain compatible

Both chains emit logically identical events. The canonical event schema (single source of truth in `packages/shared/events/`) defines:

```jsonc
// TradeExecuted v1
{
  "schema": "TradeExecuted",
  "schema_version": 1,
  "chain": "sui" | "solana",
  "chain_tx": "<canonical-tx-id-string>",        // Sui: tx digest base58; Solana: tx signature base58
  "chain_block_ms": 1715000000000,               // Sui: checkpoint timestamp; Solana: block time * 1000
  "vault_id": "<sui-object-id | solana-pda-pubkey>",
  "trader": "<address>",                          // base58 on both; addresses are 32 bytes both chains
  "tier_id": 1,
  "attempt_nonce": 7,
  "trade_seq": 142,                               // monotonic per vault
  "symbol": "SOL/USD",
  "side": "buy" | "sell",
  "size_micro": "5000000",                        // string for >53-bit safety
  "intent_px_micro": "150250000",
  "oracle_px_micro": "150240000",
  "oracle_conf_micro": "20000",
  "oracle_publish_ms": 1715000000000,
  "fill_px_micro": "150310000",
  "slippage_bps": 4,
  "fee_micro": "5000",
  "equity_after_micro": "10050000000",
  "peak_after_micro": "10100000000",
  "drawdown_bps_after": 50
}
```

Both Sui and Solana emit events that carry exactly these fields (with chain-specific encoding for `chain_tx`, `vault_id`, `trader`). The indexer's normalizer is a tiny shim that maps the on-chain event representation into the canonical JSON; **no semantic logic** lives in the normalizer.

**Codegen recommendation:** define the schema in TypeScript Zod or JSON Schema in `packages/shared/events/`. Generate Move structs and Anchor structs (or at least lint-check them) against the schema. **MEDIUM confidence** on codegen tooling maturity for Move; may end up as a manual cross-check.

**Failure mode:** schema drift between chains is the single highest silent-failure risk. Mitigation: a CI check that diffs the Move event struct field names/types and the Anchor event struct field names/types against the shared schema JSON.

---

## Section 3 — Cross-Chain Abstraction Layer

### Recommendation: **two thin chain-specific adapters that converge at the indexer, with a unified canonical-event schema as the seam.**

Rejected alternative: a unified `IBlockchainClient` interface that hides chain differences from the entire backend. This sounds clean but leaks abstractions because Sui's tx model (PTB) and Solana's tx model (single tx with instructions) diverge enough that any unified shim becomes a lowest-common-denominator API — losing Sui's batched PTB capability and Solana's lookup tables. The cost of the abstraction exceeds the benefit at v1 scale (two chains, single indexer team).

### Topology

```
+------------------+     +----------------------+
| Sui RPC WS       |---->| sui-adapter          |--+
| (events stream)  |     | (decode Move events) |  |
+------------------+     +----------------------+  |
                                                   v
+------------------+     +----------------------+  +-->[Canonical Event Bus]-->[Indexer core]-->[Postgres/Timescale]
| Solana RPC WS    |---->| solana-adapter       |--+
| (logs/events)    |     | (decode Anchor evts) |
+------------------+     +----------------------+
```

- Each adapter owns: connection management, cursor/checkpoint tracking, event decoding, normalization into the canonical schema, retry on RPC failure.
- Adapters are stateless except for cursor (last processed Sui checkpoint sequence number / last processed Solana slot).
- Cursors persist in Postgres so the indexer can resume after a crash without re-ingesting (idempotent inserts on `(chain, chain_tx, trade_seq)` unique constraint anyway).

### Normalization rules

| Field | Sui source | Solana source | Canonical form |
|-------|-----------|----------------|----------------|
| `chain_tx` | Tx digest as base58 string | Tx signature as base58 string | string |
| `chain_block_ms` | Checkpoint `timestamp_ms` | `blockTime * 1000` (Solana returns seconds) | uint64 ms |
| `vault_id` | Object ID as 0x-prefixed hex | PDA pubkey as base58 | string (DO NOT try to unify format — keep chain-native; indexer column is `vault_id TEXT` and queries are `WHERE chain = ? AND vault_id = ?`) |
| `trader` | Address as 0x-prefixed hex | Pubkey as base58 | string (chain-native) |
| `size_micro` etc. | u128 → string | u128 → string | string-encoded integer |

**Critical:** do NOT try to make `vault_id` or `trader` chain-agnostic by hashing them or otherwise normalizing. Always carry `chain` as a discriminator column. The trader's wallet on Sui and their wallet on Solana are different keys and should appear as different rows in the leaderboard if the same human registered on both. (Out of scope for v1: linking the two via signed proof. Acceptable for v1.)

**Where normalization happens:** in the adapter, before write to Postgres. The view layer (API + dashboard) sees only canonical schema. The frontend never decodes raw chain events.

**Confidence: HIGH** on the two-adapter-converging-at-indexer pattern; **MEDIUM** on the specific Sui WS event-subscription semantics in 2026 (Sui has moved through several event-API revisions; verify `suix_subscribeEvent` is still the recommended path or whether the indexer should poll checkpoints via `sui_getCheckpoints` — both work, the checkpoint-based path is more reliable for replay).

---

## Section 4 — Backend Topology

### Recommendation: **modular monolith.** Single Node.js (TypeScript) process at `services/indexer/`, with internal module boundaries strict enough that any module can be extracted to a separate service later without rewrite.

Why not microservices: 1-person backend team, closed beta scale (~100 traders), single VM per `PROJECT.md`. Microservices buy operational pain we cannot afford. Why not a flat monolith: schema drift and indexer-business-logic coupling are real risks; module boundaries inside the process are the cheap insurance.

### Internal modules (all in one process, separate folders)

| Module | Responsibility | Public interface | Consumes | Produces |
|--------|---------------|------------------|----------|----------|
| `price-feed` | Subscribe to Pyth Hermes SSE/WS for chosen feed IDs; also Switchboard fallback. Maintain in-memory latest-price ring buffer with `(symbol, px, conf, publish_ms, source)`. Mark stale if `now - publish_ms > 5s`. | `getLatest(symbol): PriceTick`, `subscribe(symbol, cb)`. | Pyth Hermes, Switchboard. | In-memory ticks; `prices_ticks` table (Timescale hypertable) for backtest/calibration. |
| `slippage-calibrator` | Periodic (off-line) job that reads historical mainnet swap data (from external source — Jupiter API for Solana, DEX-aggregator API for Sui) and fits spread/depth parameters per symbol. Writes to `slippage_params` table. The on-chain `slippage_model` reads these parameters via `tier_config` admin updates (operator pushes a new param set). | `runCalibration(symbol, lookback_days)`, `latestParams(symbol)`. | Historical swap data, prices_ticks. | `slippage_params` table; operator alerts on param drift. |
| `chain-adapters/sui` | Sui RPC WS / checkpoint poller; decode Move events; normalize to canonical schema. | `start()`, `cursor()`. | Sui fullnode. | Canonical events to `event-bus`. |
| `chain-adapters/solana` | Solana RPC WS / `getSignaturesForAddress` poller; decode Anchor events from tx logs; normalize. | `start()`, `cursor()`. | Solana RPC. | Canonical events to `event-bus`. |
| `event-bus` | In-process EventEmitter / async queue routing canonical events to `db-writer`, `ws-fanout`, `leaderboard-builder`. | `emit(event)`, `subscribe(type, handler)`. | Adapters. | Fan-out. |
| `db-writer` | Idempotent upserts into Postgres + Timescale. Composite unique key `(chain, chain_tx, trade_seq)` for `trades`; `(chain, vault_id)` for `vaults`; etc. | `writeTrade(e)`, `writeEvaluation(e)`. | event-bus. | Postgres. |
| `leaderboard-builder` | On each pass/level event, recompute affected leaderboard rows (incremental). On boot, full recompute. Materialized in `leaderboard` table (small — N traders). | `rebuild()`, `update(trader)`. | event-bus, Postgres. | `leaderboard` table; WS broadcast. |
| `ws-fanout` | WebSocket server. Per-connection subscriptions: `vault:{id}` (private, requires wallet-signed challenge), `prices:{symbol}` (public), `leaderboard` (public). Pushes price ticks, equity updates, pass/fail events. | WS protocol. | event-bus, price-feed. | WS clients. |
| `api` | Read-only REST/HTTP. Routes: `GET /vault/:id`, `GET /trader/:address`, `GET /leaderboard`, `GET /tiers`, `GET /prices/latest`. | HTTP. | Postgres. | JSON. |
| `admin-api` | Mutations are off-chain only (e.g., write to operator audit log, send Discord webhooks). Any on-chain admin action (pause, allowlist) is constructed here as an unsigned tx and returned to the operator's wallet to sign. Backend never holds admin keys. | HTTP + auth. | Postgres, chain RPC (read). | Audit log; unsigned txs to operator. |

### Deployment topology for v1

Single VM (per PROJECT.md "Technical Notes"):
- 1 Node.js process running all modules (with `pm2` or `systemd` supervisor).
- Postgres 15 + TimescaleDB extension on the same VM.
- Nginx in front for TLS termination + WS upgrade.
- Backups: daily `pg_dump` to S3-compatible storage (or rsync to a second host).
- Monitoring: Discord webhook from a `health-check` cron + basic Prometheus node_exporter (optional).

### Boundary contracts

- `price-feed → consumers`: in-process `PriceTick` interface, no network hop.
- `chain-adapters → event-bus`: canonical event JSON shape, asserted at boundary by Zod schema.
- `event-bus → db-writer`: same canonical event, db-writer asserts idempotency.
- `api/ws-fanout → frontend`: documented OpenAPI + WS message catalog in `packages/shared/api/`.

### Failure semantics

| Module | Failure | Effect | Recovery |
|--------|---------|--------|----------|
| `price-feed` (Pyth) | Hermes WS drops | Switchboard fallback kicks in; if both down, mark `stale` and frontend shows "prices stale" banner; on-chain contract will revert intent on staleness regardless | Reconnect with exponential backoff |
| `chain-adapter` | RPC drops or falls behind | Indexer lags; dashboard shows stale data but on-chain state is unaffected; cursor lets it catch up | Persist cursor in DB; resume on restart |
| `db-writer` | Postgres down | Adapter buffers events in memory (bounded), then crashes | Restart process; cursor replays missed events |
| `ws-fanout` | Crash | Clients reconnect; price + equity republished on reconnect | Auto-reconnect logic in frontend |
| `slippage-calibrator` | Calibration job fails | Operator alerted via Discord; existing on-chain params remain | Manual rerun |
| Whole VM | Down | Total beta outage. On-chain state untouched. Indexer can fully rebuild from chain history. | Restore from backup or re-index from genesis; restore drill rehearsed before beta opens (per STATE.md risks) |

**Confidence: HIGH** on the modular-monolith call. **MEDIUM** on TimescaleDB-on-same-VM at expected v1 load (should be fine for 100 traders + price ticks at Pyth's update rate; verify with a load test before launch).

---

## Section 5 — Data Flow (One Trade, End-to-End)

```
T+0      [Trader UI]        Trader clicks "Buy 5 SOL"; UI assembles intent payload.
T+5ms    [Wallet]           Wallet prompt; trader signs.
T+50ms   [RPC submit]       Frontend posts tx to Sui/Solana RPC.

  ---- Chain execution boundary ----
T+~100ms (Sui owned-obj fast path) | T+~400ms (Solana slot)
        [On-chain]         submit_intent runs:
                           1. assert vault.status == Active
                           2. assert !paused
                           3. read Pyth PriceInfoObject (Sui) / PriceUpdateV2 (Solana)
                           4. assert oracle_publish_ms within MAX_STALENESS_MS (else revert)
                           5. read tier params from TierRegistry
                           6. call slippage_model::quote_fill(...)
                           7. assert fill_px within trader's slippage_tolerance (else revert)
                           8. mutate vault: balance, equity, peak, daily_loss
                           9. assert equity >= peak * (1 - max_drawdown_bps) (else status=Failed, emit Fail)
                          10. assert daily_loss_today <= daily_loss_bps (else Fail)
                          11. if equity >= start * (1 + profit_target_bps) → status=Passed, emit Pass
                          12. emit TradeExecuted event
                          13. if Pass: CPI/friend-call cohort_sbt::level_up

T+~500ms [Chain finality]   Tx finalized. Event in checkpoint/slot.

  ---- Indexer boundary ----
T+~600ms [chain-adapter]    Polls checkpoint / receives WS notification.
T+~620ms [chain-adapter]    Decodes event, normalizes to canonical schema.
T+~625ms [event-bus]        Emits to db-writer + ws-fanout + leaderboard-builder.
T+~650ms [db-writer]        INSERT into trades, UPDATE vault_state. Idempotent.
T+~660ms [ws-fanout]        Pushes TradeExecuted to subscribed dashboards.
T+~680ms [leaderboard]      If pass/level event: recompute affected rows, broadcast.

T+~700ms [Trader UI]        Receives WS, updates equity chart, P&L number, position list.
```

### Latency budget

| Step | Sui target | Solana target | Notes |
|------|-----------|---------------|-------|
| Wallet sign | 1-5s (human) | 1-5s | Out of our control |
| RPC submit → finality | 300-800ms (owned-obj fast path) | 400-800ms (slot time) | **HIGH confidence** Sui owned-obj fast path is sub-second; **MEDIUM** on exact numbers |
| Indexer ingest | ~100ms | ~100ms | Polling cadence: 200ms |
| DB write | <50ms | <50ms | Single-row inserts on local Postgres |
| WS push | <50ms | <50ms | Same VM |
| **Total chain-event-to-screen** | **~800ms-1.2s** | **~900ms-1.3s** | Under the "sub-second WS update" target in STATE.md "Constraints" — meets if Pyth feed is fresh |

### Atomicity vs eventual consistency

| Boundary | Property |
|----------|----------|
| Steps 1-13 (on-chain) | **Atomic.** All-or-nothing. Either the event is emitted and state is mutated, or neither happens. |
| Chain → indexer | **Eventually consistent.** Indexer can lag; the chain remains source of truth. |
| Indexer → WS clients | **Eventually consistent + best-effort.** Disconnected clients miss live events but resync on reconnect via REST snapshot + WS subscribe. |
| Leaderboard | **Eventually consistent.** Recomputed from events; can be fully rebuilt from on-chain history. |

### What happens if…

- **Oracle is stale:** Step 4 reverts. The trader gets a tx-failed signal; UI shows "Prices stale, retry in a moment." No state mutation. (**HIGH confidence** — this is the canonical Pyth pattern across both chains.)
- **Oracle is wrong (price way off):** Optional defense: in `oracle_adapter`, halt the vault if `|pyth_px - switchboard_px| > divergence_bps`. Trade reverts. Operator alerted via indexer (`OracleDivergence` event). **MEDIUM** confidence on the right threshold; calibrate during model fitting.
- **Indexer falls behind:** Dashboard lag; UI shows "syncing" badge. On-chain pass/fail is unaffected. Cursor replay catches up. SLO: indexer lag <5s p99.
- **Trader spams intents:** Each tx costs gas (Sui MIST / Solana lamports); allowlist + per-tier attempt limit constrain abuse. On-chain rate limit (`min_interval_ms` between trades per vault) as a defense-in-depth.
- **Slippage params change mid-evaluation:** Operator-set params are read by the on-chain `slippage_model` per-tx. Changing them affects future trades only. Emit a `TierUpdated` event so the indexer (and trader UI) can show the new params. Treat param changes as a *risk* — operator policy says they don't change mid-cohort except in emergency.
- **Solana account-size limit hit (trade log full):** Program initializes a new `TradeLogPage` PDA atomically within the same tx (using `init_if_needed` or explicit init by trader's payer). **MEDIUM confidence** — requires careful Anchor `init_if_needed` semantics; alternative is to require an explicit "open new page" tx before the page-boundary trade.

---

## Section 6 — Build Sequence (Component Order)

### Dependency graph (high-level)

```
[shared event schema]  <--- blocks every chain emitter and the indexer
        |
        +-- [Sui oracle_adapter] --+
        |                          |
        +-- [Sui tier_config] -----+--- [Sui evaluation_vault] --- [Sui cohort_sbt]
        |                          |          |
        +-- [Sui slippage_model] --+          |
                                              |
                                       [indexer adapters/sui]
                                              |
                                       [db schema + db-writer]
                                              |
                                       [api + ws-fanout]
                                              |
                                       [trader app v1]
                                              |
                                       [leaderboard]
                                              |
   (same chain build, ported)        [Solana port: oracle, tier, slippage, vault, sbt]
                                              |
                                       [indexer adapters/solana]
                                              |
                                       [admin app + calibration dashboard]
                                              |
                                       [internal testing → beta]
```

### Critical path (14-18 weeks, mapped to PROJECT.md timeline)

| Wk | SC engineer | BE engineer | Founder (FE/glue) |
|----|-------------|-------------|--------------------|
| 0 | Set up `contracts/sui/`, Move.toml, scaffolding | Set up `services/indexer/`, repo monorepo, shared schema seed | Set up `apps/trader/` Next.js shell, wallet adapter |
| 1 | `oracle_adapter` (Sui + Pyth read + staleness) | `price-feed` module (Pyth Hermes subscribe) | Trader UI wireframes; wallet connect both chains |
| 2 | `tier_config` + `registry` + `AdminCap` | DB schema design (Postgres + Timescale); `db-writer` skeleton | Tier picker UI, login screen |
| 3 | `slippage_model` pure module + unit tests | `slippage-calibrator` v0 — historical data ingest | — |
| 4 | `evaluation_vault::submit_intent` happy path | `chain-adapters/sui` event subscriber | Trade entry form |
| 5 | `evaluation_vault` rule enforcement (DD, daily-loss, target) | Canonical event normalizer + `event-bus` | Live equity chart |
| 6 | `cohort_sbt` (Sui) | `ws-fanout` skeleton; first end-to-end test: Sui trade → DB → WS → UI | Dashboard skeleton |
| 7 | Sui-side complete; freeze API; start Solana scaffolding | `leaderboard-builder` v0 | Leaderboard UI |
| 8 | Solana `evaluation_vault` PDA structure + `submit_intent` | `chain-adapters/solana` | Solana wallet integration |
| 9 | Solana rule enforcement | `slippage-calibrator` v1 — full 30-day backtest | Public profile pages |
| 10 | Solana `cohort_sbt` + `TradeLogPage` paging | `admin-api` skeleton (unsigned-tx pattern) | Admin app v0 |
| 11 | Solana finalize; cross-chain testing | Calibration dashboard | — |
| 12 | Bug-fix sprint | Bug-fix sprint | Polish |
| 13-14 | Internal testing both chains | Internal testing | Internal testing |
| 15-18 | Closed beta open + iterate | Closed beta open + iterate | Closed beta open + iterate |

### Parallelism opportunities

- **Wk 0-3:** BE can build price-feed and slippage-calibrator in parallel with SC scaffolding because they're entirely off-chain.
- **Wk 4-6:** Indexer adapter can be built against Sui devnet event mocks before the vault contract is feature-complete, as long as the event schema is frozen.
- **Wk 6-9:** Solana port (SC) runs parallel to leaderboard + ws-fanout (BE).
- **Wk 10-11:** Admin app, calibration dashboard, public-profile pages parallel.

### Unblockers (do these first or everything stalls)

1. **Event schema in `packages/shared/events/`** — wk 0-1. Without this, both chains can drift and the indexer can't be built.
2. **Sui oracle_adapter + Pyth feed IDs verified on Sui testnet** — wk 1. Blockers in STATE.md flagged this.
3. **DB schema** — wk 1-2. Adapters can't write until tables exist.
4. **Wallet adapter UX on both chains** — wk 0-2. Onboarding blocker per STATE.md risks.

### Phase boundaries (for the roadmap)

The natural phase boundaries are:
1. **Foundation:** repo scaffolding + event schema + wallet adapters + price-feed + DB schema (wk 0-2)
2. **Sui contract MVP:** oracle, tier, slippage, vault happy-path (wk 1-4)
3. **Sui rule enforcement + SBT:** vault rule enforcement + cohort_sbt + first end-to-end indexer flow (wk 4-7)
4. **Solana port:** Anchor parity build (wk 6-10)
5. **Engagement layer:** leaderboard + public profiles (wk 7-11)
6. **Calibration + admin:** model fitting + admin app (wk 9-12)
7. **Hardening + beta:** internal test → beta open (wk 12-18)

**Sub-tasks (not phase boundaries):** individual events, individual UI screens, specific tier params. These belong inside phases, not as phase headers.

**Confidence: HIGH** on the build-order shape; **MEDIUM** on exact week placement — depends on engineer ramp time and Pyth-testnet readiness.

---

## Section 7 — Patterns and Anti-Patterns

### Pattern: On-chain rule enforcement, off-chain view
**What:** All pass/fail/halt logic lives in the vault module. Indexer mirrors; never decides.
**When:** Every evaluation outcome.
**Why:** Success criterion "zero overrides; explicable from on-chain data alone."

### Pattern: Per-trader vault as the unit of write
**What:** Sui owned object / Solana per-trader PDA. No global shared mutable state in the hot path.
**When:** Trade ingestion.
**Why:** Scales linearly with trader count; no consensus contention on Sui.

### Pattern: Pure slippage model
**What:** `slippage_model` has no persistent state; takes oracle px + params + intent → fill quote.
**When:** Inside every trade.
**Why:** Determinism + testability. Params live in `tier_config`, not in the model.

### Pattern: Canonical event schema as the only cross-chain contract
**What:** One JSON schema; both chains emit conformant events; indexer reads conformant events.
**When:** Always.
**Why:** Schema drift is the silent killer of cross-chain parity.

### Pattern: Backend never holds admin keys
**What:** Admin API constructs unsigned txs; operator signs in their wallet.
**When:** Pause, unpause, allowlist mutation, param updates.
**Why:** Non-custodial posture; eliminates a class of compromise.

### Anti-pattern: On-chain leaderboard
**What:** Materializing leaderboard rankings as a shared on-chain object.
**Why bad:** Becomes a global write-hot-spot; every pass serializes through it (Sui consensus / Solana write-lock).
**Instead:** Off-chain, indexer-computed, view-only.

### Anti-pattern: Single unified blockchain-client abstraction
**What:** Hiding Sui and Solana behind one interface across the whole backend.
**Why bad:** Loses PTB + Solana-specific affordances; turns into lowest-common-denominator.
**Instead:** Two chain-specific adapters meeting at the canonical event schema.

### Anti-pattern: Off-chain rule enforcement
**What:** Indexer or backend deciding pass/fail.
**Why bad:** Trader cannot independently verify outcomes; operator override creep; success criterion violation.
**Instead:** Contracts enforce, indexer mirrors.

### Anti-pattern: Mutable SBT via "transfer in/transfer out"
**What:** Re-minting the SBT on every level-up by burning + minting.
**Why bad:** Loses the on-chain identity continuity that makes the SBT a credential.
**Instead:** In-place mutation by friend/CPI from vault; same object/account across levels.

### Anti-pattern: Storing the full trade log inline on Solana
**What:** Appending every trade into `EvaluationVault.trade_log: Vec<Trade>`.
**Why bad:** Hits account size + compute-unit limits during evaluations with many trades.
**Instead:** Paginated `TradeLogPage` PDAs; vault keeps only aggregates needed for rule checks.

---

## Section 8 — Scalability Considerations

| Concern | At 100 traders (v1 beta) | At 10K traders (v2 scale) | At 1M traders (long-term) |
|---------|--------------------------|----------------------------|----------------------------|
| Trade throughput | Trivial (<1 TPS aggregate) | ~10-50 TPS aggregate, well within both chains | Need per-shard indexer; per-region RPC; consider rollup-specific designs |
| Indexer | Single VM, single Postgres | Read replicas; partition prices_ticks per symbol; Timescale continuous aggregates | Multi-region indexer; Kafka between adapter and writer |
| WS fan-out | Single process | Dedicated WS service; sticky load-balancer | Pub-sub layer (Redis Streams / NATS) |
| Leaderboard | Full recompute on every event | Incremental update only | Sharded by region; materialized hourly |
| Oracle | Pyth/Switchboard direct read | Same; consider TWAPs to smooth | Custom aggregator + multiple feeds |

For v1, none of the 10K/1M concerns apply. They're documented so the boundaries chosen at v1 don't paint us into a corner.

---

## Section 9 — Open Items and Validation Required

These could not be verified during this research run because external docs were unavailable:

1. **Sui Move 2024 edition features** — specifically whether `public(friend)` is still the idiomatic name for the cohort_sbt mutation pathway or whether `package`-visibility has superseded it. LOW confidence on the exact keyword; HIGH confidence the pattern is supported.
2. **Pyth on Sui price-feed object stability** — STATE.md already flagged this as a blocker. The architecture assumes one `PriceInfoObject` per symbol with `pyth::price_info::get_price()`-style read; verify against current Pyth Sui SDK.
3. **Switchboard parity on both chains** — Switchboard has feeds on both, but the read API differs; the `oracle_adapter` must encapsulate both.
4. **Anchor `init_if_needed` for `TradeLogPage` rolling** — alternative is explicit init by an "open page" instruction in the same tx; the latter is more conservative.
5. **Solana SBT non-transferability mechanism** — STATE.md flagged this. Options: (a) program-owned PDA never exposed for transfer (cleanest, custom), (b) Token-2022 with `NonTransferable` extension (more standard, requires Metaplex/Token-2022 plumbing). Recommend (a) for simplicity in v1 and document migration to (b) for production.
6. **Sui event subscription vs checkpoint polling** — both work; checkpoint-based gives stronger replay guarantees. Pick one and document.

These items go into PITFALLS.md and STACK.md research outputs (companion files) for deeper validation in the clarify phase.

---

## Sources

- `/Users/gifted/Documents/repos/entrypoint/prop-firm/.claude/plans/Crypto-Native/PROJECT.md` — vision, tiers, success criteria, timeline.
- `/Users/gifted/Documents/repos/entrypoint/prop-firm/.claude/plans/Crypto-Native/STATE.md` — conventions to establish, files-to-create map, integration points, risks.
- Claude training-data knowledge of: Sui Move framework (~Sui 1.x), Anchor (~0.30/0.31), Pyth Network on Sui + Solana, Switchboard, TimescaleDB, common monorepo patterns. External 2026-current docs could not be fetched during this run — see "Open Items" for validation requirements.
