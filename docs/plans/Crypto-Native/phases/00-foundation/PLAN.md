---
phase: 00-foundation
type: execute
depends_on: []
files_modified:
  - package.json
  - pnpm-workspace.yaml
  - turbo.json
  - Cargo.toml
  - rust-toolchain.toml
  - biome.json
  - packages/shared/events/
  - packages/shared/contracts-abi/
  - infra/docker-compose.yml
  - infra/postgres/init.sql
  - .github/workflows/
  - SCOPE-LOCK.md
autonomous: true
requirements: [REQ-08, REQ-09]
must_haves:
  truths:
    - "Monorepo builds green across pnpm + Cargo workspaces."
    - "TypeBox event schema codegens TS types and Rust structs; CI fails on drift."
    - "Sui native MultiSig controls a test deploy key."
    - "Hetzner CCX VM runs Postgres 16 + TimescaleDB 2.15+ + Docker Compose stack."
    - "Pyth Hermes WS subscription returns BTC/ETH/SOL price ticks live."
    - "Versions for sui CLI, Next.js, Pyth are verified against live release notes (not training data)."
  artifacts:
    - "packages/shared/events/schema.ts (TypeBox source of truth)"
    - "packages/shared/events/codegen/{ts,rust}/ (generated types)"
    - "infra/docker-compose.yml"
    - "SCOPE-LOCK.md (Linear-mirrored scope canon)"
  key_links:
    - from: "packages/shared/events/codegen/rust/lib.rs"
      to: "services/risk-engine/Cargo.toml"
      type: "import"
    - from: "packages/shared/events/codegen/ts/index.ts"
      to: "apps/trader/package.json"
      type: "import"
---

<objective>
Establish the monorepo skeleton, event schema with codegen + CI gate, Sui native MultiSig upgrade authority, Hetzner+Postgres+TimescaleDB stack, and verify all version pins against live docs. Clears the verification debt the research flagged (SUMMARY §8) before any contract code lands. Satisfies REQ-08 (event schema codegen + CI gate) and REQ-09 (multisig upgrade authority on Sui from day 1).
</objective>

<context>
@.claude/plans/Crypto-Native/PROJECT.md
@.claude/plans/Crypto-Native/STATE.md
@.claude/plans/Crypto-Native/ROADMAP.md
@.claude/plans/Crypto-Native/research/STACK.md
@.claude/plans/Crypto-Native/research/SUMMARY.md
</context>

<tasks>

<task type="auto" id="0.1" depends_on="">
  <name>Verify toolchain versions against live release notes and pin them</name>
  <files>
    rust-toolchain.toml
    .tool-versions
    .nvmrc
    VERSIONS.md
  </files>
  <context>
    Why: REQ-08 + SUMMARY §8 — all version pins from research are training-data MED-confidence; we must verify against live docs before Phase 1 contract code lands or weird API-shift bugs will appear mid-build.
    Pattern: pin every tool in a tracked file; record verification date + URL.
  </context>
  <action>
    1. With live web access, verify and pin: `sui --version` (mainnet branch); Node 22 LTS; pnpm 9.x; Rust stable 1.79+; Next.js 15 or 16 if stable >2 months; Pyth Hermes endpoint; Switchboard On-Demand coverage for SOL/ETH/BTC on Sui mainnet.
    2. Write `VERSIONS.md` capturing each pin with verification date + source URL.
    3. Pin Rust toolchain in `rust-toolchain.toml`; pin Node version in `.nvmrc`; pin pnpm in `package.json` engines field.
    **Avoid:** copying versions from STACK.md without re-verifying — STACK.md is explicitly training-data-only.
  </action>
  <verify>cat VERSIONS.md | grep -c 'verified-as-of' && sui --version</verify>
  <done>
    - [ ] VERSIONS.md exists with verified-as-of dates for all pinned items
    - [ ] All CLI tools install and report expected versions on a fresh machine
  </done>
  <rollback>git checkout -- rust-toolchain.toml .nvmrc VERSIONS.md</rollback>
</task>

