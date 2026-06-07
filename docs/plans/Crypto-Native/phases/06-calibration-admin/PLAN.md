---
phase: 06-calibration-admin
type: execute
depends_on: ["02-backend-indexer", "03-trader-app-mvp"]
files_modified:
  - services/risk-engine/src/calibrator/v1/
  - services/risk-engine/src/calibrator/backtest.rs
  - services/api-gateway/src/routes/admin.ts
  - apps/admin/
  - scripts/audit-no-override.sh
  - .github/workflows/admin-no-override-audit.yml
  - .github/workflows/event-schema-parity-replay.yml
  - infra/postgres/migrations/0020_calibration_*.sql
autonomous: true
requirements: [REQ-01, REQ-06]
must_haves:
  truths:
    - "30-day historical backtest passes: median |delta_bps| <= 5 bps for SOL, ETH, BTC pairs against 7K aggregator snapshots."
    - "slippage-calibrator v1 daily job computes drift; soft alert at >=3 bps; hard alert at >=5 bps."
    - "Admin app shows allowlist UI + pause/unpause + read-only vault views, with no endpoint that mutates vault P&L state."
    - "CI audit job (admin-no-override-audit) statically asserts the admin API exposes zero vault-mutating routes."
    - "Canonical event schema parity CI re-run as part of this phase; canonical events from identical synthetic inputs match byte-for-byte."
    - "Indexer cold-replay test passes deterministically in CI."
    - "Sybil clustering job runs nightly, flags suspicious wallet clusters to operator review queue (no automated action)."
  artifacts:
    - "30-day backtest report (artifact attached to phase summary)"
    - "apps/admin/ (Next.js admin app, separate auth domain)"
    - "admin-no-override-audit CI workflow"
  key_links:
    - from: "services/risk-engine/src/calibrator/backtest.rs"
      to: "infra/postgres/migrations/0020_calibration_runs.sql"
      type: "function_call"
    - from: "apps/admin/app/allowlist/page.tsx"
      to: "services/api-gateway/src/routes/admin.ts"
      type: "function_call"
---

<objective>
Run the 30-day backtest gate (the first of two beta-open blocking gates) and stand up the admin app with the structurally-enforced "no override path" property. The admin app is intentionally limited to allowlist + pause + read-only vault visibility — a CI audit asserts no vault-mutating endpoint exists in the gateway, complementing the contract-level enforcement from Phase 1 (REQ-06). The slippage-calibrator v1 + drift alerts close the loop on the slippage-model fidelity story (REQ-01). Canonical event schema replay + indexer cold-replay are revalidated as exit criteria for the entire pre-beta build.
</objective>

<context>
@.claude/plans/Crypto-Native/PROJECT.md
@.claude/plans/Crypto-Native/STATE.md
@.claude/plans/Crypto-Native/ROADMAP.md
@.claude/plans/Crypto-Native/research/PITFALLS.md (§1.1 backtest, §4.1 override creep, §4.2 calibration drift)
@.claude/plans/Crypto-Native/research/STACK.md (§7 operator auth)
</context>

<tasks>

<task type="auto" id="6.1" depends_on="">
  <name>30-day historical backtest harness — BLOCKING GATE</name>
  <files>
    services/risk-engine/src/calibrator/backtest.rs
    services/risk-engine/src/calibrator/historical/k7_loader.rs
    infra/postgres/migrations/0020_calibration_runs.sql
    scripts/run-30day-backtest.sh
    reports/backtest/
  </files>
  <context>
    Why: REQ-01 + PROJECT.md beta-open gate. PITFALLS 1.1 — without a 30-day backtest, the slippage model's mainnet equivalence is unproven.
    Pattern: load 30 days of swap data from the 7K Protocol aggregator for SOL/ETH/BTC majors; replay each swap through the slippage_model with the live `SlippageConfig`; compute `delta_bps` per swap; aggregate.
  </context>
  <action>
    1. Build historical loaders: pull 30 days of relevant aggregator swap data via API (or aggregator archive endpoints). Cache locally to disk so reruns don't re-fetch.
    2. `backtest.rs`: for each historical swap `(price, side, size, time)`, compute the model's predicted fill via `packages/shared/slippage`; compute delta_bps; group by symbol + time bucket.
    3. Persist results to `calibration_runs` table.
    4. `run-30day-backtest.sh` outputs a Markdown report to `reports/backtest/YYYY-MM-DD.md` with: median + p95 delta_bps per symbol; recommendations if outside spec.
    5. **GATE:** if median |delta_bps| for any of SOL/ETH/BTC exceeds 5 bps, this phase cannot exit. Adjust `SlippageConfig` parameters (a Phase 1 governance action via Sui MultiSig) and rerun.
    **Avoid:** running backtest against synthetic data only (defeats the purpose); accepting "close enough" >5 bps (gate is the gate).
  </action>
  <verify>./scripts/run-30day-backtest.sh; cat reports/backtest/<today>.md; assert all 3 majors median |delta_bps| <= 5</verify>
  <done>
    - [ ] Historical aggregator data cached for 30 days × 3 majors
    - [ ] Backtest report generated with per-symbol median + p95
    - [ ] **GATE PASSED:** median <= 5 bps for SOL, ETH, BTC
  </done>
  <rollback>git checkout -- services/risk-engine/src/calibrator/backtest.rs services/risk-engine/src/calibrator/historical scripts/run-30day-backtest.sh</rollback>
