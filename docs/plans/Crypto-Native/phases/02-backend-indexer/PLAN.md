---
phase: 02-backend-indexer
type: execute
depends_on: ["00-foundation"]
files_modified:
  - services/risk-engine/src/
  - services/risk-engine/Cargo.toml
  - services/api-gateway/src/
  - services/api-gateway/package.json
  - infra/postgres/migrations/
  - .github/workflows/services.yml
autonomous: true
requirements: [REQ-01, REQ-08]
must_haves:
  truths:
    - "chain-adapter/sui ingests checkpoints from a paid Sui RPC and writes canonical events to Postgres+TimescaleDB."
    - "indexer can cold-replay from a stored cursor without losing or duplicating events."
    - "Pyth Hermes WS price ticks land in `price_ticks` hypertable continuously, with staleness alarm at >5s."
    - "Switchboard divergence check halts new evaluation entries when |pyth - switchboard| / mid > 50 bps."
    - "slippage-calibrator v0 emits `(sim_fill, live_aggregator_quote, delta_bps)` triples to a Postgres `shadow_quotes` table for every test trade."
    - "stalled-vault detector flags vaults with no activity in the last 6 days (1 day before inactivity threshold) for operator review."
    - "WS gateway pushes price + vault state updates to connected dashboard clients with <200ms p99 latency."
  artifacts:
    - "services/risk-engine/ (Rust binary)"
    - "services/api-gateway/ (TypeScript Hono service)"
    - "infra/postgres/migrations/*.sql"
  key_links:
    - from: "services/risk-engine/src/chain_adapters/sui.rs"
      to: "packages/shared/events/codegen/rust/lib.rs"
      type: "import"
    - from: "services/api-gateway/src/ws/fanout.ts"
      to: "services/risk-engine (Postgres LISTEN/NOTIFY channel)"
      type: "import"
---

<objective>
Stand up the off-chain backend: Sui chain adapter (checkpoint polling), Postgres+TimescaleDB writer, real-time price feed with divergence checking, slippage-calibrator v0, shadow-quote logger, WS fan-out gateway, and stalled-vault detector. The shadow-quote logger is the load-bearing data source for the 30-day backtest gate in Phase 6 (REQ-01). Cursor-based indexer replay is the load-bearing trust primitive for "the indexer is a mirror of on-chain truth, not a source of truth" (PITFALLS 4.3).
</objective>

<context>
@.claude/plans/Crypto-Native/PROJECT.md
@.claude/plans/Crypto-Native/STATE.md
@.claude/plans/Crypto-Native/ROADMAP.md
@.claude/plans/Crypto-Native/research/ARCHITECTURE.md
@.claude/plans/Crypto-Native/research/STACK.md
@packages/shared/events/codegen/rust/lib.rs
@packages/shared/slippage/src/lib.rs
</context>

<tasks>

<task type="auto" id="2.1" depends_on="">
  <name>Postgres schema + migrations (vaults, trade_events, price_ticks, equity_curves, shadow_quotes, indexer_cursor)</name>
  <files>
    infra/postgres/migrations/0001_baseline.sql
    infra/postgres/migrations/0002_shadow_quotes.sql
    infra/postgres/migrations/0003_indexer_cursor.sql
    services/risk-engine/src/db/schema.rs
  </files>
  <context>
    Why: REQ-08 — events from both chains land in identical canonical rows (`chain` discriminator). Hypertables for time-series columns enable the 30-day backtest queries in Phase 6.
    Pattern: STACK.md §5 + ARCHITECTURE.md §4 — TimescaleDB hypertables for `price_ticks`, `trade_events`, `equity_curves`; non-hypertable for `vaults`, `shadow_quotes`, `indexer_cursor`.
  </context>
  <action>
    1. `0001_baseline.sql`: `vaults` (vault_id, chain, trader, tier, opened_at, terminated_reason, slippage_config_version, last_seen_at); `trade_events` (hypertable on time); `price_ticks` (hypertable); `equity_curves` (hypertable); `operator_audit_log`.
    2. `0002_shadow_quotes.sql`: `(trade_event_id, sim_fill, live_quote, delta_bps, source_router, captured_at)` — hypertable on `captured_at`.
    3. `0003_indexer_cursor.sql`: `(chain, last_checkpoint, last_processed_at)` — one row per chain.
    4. Use `sqlx migrate add` to register migrations; `sqlx migrate run` applies. Embed schema mirror in `services/risk-engine/src/db/schema.rs` for compile-time checked queries.
    **Avoid:** schema-per-chain; nullable columns where defaults make sense; using JSONB for fields the indexer reads frequently.
  </action>
  <verify>sqlx migrate run --source infra/postgres/migrations; psql -c "\dt" shows 6 tables; psql -c "SELECT show_hypertables();" lists the 4 hypertables</verify>
  <done>
    - [ ] All 6 tables created
    - [ ] 4 hypertables registered with TimescaleDB
    - [ ] sqlx compile-time query check passes against schema
  </done>
  <rollback>sqlx migrate revert (each migration) ; git checkout -- infra/postgres/migrations</rollback>