<task type="auto" id="0.2" depends_on="0.1">
  <name>Scaffold the monorepo (Turborepo + pnpm + Cargo workspaces)</name>
  <files>
    package.json
    pnpm-workspace.yaml
    turbo.json
    Cargo.toml
    biome.json
    tsconfig.base.json
    .github/workflows/ci.yml
    contracts/sui/.gitkeep
    services/risk-engine/.gitkeep
    services/api-gateway/.gitkeep
    apps/trader/.gitkeep
    apps/admin/.gitkeep
    packages/shared/events/.gitkeep
    packages/shared/contracts-abi/.gitkeep
    packages/shared/slippage/.gitkeep
  </files>
  <context>
    Why: REQ-08 — directory layout per STATE.md must be in place before any module lands; cross-chain parity hinges on shared/ packages.
    Pattern: see STATE.md "File layout to establish"; xpm sibling repo layout for Turborepo convention.
  </context>
  <action>
    1. Initialize root with `pnpm init`; add `pnpm-workspace.yaml` listing `apps/*`, `services/*`, `packages/*`, `contracts/sui`.
    2. Add `turbo.json` with task graph: `build`, `lint`, `test`, `typecheck`. Rust crates orchestrated via `pnpm run build:rust` calling `cargo build --workspace`.
    3. Add root `Cargo.toml` workspace with `services/*` and `packages/shared/slippage` (Rust crate for the off-chain reference impl) as members.
    4. Configure Biome at root (`biome.json`) — formatter + linter for all TS.
    5. Add GitHub Actions CI workflow `.github/workflows/ci.yml` with jobs: `contracts-sui`, `services`, `frontend`. Cache cargo + pnpm.
    **Avoid:** running `pnpm i` until shared packages have actual `package.json` files; avoid Nx, Lerna; avoid wiring Rust crates as TS workspace members.
  </action>
  <verify>pnpm install && pnpm turbo build --dry-run && cargo build --workspace --no-run</verify>
  <done>
    - [ ] `pnpm install` succeeds at root
    - [ ] `pnpm turbo build` reports an empty but valid task graph
    - [ ] `cargo build --workspace` succeeds (no real code yet)
    - [ ] CI workflow passes on a no-op PR
  </done>
  <rollback>rm -rf node_modules target && git checkout -- .</rollback>
</task>

<task type="auto" id="0.3" depends_on="0.2">
  <name>Define cross-chain event schema with TypeBox + codegen + CI parity gate</name>
  <files>
    packages/shared/events/package.json
    packages/shared/events/src/schema.ts
    packages/shared/events/src/codegen-rust.ts
    packages/shared/events/src/codegen-move-lint.ts
    packages/shared/events/codegen/rust/
    packages/shared/events/codegen/ts/
    .github/workflows/event-parity.yml
  </files>
  <context>
    Why: REQ-08 — the event schema is the contract between Move contracts and the indexer. Per PITFALLS 2.6, schema drift between Sui Move event structs and the canonical schema is a P0 silent-failure risk. Codegen + CI gate is the only durable mitigation.
    Pattern: TypeBox as single source of truth → derive TS types directly (`Static<typeof Schema>`); generate Rust structs via small codegen script; lint Move event structs against schema field names.
  </context>
  <action>
    1. Define every canonical event in TypeBox: `VaultOpened`, `TradeIntentSubmitted`, `TradeFilled`, `RuleViolated`, `VaultPassed`, `VaultFailed`, `VaultInactive`, `SbtMinted`, `SbtLeveledUp`, `AllowlistAdded`, `OperatorPaused`, `OperatorResumed`.
    2. Write `codegen-rust.ts` that emits `#[derive(Serialize, Deserialize)]` Rust structs to `codegen/rust/lib.rs`.
    3. Write `codegen-move-lint.ts` that reads schema and produces a checklist of expected Move struct field names — used by Phase 1 to lint Move event definitions.
    4. Add `.github/workflows/event-parity.yml` that runs codegen on every PR and fails if `codegen/` is out of sync with `src/schema.ts`.
    **Avoid:** hand-translating events to Move — generation is required; Move struct codegen itself is hand-written in Phase 1 but lint-checked here.
  </action>
  <verify>pnpm --filter @shared/events run codegen && git diff --exit-code packages/shared/events/codegen/</verify>
  <done>
    - [ ] All 12 events defined in TypeBox
    - [ ] `pnpm codegen` produces Rust + TS artifacts deterministically
    - [ ] CI parity gate fails when schema and codegen diverge (verified by intentional drift test)
  </done>
  <rollback>git checkout -- packages/shared/events/</rollback>