</task>

<task type="auto" id="6.2" depends_on="6.1">
  <name>slippage-calibrator v1 — daily drift detection with 3/5 bps alerts</name>
  <files>
    services/risk-engine/src/calibrator/v1/daily.rs
    services/risk-engine/src/calibrator/v1/alerter.rs
    infra/postgres/migrations/0021_drift_metrics.sql
  </files>
  <context>
    Why: REQ-01 — beta isn't a one-shot calibration; the model can drift as market conditions change. Clarify R2 alert thresholds: 3 bps soft / 5 bps hard.
    Pattern: nightly job runs over the last 24h of `shadow_quotes`; computes median + p95 by symbol; alerts on threshold breach.
  </context>
  <action>
    1. Daily cron job (via `river` Postgres-backed queue): aggregate previous 24h of `shadow_quotes` per symbol; compute median |delta_bps| + p95.
    2. Write results to `drift_metrics` table.
    3. Alerter posts to Discord webhook: soft alert at median >= 3 bps; hard alert at >= 5 bps. Hard alert also pages on-call via BetterStack.
    4. Expose `/admin/calibration/drift` endpoint serving last 30 days of drift_metrics for the admin dashboard.
    **Avoid:** alerting on a single noisy sample (use 24h median); silent failures of the job (alert if cron didn't run).
  </action>
  <verify>seed shadow_quotes with >5 bps median for 24h; run the daily job manually; assert Discord alert fires + BetterStack incident opens</verify>
  <done>
    - [ ] Daily cron job runs without manual intervention
    - [ ] Soft + hard alerts fire correctly
    - [ ] Drift metrics endpoint serves last 30 days
  </done>
  <rollback>git checkout -- services/risk-engine/src/calibrator/v1</rollback>
</task>

<task type="auto" id="6.3" depends_on="">
  <name>Admin app — allowlist UI + pause + read-only vault views (Next.js, separate auth domain)</name>
  <files>
    apps/admin/package.json
    apps/admin/app/layout.tsx
    apps/admin/app/page.tsx
    apps/admin/app/allowlist/page.tsx
    apps/admin/app/pause/page.tsx
    apps/admin/app/vaults/page.tsx
    apps/admin/app/vaults/[vaultId]/page.tsx
    apps/admin/lib/auth.ts
    services/api-gateway/src/routes/admin.ts
    services/api-gateway/src/middleware/admin-auth.ts
  </files>
  <context>
    Why: REQ-06 — operator needs allowlist + pause + visibility. STACK.md §7 — admin auth is SEPARATE domain + WorkOS/Clerk + WebAuthn passkey. ARCHITECTURE.md §4 — admin API never holds admin keys; returns unsigned txs to operator wallet.
    Pattern: separate Next.js app at `admin.entrypoint.xyz`; auth via WorkOS magic-link + mandatory WebAuthn passkey; admin actions return unsigned multisig-targeted txs that the operator co-signs from their wallet.
  </context>
  <action>
    1. Scaffold `apps/admin` as a separate Next 15 App Router project.
    2. WorkOS magic-link auth + WebAuthn passkey enrollment required on first sign-in.
    3. `/allowlist` page: search trader by address; add (constructs unsigned `add_to_allowlist` tx targeting registry; operator signs from their wallet which is on the multisig; submits).
    4. `/pause` page: shows current paused state per chain; pause/unpause via same unsigned-tx pattern.
    5. `/vaults` page: paginated table of all vaults; click → `/vaults/[vaultId]` for read-only equity curve + trade history + stalled-vault detection state. **No edit controls anywhere.**
    6. Every operator action writes to `operator_audit_log`.
    **Avoid:** admin API holding any signing keys; mutable UI controls anywhere in `/vaults`; allowing magic-link without WebAuthn (the passkey is the second factor); shared session/cookie with trader app.
  </action>
  <verify>operator can log in with magic-link + passkey; add a wallet to allowlist (transaction co-signed); cannot find any UI control to edit a vault's P&L</verify>
  <done>
    - [ ] Magic-link + WebAuthn passkey enforced
    - [ ] Allowlist + pause flows work end-to-end via multisig
    - [ ] /vaults page is read-only (no edit controls exist)
    - [ ] All admin actions audit-logged
  </done>
  <rollback>git checkout -- apps/admin services/api-gateway/src/routes/admin.ts services/api-gateway/src/middleware/admin-auth.ts</rollback>
</task>

<task type="auto" id="6.4" depends_on="6.3">
  <name>CI audit: admin API exposes zero vault-mutating routes</name>
  <files>
    scripts/audit-no-override.sh
    .github/workflows/admin-no-override-audit.yml
  </files>
  <context>
    Why: REQ-06 + PITFALLS 4.1 — operator-override creep is the silent-fail mode. The contract has no override path (Phase 1); this gate ensures the gateway has none either.
    Pattern: static analysis — grep + AST walk of `services/api-gateway/src/routes/admin.ts` for any route that calls `submit_intent`, `mint_or_level_up_sbt`, or writes to `vaults` / `trade_events` / `equity_curves` tables with non-read SQL. Fail on any match.
  </context>
  <action>
    1. `audit-no-override.sh`: greps for forbidden patterns (`update vaults`, `update trade_events`, `update cohort_sbt`, calls into `evaluation_vault::submit_intent` from admin context, etc.).
    2. Allowlist for legitimate matches (the `paused: bool` toggle on the Registry — that's the only legitimate admin write).
    3. `.github/workflows/admin-no-override-audit.yml` runs on every PR touching `services/api-gateway/src/routes/admin.ts` or `apps/admin/`.
    **Avoid:** an audit that only checks routes by name (must check actual SQL + RPC calls); not running on PRs that touch the contract-binding code.
  </action>
  <verify>add an intentional `UPDATE vaults SET equity = ...` to admin route in a test PR; assert CI fails. Remove. Assert CI passes.</verify>
  <done>
    - [ ] Audit script catches every forbidden pattern
    - [ ] Allowlist covers the single legitimate admin write
    - [ ] CI gate enforces on every relevant PR
  </done>
  <rollback>git checkout -- scripts/audit-no-override.sh .github/workflows/admin-no-override-audit.yml</rollback>
</task>

<task type="auto" id="6.5" depends_on="6.4">
  <name>Event schema parity replay + indexer cold-replay + Sybil clustering job</name>
  <files>
    .github/workflows/event-schema-parity-replay.yml
    .github/workflows/indexer-cold-replay.yml
    services/risk-engine/src/jobs/sybil_cluster.rs
    apps/admin/app/operator-review/page.tsx
    infra/postgres/migrations/0022_sybil_clusters.sql
  </files>
  <context>
    Why: REQ-03 + PITFALLS 4.3 + 4.4 — these CI gates re-verify the most important invariants. Sybil clustering is operator-review-only per Clarify R3 (no automated action).
    Pattern: schema parity replay re-runs the 50 synthetic inputs from Phase 1 contract tests to assert canonical event output has not drifted; cold-replay drops the indexer DB and reruns from cursor=0; Sybil clustering detects wallet clusters via gas-funding-source + behavior similarity.
  </context>
  <action>
    1. `event-schema-parity-replay.yml`: runs nightly + on PR; feeds 50 synthetic swap/evaluation inputs through the Move contracts on testnet and asserts the emitted canonical events match the TypeBox schema byte-for-byte. Fails if any field drifts.
    2. `indexer-cold-replay.yml`: spins ephemeral Postgres; replays indexer from cursor=0 against testnet snapshot; diffs final state vs production-snapshot baseline; fails on divergence.
    3. `sybil_cluster.rs`: nightly job; clusters wallets by: (a) gas-funded-from-same-wallet (b) identical evaluation timing patterns (c) similar IP signature on auth. Writes clusters to `sybil_clusters` table.
    4. `/operator-review` admin page renders flagged clusters; operator can mark "investigated → benign" or "suspicious → manual_pause" (which triggers the existing pause flow targeting specific allowlist removals).
    **Avoid:** automated Sybil action (Clarify R3 explicit — log-only); cluster-pruning before operator review; clustering that exposes PII publicly.
  </action>
  <verify>run all 3 workflows on a PR; assert pass. Inject synthetic Sybil cluster pattern; assert it appears in /operator-review.</verify>
  <done>
    - [ ] Both CI replay workflows live + nightly
    - [ ] Indexer cold-replay deterministic
    - [ ] Sybil clustering job + operator review queue working
  </done>
  <rollback>git checkout -- .github/workflows/event-schema-parity-replay.yml .github/workflows/indexer-cold-replay.yml services/risk-engine/src/jobs/sybil_cluster.rs apps/admin/app/operator-review</rollback>
</task>

</tasks>

<verification>
- [ ] **GATE: 30-day backtest report shows median |delta_bps| <= 5 for SOL, ETH, BTC**
- [ ] Daily drift alert fires correctly on synthetic >3 bps state
- [ ] Admin app: magic-link + WebAuthn enforced; allowlist + pause + read-only vault views
- [ ] `admin-no-override-audit` CI gate fails on intentional override attempt
- [ ] Event schema parity replay + indexer cold-replay both green
- [ ] Sybil clustering nightly + operator review queue functional
</verification>

<success_criteria>
Phase 6 is complete when the 30-day backtest gate passes (median |delta_bps| <= 5 bps on majors), the calibration drift alert is wired with 3/5 bps thresholds, the admin app is live with magic-link + passkey auth and contains zero vault-mutating UI, the CI audit asserts no override route exists in the gateway, event schema parity replay + indexer cold-replay run nightly in CI, and the Sybil clustering job feeds an operator review queue (with no automated action). At the end of this phase, only the 7-day forward-test gate stands between us and beta open.
</success_criteria>

<output>
Create `.claude/plans/Crypto-Native/phases/06-calibration-admin/SUMMARY.md` after completion, documenting task results and any deviations from the plan.
</output>