</task>

<task type="auto" id="2.2" depends_on="2.1">
  <name>Sui chain adapter via checkpoint polling + event normalizer</name>
  <files>
    services/risk-engine/src/chain_adapters/sui.rs
    services/risk-engine/src/chain_adapters/mod.rs
    services/risk-engine/src/normalizer.rs
    services/risk-engine/src/db/writer.rs
  </files>
  <context>
    Why: REQ-08 — Sui events get normalized into canonical rows so the indexer schema is chain-agnostic. Checkpoint polling (per ARCHITECTURE.md open question #6, recommendation) gives stronger replay than `suix_subscribeEvent`.
    Pattern: cursor in `indexer_cursor.sui.last_checkpoint`; each iteration fetch `[cursor+1 .. cursor+N]` via Shinami RPC, filter events by our package ID, decode + normalize + write atomically with cursor update.
  </context>
  <action>
    1. Implement `SuiChainAdapter` struct with `start_polling(cancel: CancellationToken)` that loops every 500ms.
    2. Each iteration: read cursor; fetch up to 50 checkpoints; iterate events filtered by `package_id == OUR_PACKAGE`; decode each into the canonical event types from `packages/shared/events/codegen/rust`; call `normalizer::to_db_row`; write all rows + cursor advance in a single Postgres transaction.
    3. On error: log + back off; never advance cursor past unprocessed events.
    4. Expose a `lag_seconds` Prometheus metric (time since last successful checkpoint).
    **Avoid:** WebSocket subscriptions for the indexer (replay correctness is harder); skipping events that fail to decode (must fail-loud and halt cursor).
  </action>
  <verify>cargo test -p risk-engine chain_adapters::sui; manual: deploy contracts from Phase 1 to devnet, trigger an event, observe row in trade_events within 2s</verify>
  <done>
    - [ ] Adapter polls Shinami RPC; processes events; advances cursor atomically
    - [ ] Cold replay from cursor = 0 produces identical rows
    - [ ] `lag_seconds` metric exported
  </done>
  <rollback>git checkout -- services/risk-engine/src/chain_adapters/</rollback>
</task>

<task type="auto" id="2.3" depends_on="2.1">
  <name>Pyth Hermes WS price feed + Switchboard divergence halt</name>
  <files>
    services/risk-engine/src/price_feed.rs
    services/risk-engine/src/divergence.rs
  </files>
  <context>
    Why: REQ-01 — calibration depends on a high-frequency, freshness-tagged price stream. PITFALLS 1.3 — single-oracle failure requires Switchboard halt-on-divergence (>50 bps).
    Pattern: STACK.md §4 + Phase 0.6 proof-of-life extended into production-grade feed.
  </context>
  <action>
    1. Promote Phase 0 prototype to production: handle reconnect with exponential backoff; tag every tick with `received_at` and `publish_time`; reject ticks where `received_at - publish_time > 3s`.
    2. Persist every tick to `price_ticks` hypertable. Batch inserts in 100ms windows for throughput.
    3. Subscribe to Switchboard On-Demand for the same symbols; compute `|pyth - switchboard| / mid` per symbol every 5s; if > 50 bps, set in-memory `halt_new_entries = true` and emit Discord webhook alert.
    4. `registry::open_evaluation` proxy in the gateway reads this flag and rejects with `EOracleDivergence` when halted (contract-side halt requires a Phase 1 update if needed; for v1, gateway-side rejection is sufficient since gateway is the only entry-point in closed beta).
    **Avoid:** Chainlink fallback; tolerating stale ticks silently (must alarm).
  </action>
  <verify>simulate Switchboard divergence: docker stop the switchboard mock; verify halt flag flips and alert fires within 10s</verify>
  <done>
    - [ ] Pyth ticks landing in price_ticks at >1 Hz per symbol
    - [ ] Divergence halt verified end-to-end
    - [ ] Reconnect tolerates 30s outages without data loss
  </done>
  <rollback>git checkout -- services/risk-engine/src/price_feed.rs services/risk-engine/src/divergence.rs</rollback>
</task>

<task type="auto" id="2.4" depends_on="2.2,2.3">
  <name>Slippage-calibrator v0 + shadow-quote logger (via 7K Protocol aggregator)</name>
  <files>
    services/risk-engine/src/calibrator/mod.rs
    services/risk-engine/src/calibrator/shadow_quote.rs
    services/risk-engine/src/calibrator/aggregator_clients/k7.rs
  </files>
  <context>
    Why: REQ-01 — the 30-day backtest gate in Phase 6 reads from `shadow_quotes`. Clarify R1 selected 7K Protocol as the Sui shadow-quote source.
    Pattern: ARCHITECTURE.md §4 — for every `TradeFilled` event, query 7K Protocol's quote API for the same `(input_token, output_token, size, side)` at the same timestamp; store `(sim_fill, live_quote, delta_bps)`.
  </context>
  <action>
    1. Implement `K7Client` HTTP wrapper: `quote(input, output, size_in, side) -> live_price`. Cache 7K's quote for 500ms TTL to avoid hammering them.
    2. Subscribe to canonical `TradeFilled` event stream (Postgres LISTEN/NOTIFY); for each, call K7Client at the event's block timestamp (replay-friendly).
    3. Compute `delta_bps = (sim_fill - live_quote) / live_quote * 10000`; store in `shadow_quotes`.
    4. Expose `GET /calibration/residuals?window=1h&symbol=SOL` returning median + p95 of delta_bps. Used by Phase 6 dashboard.
    **Avoid:** querying 7K once per second regardless of trade volume (rate limits); writing residuals before the canonical `TradeFilled` lands (race condition).
  </action>
  <verify>seed 100 synthetic TradeFilled events; verify 100 rows in shadow_quotes with valid delta_bps; assert median |delta_bps| < 15 for normal cases</verify>
  <done>
    - [ ] 7K client integrated with rate-limit + cache
    - [ ] Every TradeFilled produces a shadow_quotes row
    - [ ] Residuals API returns median + p95 per symbol per window
  </done>
  <rollback>git checkout -- services/risk-engine/src/calibrator/</rollback>
</task>

<task type="auto" id="2.5" depends_on="2.2">
  <name>API gateway WS fan-out + stalled-vault detector</name>
  <files>
    services/api-gateway/src/ws/fanout.ts
    services/api-gateway/src/routes/vault.ts
    services/api-gateway/src/routes/leaderboard.ts
    services/api-gateway/src/jobs/stalled_vault.ts
    services/api-gateway/package.json
  </files>
  <context>
    Why: REQ-04 (engagement loop UI needs real-time updates) + Clarify R3 (Inactive timeout — stalled vaults need operator-visible monitoring).
    Pattern: STACK.md §2 — Hono service subscribes to Postgres LISTEN/NOTIFY channels written by the risk-engine; broadcasts to WS clients via `partysocket`-compatible protocol; TanStack Query cache absorbs on client side.
  </context>
  <action>
    1. Hono server with `/ws` endpoint; client connects, subscribes to channels: `vault:<vault_id>`, `price:<symbol>`, `leaderboard`.
    2. Risk-engine writes Postgres notifications on canonical event commit; gateway forwards filtered messages to subscribed clients.
    3. `jobs/stalled_vault.ts` runs every 1h: query vaults where `terminated_reason IS NULL AND last_seen_at < now() - interval '6 days'` → emit Discord webhook to operator channel ("Vault X stalled — 6 days inactive; 1 day until auto-terminate").
    4. REST endpoints: `GET /vault/:id`, `GET /leaderboard?chain=sui&tier=Pro`. Iron Session middleware for authenticated reads.
    **Avoid:** trader-app-side polling for state (use WS); gateway holding any admin keys.
  </action>
  <verify>open WS connection from a test client; submit a TradeFilled-equivalent row insert; assert the connected client receives the broadcast within 100ms</verify>
  <done>
    - [ ] WS gateway broadcasts vault + price updates with p99 <200ms
    - [ ] Stalled-vault detector fires Discord alert on 6-day-inactive vault
    - [ ] REST endpoints serve indexer state correctly
  </done>
  <rollback>git checkout -- services/api-gateway/</rollback>
</task>

</tasks>

<verification>
- [ ] `cargo test -p risk-engine` — all green
- [ ] `pnpm --filter api-gateway test` — all green
- [ ] Cold replay: stop indexer, reset cursor, restart; verify identical rows are reproduced
- [ ] Switchboard divergence test triggers halt flag + Discord alert
- [ ] Shadow-quote rows written for every devnet TradeFilled
- [ ] Stalled-vault detector fires on synthetic 6-day-old vault
</verification>

<success_criteria>
Phase 2 is complete when the risk-engine continuously ingests Sui devnet events (via checkpoint polling through Shinami), writes them as canonical rows into Postgres+TSDB, can cold-replay from cursor without divergence, runs the Pyth+Switchboard price feed with halt-on-divergence, logs shadow-quote residuals via 7K Protocol on every fill, and the API gateway fans out real-time updates to WS clients while the stalled-vault detector quietly nudges the operator on dormant vaults. All artifacts written to disk are reproducible from chain state alone.
</success_criteria>

<output>
Create `.claude/plans/Crypto-Native/phases/02-backend-indexer/SUMMARY.md` after completion, documenting task results and any deviations from the plan.
</output>
