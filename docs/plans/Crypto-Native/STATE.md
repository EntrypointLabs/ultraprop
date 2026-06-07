# State: Crypto-Native Prop Trading Firm — v1 Closed Beta

## Current Phase
Phase 1: Planning — Discovery complete (greenfield codebase confirmed)

## Codebase Context

> **Discovery finding:** `/Users/gifted/Documents/repos/entrypoint/prop-firm/` is **greenfield**. The only contents are `.claude/plans/Crypto-Native/PROJECT.md`, `.claude/plans/Crypto-Native/phases/` (empty), and `.claude/settings.local.json`. No source code, no `package.json`, no `Move.toml`, no tests, no CI exist yet. There are no in-repo patterns to mirror.
>
> Sibling repos under `/Users/gifted/Documents/repos/entrypoint/` (`fuse-android`, `xpm`) are unrelated products. They may inform tooling choices (both use Turborepo monorepo layouts; `xpm` uses Biome + pnpm workspaces) but they are **not authoritative** for this project's conventions. Treat them as optional reference only.
>
> Discovery here therefore documents the **conventions we will establish**, not patterns we found in-tree. The 2–3-examples requirement is satisfied via the patterns the vision itself prescribes (Sui Move, indexer service) plus optional sibling-repo precedent for monorepo tooling.

### Relevant Patterns (with examples)

**Pattern 1: Sui Move evaluation contract (to be created)**
- Found in: *(no in-repo file yet — pattern is prescribed by `PROJECT.md` §"Technical Notes" and §"Chain sequence")*
- Reference precedents (external, not in-repo): Sui Move object model for per-trader evaluation vaults (resource semantics enforce drawdown / daily-loss / profit-target invariants).
- How it works: Contract is the only execution surface. Trade intents are validated pre-trade against oracle price + slippage model; fills are deterministic; rule breaches halt the vault and emit fail events; passes mint/level the cohort SBT.
- We should: **establish** this pattern in `contracts/sui/` with one Move module per concern (vault, evaluation, sbt, leaderboard, oracle adapter). Object-per-trader, not shared-mutable.

**Pattern 2: Indexer + real-time service (to be created)**
- Found in: *(no in-repo file yet — pattern is prescribed by `PROJECT.md` §"Backend / risk service" and §"Indexer")*
- How it works: Self-hosted Postgres + TimescaleDB on a single VM. Streams Pyth/Switchboard prices, ingests Sui chain events, serves the dashboard over WebSocket, computes the slippage model, alerts the operator on anomalies.
- We should: **establish** this pattern as a single Rust service in `services/risk-engine/` with a Sui chain adapter and a TypeScript gateway in `services/api-gateway/`.

### Conventions (to be established — no in-repo precedent)

| Aspect | Proposed Convention | Rationale |
|--------|---------------------|-----------|
| Repo layout | Monorepo: `contracts/sui/`, `services/risk-engine/`, `services/api-gateway/`, `apps/trader/`, `apps/admin/`, `packages/shared/` | Shared event schema needs one source of truth. Mirrors sibling `xpm` Turborepo precedent. |
| Move module naming | `snake_case`, one module per concern (`evaluation_vault`, `cohort_sbt`, `oracle_adapter`) | Sui ecosystem standard. |
| TS naming | `camelCase` functions, `PascalCase` types, `kebab-case` files | Sibling-repo precedent (`xpm`). |
| Event schema | Shared JSON schema in `packages/shared/events/` consumed by the indexer and the Sui emitter | Canonical event schema is the seam between the chain and the indexer. |
| Testing | Move: `sui move test` in `contracts/sui/tests/`. TS: Vitest co-located `*.test.ts`. Rust: `cargo test`. | Per-ecosystem norms. |
| Error handling | Move: `assert!` with named error codes per module. TS: typed `Result`-ish discriminated unions for service boundaries; throw within a module. | Standard per ecosystem. |
| Lint/format | Biome for TS (sibling `xpm` precedent); `sui move fmt`; `rustfmt` + `clippy` for Rust. | Lowest-friction toolchain. |
| Package manager | pnpm + workspaces (sibling `xpm` precedent) | Monorepo ergonomics. |

### Files to Modify

> **N/A** — no files exist to modify. Below is the **files-to-create** map derived from the priority stack in `PROJECT.md`.