</task>

<task type="auto" id="0.4" depends_on="0.2">
  <name>Provision Hetzner VM with Docker Compose stack (Postgres + TimescaleDB + observability)</name>
  <files>
    infra/docker-compose.yml
    infra/postgres/init.sql
    infra/postgres/Dockerfile
    infra/otel-collector-config.yml
    infra/README.md
  </files>
  <context>
    Why: STACK.md §5 — self-hosted Hetzner CCX VM; managed Postgres alternatives lack TimescaleDB extension. Stack must include Postgres+TSDB, OTel collector for Grafana Cloud, and reserve for future services.
    Pattern: `timescale/timescaledb-ha:pg16` image; pgbackrest for backups to Backblaze B2.
  </context>
  <action>
    1. Provision a Hetzner CCX23 (or CCX33) instance; install Docker + Docker Compose v2.
    2. Write `infra/docker-compose.yml` with services: `postgres` (timescale/timescaledb-ha:pg16), `otel-collector`, `pgbackrest`.
    3. Write `infra/postgres/init.sql` creating: TimescaleDB extension; baseline schema for `vaults`, `trade_events`, `price_ticks`, `equity_curves` (hypertables); `operator_audit_log`.
    4. Set up daily pgbackrest backup to Backblaze B2 with WAL archiving.
    5. Document a restore drill procedure in `infra/README.md` — actual drill executes in Phase 7.
    **Avoid:** Neon, Supabase, RDS — all flagged in STACK.md as wrong call here.
  </action>
  <verify>ssh hetzner 'docker compose ps' shows postgres + otel-collector RUNNING; psql -c "\dx" shows timescaledb</verify>
  <done>
    - [ ] Hetzner VM provisioned with public IP allowlisted to dev machines
    - [ ] Postgres+TSDB container healthy; hypertables created
    - [ ] pgbackrest cron writes successful daily backup to Backblaze B2
  </done>
  <rollback>docker compose down -v on the VM; tear down Hetzner instance</rollback>
</task>