| File / Directory (to create) | Purpose | Risk |
|------|---------|------|
| `contracts/sui/Move.toml` + `contracts/sui/sources/evaluation_vault.move` | P0 — Sui evaluation contract, per-trader vault object, pre-trade rule enforcement. | **H** — core essence; bug here invalidates every pass/fail decision. |
| `contracts/sui/sources/cohort_sbt.move` | P1 — mutable v1 cohort SBT (highest_tier, total_passes, total_shadow_pnl, total_trades, last_active_at). | M — needs forward-compat with Phase 3 reputation schema. |
| `contracts/sui/sources/oracle_adapter.move` | P0 — Pyth/Switchboard read + staleness checks. | **H** — stale or wrong prices break model fidelity (±5 bps success criterion). |
| `contracts/sui/sources/slippage_model.move` (or off-chain commit pattern) | P0 — deterministic fill modeling. | **H** — model fidelity is the single load-bearing essence per `PROJECT.md`. |
| `services/risk-engine/` | P1 — Rust service: Postgres + TimescaleDB ingest, Pyth price feed, slippage calibration. | **H** — dashboard, leaderboard, and operator alerts all depend on it; single VM is an SPOF for v1. |
| `services/api-gateway/` | P1 — TypeScript Hono service: WebSocket fan-out, REST endpoints. | M |
| `apps/trader/` | P1 — trader dashboard (wallet connect, tier select, live P&L, evaluation status). | M |
| `apps/admin/` | P2 — operator dashboard; Notion + Discord fallback per priority stack. | L |
| `packages/shared/events/` | P0 — canonical event schema consumed by the Sui emitter and the indexer. | **H** — divergence silently corrupts the indexer. |
| `packages/shared/slippage/` | P0 — calibration scripts + 30-day historical backtest harness. | **H** — calibration gate before beta opens. |
| Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json` | Workspace + tooling. | L |
| `.github/workflows/` | CI for Move tests, Rust tests, TS lint/test. | L |

### Integration Points

| System | Connection | Impact if it breaks |
|--------|------------|---------------------|
| **Pyth (Sui)** | Oracle adapter module reads price + confidence + publish_time. | Stale/wrong prices → wrong fills → violates "±5 bps mainnet parity" success criterion. Need staleness reverts + fallback. |
| **Switchboard (fallback)** | Secondary oracle path on Sui. | Single-oracle failure halts evaluations; dual-feed mitigates. |
| **Sui RPC** | Indexer polls checkpoint stream. | Indexer lag → stale dashboard, stale leaderboard, missed operator alerts. Need checkpoint cursors + replay. |
| **Postgres + TimescaleDB (single VM)** | Indexer storage + WebSocket source of truth. | SPOF for v1. Backup strategy + restore drill required before beta opens. |
| **Sui wallet adapter (@mysten/dapp-kit)** | Trader app sign-in + intent signing. | Wrong signing UX → traders blocked at onboarding; affects engagement success criterion (30+ completions). |
| **Allowlist (off-chain → on-chain)** | Operator-managed wallet allowlist; contract gates entry. | Mismatch between off-chain invite list and on-chain allowlist locks out invited traders. |
| **Discord / Notion** | P2 fallback for admin dashboard. | Acceptable degradation per priority stack. |

## Risks Identified

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Slippage/fill model diverges from mainnet beyond ±5 bps on majors | **H** — invalidates the entire essence; v2 results won't match v1 | M | 30-day backtest gate before beta opens; document model as code in `packages/shared/slippage/`; ship calibration dashboard before launch. |
| Event schema drift between contract and indexer | **H** — breaks indexer ingestion silently | M | Single source of truth in `packages/shared/events/`; codegen Move structs from schema; indexer reads same schema; CI drift gate. |
| Indexer VM SPOF | M — beta dashboard goes dark if VM dies | M | Daily Postgres backups + Timescale continuous aggregates; documented restore drill; on-chain remains source of truth so events can be re-indexed. |
| Oracle staleness or feed outage | **H** — wrong fills, bad pass/fail decisions | L–M | Hard staleness limits in oracle adapter (revert on stale); dual-feed Pyth + Switchboard; halt-on-divergence threshold. |
| SBT schema incompatible with Phase 3 reputation system | M — forced migration | M | Keep v1 SBT minimal (5 fields per `PROJECT.md`); document forward-compat assumptions in module header; do not bake leaderboard math into SBT. |
| Operator override creep (re-adjudication) | **H** — violates "zero override" success criterion | L | All rule enforcement on-chain; admin dashboard read-only for evaluation outcomes; operator can pause but not reverse. |
| Beta engagement falls short of 30 completions | M — success criterion miss | M | Tier ladder + SBT + leaderboard are the explicit retention play; ensure they ship at v1 launch (P1, not P2). |
| Greenfield velocity risk — 14–18-week timeline | M | M | Admin dashboard P2 (Notion/Discord fallback acceptable); cut to priority-stack "survives 50%" set if behind. |
| Wallet UX friction on trade-intent signing | M — onboarding drop-off | M | Test Sui wallet adapter UX in internal testing week (weeks 12–15); precompute intent payloads client-side. |

## Constraints

- **Performance:** Slippage model fills must match mainnet within ±5 bps on SOL/ETH/BTC pairs over 30-day backtest. Dashboard WebSocket updates must reflect chain events with sub-second latency for the trader to trust live P&L.
- **Compatibility:** Sui Move (latest stable testnet). Pyth + Switchboard on Sui. Non-custodial wallet flow via @mysten/dapp-kit. Indexer on a single Linux VM, Postgres 15+, TimescaleDB latest.
- **Security:** Non-custodial — contract is the only execution path in v1. No real capital, but the contract still owns the integrity of every pass/fail decision. All rule enforcement on-chain; operator can pause/allowlist but cannot reverse outcomes. SBT must be non-transferable (true SBT semantics).
- **Determinism:** Fill modeling must be deterministic given (oracle price, intent, vault state). Any randomness or off-chain input invalidates the "explicable from on-chain data alone" success criterion.
- **Forward-compat:** v1 SBT must either evolve cleanly into Phase 3 reputation or admit clean migration. Event schema must absorb additional event types without breaking the indexer.

## Decisions Made

| Decision | Reasoning | Alternatives Considered |
|----------|-----------|------------------------|
| Treat repo as greenfield; document conventions to **establish**, not patterns to mirror | No source code exists in-repo; sibling repos (`fuse-android`, `xpm`) are unrelated products | Inherit conventions from `xpm` wholesale — rejected because the products differ and forcing premature uniformity locks in choices before the SC engineer and BE engineer have input |
| Monorepo with `contracts/sui/`, `services/`, `apps/`, `packages/shared/` | A single source of truth for the event schema; sibling-repo `xpm` already proves Turborepo + pnpm works for this team | Polyrepo (rejected — schema-drift risk); single-package (rejected — Move toolchain demands a separate root) |
| Shared event schema in `packages/shared/events/` is P0 | The only way the indexer ingests Sui events uniformly and safely | Keeping schema purely in the contract source (rejected — drift surfaces too late, at indexer ingestion time) |
| Sui Move as the sole contract platform | Move's resource semantics give stronger enforcement guarantees for evaluation vaults; Sui's owned-object fast path delivers sub-second trade confirmation | Other chains (rejected — would split engineering attention while the slippage model is still being calibrated) |
| Defer admin-dashboard build; accept Notion + Discord fallback as P2 | Priority stack in `PROJECT.md` explicitly permits this | Build full admin dashboard in v1 (rejected — eats time from P0 slippage calibration) |
| Indexer as a single service on a single VM for v1 | `PROJECT.md` "Technical Notes" makes this explicit | Multi-service / multi-VM (rejected — overkill for closed beta and burns the BE engineer's time) |

## Blockers

- **No source code in repo yet.** Every "file to modify" is actually a "file to create" — the next planning phases (research → clarify → generate) need to nail down toolchain versions (Sui Move toolchain version, Node version, Postgres + TimescaleDB versions) before scaffolding begins.
- **Slippage model owner not yet onboarded.** `PROJECT.md` names "Backend engineer" as owner but the team table shows that role is still being hired/assigned. Calibration gate (weeks 9–12) is at risk if onboarding slips.
- **Pyth/Switchboard feed coverage for the chosen pairs on Sui testnet** not yet verified. Needs confirmation that SOL/ETH/BTC majors have stable feeds on Sui testnet with adequate update frequency.

## Discovery Checklist
- [x] Found 2-3 examples of similar patterns *(satisfied via prescribed patterns in `PROJECT.md`; in-repo precedent is N/A — greenfield)*
- [x] Documented all files to modify with risk levels *(reframed as files-to-create map; greenfield)*
- [x] Identified integration points with impact assessment
- [x] Surfaced risks with mitigation strategies