<task type="auto" id="0.5" depends_on="0.1">
  <name>Set up Sui native MultiSig upgrade authority (Phase 0 deliverable, not deferred)</name>
  <files>
    infra/multisig/sui-multisig-spec.md
    infra/multisig/test-deploy.md
  </files>
  <context>
    Why: REQ-09 + PITFALLS 4.8 — single-key risk during Phase 1-3 deploys is unacceptable. Multisig must be live before any contract goes to testnet.
    Pattern: Sui native MultiSig 2/3 quorum of founder + SC engineer + operator.
  </context>
  <action>
    1. Create a Sui MultiSig with 2/3 quorum (Sui's native multisig is part of the framework — not a separate contract): founder, SC engineer, operator keys.
    2. Document the address in `infra/multisig/sui-multisig-spec.md` along with key-rotation procedure.
    3. Run a test deploy on Sui devnet using the multisig as the upgrade authority on a dummy package. Verify upgrade flow works (publish v1 → upgrade to v2 via multisig signatures).
    **Avoid:** custodial multisig services for upgrade authority — they introduce a counterparty.
  </action>
  <verify>sui client object <upgrade-cap> shows MultiSig owner</verify>
  <done>
    - [ ] Sui MultiSig configured; 2/3 quorum tested
    - [ ] Test deploy + upgrade succeeds on Sui devnet
  </done>
  <rollback>Sui MultiSig retirement procedure</rollback>
</task>

<task type="auto" id="0.6" depends_on="0.3">
  <name>Proof-of-life: Pyth Hermes WS subscription receives BTC/ETH/SOL ticks</name>
  <files>
    services/risk-engine/src/main.rs
    services/risk-engine/src/price_feed.rs
    services/risk-engine/Cargo.toml
  </files>
  <context>
    Why: REQ-01 (mainnet-equivalent slippage) starts here. Phase 1 oracle adapter depends on knowing the Pyth Hermes endpoint is reachable and the feed IDs we need are populated.
    Pattern: STACK.md §4 — connect to `hermes.pyth.network/v2/updates/price/stream`, parse VAA-style updates, log price + age.
  </context>
  <action>
    1. Add `services/risk-engine/Cargo.toml` with deps: tokio, axum, sqlx, tracing, tracing-subscriber, serde, serde_json, tokio-tungstenite, futures-util, pyth-sdk.
    2. Implement `price_feed.rs` that subscribes to Pyth Hermes WS for SOL/USD, BTC/USD, ETH/USD feed IDs (looked up via `https://hermes.pyth.network/v2/price_feeds`).
    3. On each price update: log `(feed_id, price, conf, publish_time, latency_ms)`. Hold latest in memory; expose via `axum` HTTP `GET /price/:symbol`.
    4. Verify Pyth feed IDs for SOL/USD, BTC/USD, ETH/USD exist on Sui mainnet (Pyth Sui receiver package). Document missing feed IDs as STATE.md blockers.
    **Avoid:** writing the slippage model in this task — that's Phase 2. This is connectivity only.
  </action>
  <verify>curl localhost:3001/price/SOL returns a price; logs show ticks within last 5s</verify>
  <done>
    - [ ] Rust binary builds and runs locally
    - [ ] Pyth Hermes WS connects and receives ticks within 5s
    - [ ] Feed IDs for BTC/ETH/SOL confirmed on Sui mainnet
  </done>
  <rollback>git checkout -- services/risk-engine/</rollback>
</task>

<task type="auto" id="0.7" depends_on="0.2">
  <name>Scope-lock document + Linear workspace setup</name>
  <files>
    SCOPE-LOCK.md
    docs/operator/playbook-skeleton.md
  </files>
  <context>
    Why: PITFALLS 4.7 (feature creep) — closed beta is the prime target for "wouldn't this be cool" pressure. A scope-lock doc is the prevention.
    Pattern: PROJECT.md "Out of Scope for v1" + 14 clarification decisions become the canon.
  </context>
  <action>
    1. Write `SCOPE-LOCK.md` enumerating every "out of scope" item from PROJECT.md (real capital, mainnet DEX execution, airdrop hunting, prediction markets, real payouts, auto-scaling, profit-split ladder, multi-category, affiliate, DAO, LP vault, token, KYC, production reputation SBT) with one-line rationale each.
    2. Create the Linear workspace; mirror SCOPE-LOCK.md into a pinned Linear doc.
    3. Skeleton `docs/operator/playbook-skeleton.md` — populated fully in Phase 7, but the skeleton exists now.
    **Avoid:** soft language like "probably out of scope" — every item is a hard NO until v2 planning revisits.
  </action>
  <verify>grep -c '^- ' SCOPE-LOCK.md returns >= 14; Linear pinned doc visible</verify>
  <done>
    - [ ] SCOPE-LOCK.md committed
    - [ ] Linear workspace operational with scope-lock pin
  </done>
  <rollback>git checkout -- SCOPE-LOCK.md docs/operator/</rollback>
</task>

</tasks>

<verification>
- [ ] `pnpm install && pnpm turbo build` — green
- [ ] `cargo build --workspace` — green
- [ ] `pnpm --filter @shared/events run codegen` — deterministic; CI parity gate active
- [ ] `curl localhost:3001/price/SOL` — returns live Pyth price
- [ ] Hetzner Postgres+TSDB reachable; daily backup running
- [ ] Sui MultiSig controls test upgrade-authority key
- [ ] VERSIONS.md captures verified-as-of dates for all 8 pins
- [ ] SCOPE-LOCK.md mirrored into Linear
</verification>

<success_criteria>
Phase 0 is complete when a fresh developer can `pnpm install && pnpm turbo build && cargo build --workspace` and get a green build; the event schema codegens deterministically with a CI gate that fails on drift; the Hetzner stack is live with Postgres+TSDB + observability; the Sui native MultiSig controls a test deploy key with a documented and tested upgrade flow; the Pyth Hermes WS subscription receives price ticks for BTC/ETH/SOL; VERSIONS.md lists every tool pin with a verified-as-of date; and the SCOPE-LOCK.md is mirrored into Linear as the canonical "no" list. No contract code has been written yet; the next phase (Sui Contract Core) has every prerequisite in place.
</success_criteria>

<output>
Create `.claude/plans/Crypto-Native/phases/00-foundation/SUMMARY.md` after completion, documenting task results and any deviations from the plan.
</output>
