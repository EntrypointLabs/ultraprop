# STACK.md — Crypto-Native Prop Trading Firm v1

**Researched:** 2026-05-14
**Verification posture:** Version pins below are sourced from training data (cutoff Jan 2026). Every version below carries an implicit `VERIFY` flag — the SC engineer / BE engineer should confirm before pinning into lockfiles. Recommendations themselves (library choice, architecture pattern) are higher confidence than the specific version strings.

---

## TL;DR — Pick-One-Per-Layer Recommendations

| Layer | Pick | Confidence (choice) | Confidence (version) |
|---|---|---|---|
| Sui toolchain | `sui` CLI from `mainnet` branch, Move 2024.beta edition, framework `1.x` (verify against `sui --version`) | HIGH | MED |
| Sui testing | Sui's built-in `sui move test` + `sui-test-validator` for integration | HIGH | HIGH |
| Event schema seam | JSON-schema in `packages/shared/events/` + codegen (no framework) | HIGH | HIGH |
| Backend language | **Rust** (axum) for indexer + slippage; **TypeScript** (Hono) for the WS gateway / dashboard API | HIGH | HIGH |
| Rust web framework | **axum** (tower ecosystem) | HIGH | HIGH |
| Rust DB driver | **sqlx** (compile-time checked SQL, async, TimescaleDB-friendly) | HIGH | HIGH |
| Sui indexer pattern | Direct subscription to Sui fullnode checkpoint stream (or Sui GraphQL RPC); avoid SubQuery for v1 | MED | n/a |
| Job queue | **Postgres-backed** (`river` crate) — no Redis | HIGH | HIGH |
| Frontend | Next.js 15 App Router | HIGH | MED — Next 16 may have shipped |
| State | **TanStack Query** + **Zustand** for local UI state | HIGH | HIGH |
| Realtime client | `partysocket` or native `WebSocket` bridged into TanStack Query cache | MED | n/a |
| Sui wallet | **`@mysten/dapp-kit`** (Mysten official; Wallet Standard underneath) | HIGH | HIGH |
| Charts | **TradingView Lightweight Charts** for prices + equity curves | HIGH | HIGH |
| UI primitives | **shadcn/ui (Radix + Tailwind)** | HIGH | HIGH |
| Oracle (prices) | **Pyth Hermes (pull oracle)** primary on Sui; Switchboard as failover | HIGH | HIGH |
| DB | **Self-hosted Postgres 16 + TimescaleDB 2.15+** on Hetzner CCX-class VM | HIGH | MED |
| Frontend hosting | **Vercel** (trader app) | HIGH | HIGH |
| Backend hosting | **Hetzner CCX dedicated VM** (Docker Compose) for v1; Fly.io for WS edge if latency demands it | HIGH | HIGH |
| Sui RPC | **Shinami** primary, Triton/QuickNode failover | MED | MED |
| Observability | **Sentry** (FE+BE errors) + **Grafana Cloud Free** (metrics + logs via OTel) + **BetterStack** uptime | HIGH | HIGH |
| Monorepo | **pnpm workspaces + Turborepo** | HIGH | HIGH |
| Package manager | **pnpm 9.x** | HIGH | HIGH |
| Lint/format | **Biome** for TS; `rustfmt`+`clippy`; `sui move fmt`; `cargo fmt` | HIGH | HIGH |
| E2E | **Playwright** | HIGH | HIGH |
| Unit (TS) | **Vitest** | HIGH | HIGH |
| CI | **GitHub Actions** | HIGH | HIGH |
| Wallet auth | Sui sign-personal-message + nonce (via `@mysten/dapp-kit`) | HIGH | HIGH |
| Session | **Iron Session** (stateless cookie) for v1; migrate to Better-Auth only if needed | HIGH | HIGH |
| Operator auth | Separate path: WorkOS / Clerk magic-link + WebAuthn passkey | HIGH | HIGH |

**Reversibility callouts:**
- Cheap to swap later: chart library, UI primitive set, state mgmt, session lib, observability vendor.
- Expensive (lock-in): RPC provider, DB host (Postgres+TSDB schema is portable but migrations are painful), indexer architecture, event schema (schema is the contract between contracts and indexer), oracle choice (Move adapter modules are non-trivial to rewrite).

---

## 1. Smart Contract Layer

### Sui Move

**Toolchain:**
- `sui` CLI installed from the `mainnet` branch via `cargo install --git https://github.com/MystenLabs/sui --branch mainnet sui` OR Suibase-managed binary.
- **Version:** Sui mainnet binary as of Jan 2026 was in the **1.40–1.45 range**. VERIFY via `sui --version` and pin in CI.
- **Move edition:** `edition = "2024.beta"` in `Move.toml`.
- **Sui framework dep:** `Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/mainnet" }`.

**Suibase (recommended):** manages localnet/devnet/testnet/mainnet binaries side-by-side, deterministic faucet, workdir per network. Strongly recommended over `sui client switch` juggling.

**Anti-recommendation:** do NOT install `sui` via Homebrew on macOS — it lags. Use Suibase or `cargo install`.

**Testing:**
- **Built-in `sui move test`** — unit tests with `#[test]` and `#[test_only]`. Use `test_scenario` for object-flow tests.
- End-to-end: `sui-test-validator` driven from Vitest using `@mysten/sui` SDK.
- No "Foundry for Move" yet — built-in is sufficient.

**Deployment:**
- `sui client publish --gas-budget <n>` from CI with a deployer keypair in GH secrets.
- v1 contract declares `UpgradeCap` deliberately (admin-held, planned to be burned post-beta).

**Confidence:** HIGH on toolchain & testing approach, MED on CLI version pin.

### Event Schema Seam

**Recommendation:** **No cross-chain bridging. Schema-level parity only.**

- The event schema in **`packages/shared/events/`** — JSON Schema (or TypeBox) — is the contract between Move contracts and the off-chain indexer.
  1. **Codegen:** TypeBox → TS types + Rust structs. Move event struct templates hand-written but lint-checked against schema.
  2. **`packages/shared/contracts-abi/`** — TS bindings. Sui via `@mysten/sui/transactions`.

**Confidence:** HIGH.

---

## 2. Backend Services

### Language Decision — Rust for the risk engine, TypeScript for the gateway

**The PRD's preference for Rust on the risk engine is correct in 2026:**

1. **Determinism parity.** Slippage model exists in two places: on-chain (Move) and off-chain. Rust off-chain matches Move's numeric semantics far more closely than JS/TS or Go.
2. **Throughput.** Pyth Hermes pushes thousands of price updates/sec. Rust + `tokio` handles this without GC pauses.
3. **Ecosystem.** Sui's `sui-sdk` Rust crate and Pyth's Hermes client are Rust-first.

**But** the WebSocket fan-out + dashboard REST API are bog-standard CRUD. Split:

- **`services/risk-engine/`** (Rust, axum) — Pyth subscription, slippage modeling, on-chain event ingestion, writes Postgres+TSDB.
- **`services/api-gateway/`** (TypeScript, Hono) — WS fan-out to browser, REST endpoints, session validation. Subscribes to risk-engine via Postgres LISTEN/NOTIFY or NATS.

This split keeps the founder unblocked on the part they'll touch most.

**Anti-recommendation:** Don't pick Go. No advantage over Rust here; the Sui Rust SDK is first-party while Go SDKs are community-maintained.

**Confidence:** HIGH.

### Rust web framework — axum

- **`axum` 0.7.x** (or 0.8 if released). Tower ecosystem, async-first.
- Anti-recommendations: `actix-web` (smaller middleware ecosystem, actor-model friction); `rocket` (slow release cadence).
- **WebSocket:** `axum::extract::ws` (built-in, tungstenite underneath).
- **gRPC** (if needed): `tonic` 0.12+.

**Confidence:** HIGH.

### TypeScript framework — Hono

- **Hono 4.x** — lightweight, adapter-portable (Node/Bun/Workers), better DX than Fastify for typed routes.
- Anti-recommendations: **NestJS** (overkill, opinion-heavy), **Express** (legacy, weak types).

**Confidence:** HIGH.

### Database driver — sqlx (Rust) + Kysely (TypeScript)

- **Rust:** **`sqlx`** 0.8+ with `postgres` feature. Compile-time checked SQL via `query!` macros. Native TSDB compatibility. Async, Tokio-native.
  - Anti: `sea-orm` (ORM overhead, less control over time-series); `tokio-postgres` raw (loses compile-time safety).
- **TypeScript:** **Kysely** + `pg` for the gateway. Type-safe SQL builder; not an ORM.
  - Anti: **Prisma** (TSDB hypertable migrations are painful; query engine adds latency).
  - Anti: **Drizzle** for v1 (TSDB story still thin).

**Migrations:** **`sqlx migrate`** (Rust owns the schema; gateway is read-mostly).

**Confidence:** HIGH.

### Indexer pattern

- **Direct subscription to Sui fullnode checkpoint stream** via the `sui-indexer-framework` Rust crate. Same pattern Mysten's own indexer uses.
- Alternative for v1 simplicity: **Sui GraphQL RPC** poll loop. Lower throughput but simpler. Acceptable for 50–100 traders.
- Anti: **SubQuery** for Sui — adds another service and vendor.

**Confidence:** MED on Sui indexer (crate is solid but evolving).

### Job queue — Postgres-backed

- **`river`** (Rust) — Postgres-backed job queue, type-safe, single-binary, no Redis. https://riverqueue.com
- Use for: slippage recalibration, leaderboard recomputation, SBT mint retry, oracle staleness alerts.
- Anti: **BullMQ** (requires Redis = another stateful service); **Sidekiq** (Ruby).

**Confidence:** HIGH.

---

## 3. Frontend

### Next.js

- **Next.js 15.x App Router**. Server Components for static shell, Client Components for the dashboard.
- **Next 16 may have shipped — VERIFY** at https://nextjs.org/blog. Prefer 16 if it's been stable >2 months.
- Anti: Pages Router (maintenance only); Remix / TanStack Router for v1 (Next has the best wallet-adapter integration story).

**Confidence:** HIGH on App Router; MED on 15 vs 16.

### State management

- **TanStack Query v5** — owns server state (price feeds via WS, evaluation state, leaderboard).
- **Zustand v5** — owns local UI state (selected tier, modals, ephemeral form state).
- Anti: Redux Toolkit (overkill), Jotai (TanStack Query already handles atoms for server state), React Context for non-trivial state (performance footguns).

**Confidence:** HIGH.

### Real-time client

- **`partysocket`** (PartyKit) — robust WS client with reconnect, exponential backoff, message queueing.
- **Pattern:** WS messages → TanStack Query cache via `queryClient.setQueryData`. Standard React 2026 pattern.
- Anti: Supabase realtime (coupling-heavy); Phoenix Channels JS (only sensible if backend is Elixir).

**Confidence:** MED on `partysocket` specifically; HIGH on the "WS → TanStack Query" pattern.

### Wallet adapters

- **`@mysten/dapp-kit`** — Mysten official. Wallet Standard underneath. Supports Suiet, Sui Wallet, Nightly. Hooks: `useCurrentWallet`, `useSignAndExecuteTransaction`, `useSignPersonalMessage`.
- Anti: standalone Suiet wallet-kit (superseded by dapp-kit).
- **Privy** layered on top for email/SMS/social fallback login (invite link → wallet create flow for less-crypto-native users).
- Anti: Web3Auth, Magic — Privy's pricing and DX are better in 2026.

**Confidence:** HIGH on Mysten dapp-kit; MED on Privy specifics.

### Charts

- **TradingView Lightweight Charts v4.x** — only correct answer for price + equity curves. 45kb gzipped, performant on streaming data, looks like a trading product should look. Apache 2.0. **NOT** the "Advanced Charts" product (separate license).
- For non-price charts: **Recharts** simple, **visx** custom.
- Anti: ApexCharts, Chart.js, ECharts — won't look "tradingy" enough.

**Confidence:** HIGH.

### UI primitives — shadcn/ui

- **shadcn/ui** (Radix + Tailwind, copy-paste components). Pairs with designer's Figma workflow; everything is owned source.
- **Tailwind v4** if stable; otherwise 3.4.
- Anti: Mantine/Chakra (heavier, lock-in); Tailwind-only (wheel-reinvention for modals/dropdowns).

**Confidence:** HIGH.

---

## 4. Oracle / Price Feed

### Pyth Hermes (primary, Sui)

- **Pyth Network** for SOL, ETH, BTC + the dozen-ish other majors. Live on Sui mainnet since 2023.
- **Pull oracle model** via **Hermes**:
  1. Backend subscribes to Hermes WS (`hermes.pyth.network/v2/updates/price/stream`).
  2. Receives VAA-style signed price updates.
  3. On-chain: posts VAA via Pyth's update receiver Move module, then reads `price_info_object` in the same tx.
- **Latency:** Hermes WS sub-second; on-chain posting adds 1 Sui checkpoint (~250ms).
- **Staleness:** Use Pyth's `max_age` parameter on `get_price_no_older_than` (Move). Revert on stale.

### Switchboard (failover, Sui)

- **Switchboard On-Demand** — pull-based since 2024. Sui coverage. Layer as halt-on-divergence: backend computes |pyth - switchboard| / mid; if > 50 bps, halt entries until cleared.
- Satisfies the "dual-feed mitigates single-oracle failure" risk in STATE.md.

### Latency budget

- Pyth Hermes → backend: <100ms (WS).
- Backend slippage model: <5ms (Rust, in-memory).
- Backend → trader browser via WS: <100ms.
- **Total trader-perceived latency: ~200ms.** Better than typical retail CEX UI.

**Anti-recommendation:** Do **NOT** use Chainlink. Worse Sui coverage, push-only model wrong for this use case, more expensive on-chain.

**Confidence:** HIGH on Pyth + Switchboard failover.

---

## 5. Infrastructure

### Hosting

- **Frontend (trader app, admin app):** **Vercel** — Next.js native, zero-config edge, Preview deploys. ~$20/mo Pro tier covers v1.
- **Backend (risk-engine + api-gateway + indexer):** **Hetzner CCX dedicated VM** — CCX23 (~€30/mo) or CCX33 (~€60/mo) running Docker Compose. Dedicated vCPU, 16–32 GB RAM, NVMe.
  - Indexer is stateful, single-VM (per PROJECT.md). Hetzner is 4–8× cheaper than equivalent Fly/Railway.
  - Backup story (Hetzner snapshots + offsite via Backblaze B2) is simpler than wiring up managed Postgres.
- **Fly.io** is fine for a multi-region WS edge if latency from a single EU/US region becomes a problem (it won't, for 50–100 traders).
- Anti: AWS (too much surface area, IAM, expensive for team size).

**Confidence:** HIGH on Hetzner; MED on Vercel vs Cloudflare Pages.

### Database

- **Self-hosted Postgres 16 + TimescaleDB 2.15+** on the same Hetzner VM as the indexer for v1.
- Use **`timescale/timescaledb-ha:pg16`** Docker image.
- Hypertables for: `price_ticks`, `trade_events`, `equity_curves`. Continuous aggregates for: hourly P&L, daily DD per trader.
- **Backups:** `pgbackrest` to Backblaze B2; daily full + WAL archiving. Restore drill before beta opens.
- Anti: Neon (no TSDB extension); Supabase (overcoupled stack, no TSDB); RDS (5× cost, no TSDB on standard).
- **Phase 2 migration target:** Timescale Cloud managed if SPOF risk becomes unacceptable.

**Confidence:** HIGH.

### RPC Providers

- **Shinami** primary — best Sui-focused DX, Sponsored Transactions support (useful later for gasless evaluations).
  - Free tier likely sufficient for v1's ~6k tx/day traffic.
  - Paid tier ~$99/mo for higher throughput.
- Alternatives: Triton One Sui, QuickNode Sui, BlockVision (indexer-as-a-service — could replace self-hosted Sui indexer if team wants to deprioritize that build).
- Anti: public `fullnode.mainnet.sui.io` for the indexer — rate-limited, no SLA.

**Confidence:** MED on Shinami plan name; HIGH on paying for managed RPC.

### Observability

- **Sentry** — error tracking for Rust (sentry-rs) and TypeScript (FE + gateway). Free tier covers v1.
- **Grafana Cloud Free tier** — OpenTelemetry traces + Prometheus metrics + Loki logs. 50GB logs, 10k metrics, 14-day retention. Enough for v1.
- **BetterStack** — uptime checks on WS endpoint + dashboard, ~$20/mo.
- **OpenTelemetry** (`opentelemetry-rust`, `@opentelemetry/api`) → Grafana Cloud OTLP endpoint.
- Anti: Datadog/New Relic (overkill cost); Axiom for logs alone (Grafana Loki cheaper and bundled).

**Confidence:** HIGH.

---

## 6. Dev Tooling

### Monorepo

- **Turborepo 2.x** + **pnpm 9.x workspaces**.
- Layout (per STATE.md):
  ```
  contracts/sui/,
  services/risk-engine/ (Rust), services/api-gateway/ (TS),
  apps/trader/ (Next), apps/admin/ (Next),
  packages/shared/events/, packages/shared/contracts-abi/, packages/shared/slippage/
  ```
- Rust services live in a separate Cargo workspace (`services/Cargo.toml`); Turborepo orchestrates via task definitions.
- Anti: Nx (heavier, framework-y, lock-in); Bun workspaces (less ecosystem maturity).

### Linter / formatter

- **Biome 1.x or 2.x** for TS. One config, formatter + linter, very fast.
- **`rustfmt` + `clippy`** for Rust. `cargo clippy -- -D warnings` in CI.
- **`sui move fmt`** for Move.
- Anti: ESLint + Prettier (Biome 30-50× faster, near full parity in 2026).

**Confidence:** HIGH on direction; MED on Biome 1 vs 2.

### Testing

- **TS unit:** Vitest 1.x or 2.x. Co-located `*.test.ts`.
- **TS E2E:** Playwright. Full happy-path scenario on Sui.
- **Move tests:** `sui move test` + `test_scenario`.
- **Rust unit:** `cargo test`. For slippage model: **property-based tests via `proptest`** comparing on-chain Move output vs Rust reference impl.
- Anti: Jest (slower, weaker ESM).

**Confidence:** HIGH.

### CI/CD

- **GitHub Actions** workflows:
  - `ci-contracts-sui.yml`: cache `~/.move`, run `sui move build` + `sui move test`.
  - `ci-services.yml`: `cargo test --workspace` + `pnpm test` + `pnpm lint`.
  - `ci-frontend.yml`: `pnpm build` + Playwright.
- **Deployer:** GH Actions runs `cargo build --release`, ships binary via `rsync` to Hetzner; systemd restart. Or Docker Compose pull.
- Anti: CircleCI / BuildKite (GH Actions is free and integrated for this scale).

**Confidence:** HIGH.

---

## 7. Auth / Identity

### Trader auth — Sign-In-With-Wallet

- Backend issues nonce (UUID, 10-min TTL); frontend asks wallet to sign personal message (`useSignPersonalMessage` from `@mysten/dapp-kit`); backend verifies signature.
- No formal "SIWS-Sui" EIP yet but personal-message pattern is de facto standard.
- `traders` table keyed by Sui address.

### Session management

- **Iron Session** (`iron-session` npm) — stateless, encrypted-cookie sessions. ~15-min TTL with refresh.
- Reasons over alternatives:
  - JWT alone — theft mitigation is harder, rotation painful.
  - Lucia Auth — deprecated in 2024.
  - Better-Auth — promising but wallet-sign-in adapters still maturing. Use for v2.
  - Clerk / WorkOS for trader app — don't natively support wallet sign-in cleanly.
- Server-side, the verified Sui address is the only identity.

### Operator auth — separate path

- **Completely separate session domain** (different cookie scope, different DB tables).
- **WorkOS or Clerk** with **magic-link + WebAuthn passkey** (required, not optional). 1–3 operators; price is trivial; security gain high.
- Anti: shared session between trader + admin apps (privilege confusion risk). Different subdomains (`app.entrypoint.xyz` vs `admin.entrypoint.xyz`).
- **MFA mandatory:** TOTP minimum, WebAuthn preferred.
- Operator actions → `operator_audit_log` Postgres table (every PII read, allowlist mutation, pause action).

**Confidence:** HIGH on architectural split; HIGH on Iron Session + WorkOS/Clerk for admin.

---

## Reversibility Summary

| Decision | Reversibility | Notes |
|---|---|---|
| Sui Move framework branch | LOW friction | Just bump `rev` |
| **Event schema in `packages/shared/events/`** | **HIGH friction** | Touches contracts + indexer + frontend — get right week 1–2 |
| **RPC provider** | MED friction | Checkpoint cursor format is stable; vendor switch requires cursor migration |
| **Indexer architecture** | HIGH friction | Rewrite |
| DB host (Hetzner VM) | MED friction | Schema portable; backups need redoing |
| Postgres + TSDB choice | HIGH friction | Time-series schema hard to migrate to non-TSDB |
| **Oracle (Pyth Hermes)** | HIGH friction | Move adapter modules are non-trivial |
| Frontend framework (Next) | MED friction | Could swap to Vite + TanStack Router, but rewrites all routing |
| State (TanStack Query + Zustand) | LOW friction | Local to components |
| UI library (shadcn/ui) | LOW friction | Owned source |
| Chart library | LOW friction | Drop-in swap |
| Session (Iron Session) | LOW friction | Stateless cookie; swap with Better-Auth later |
| Operator auth | LOW friction | Single sign-in flow |
| Monorepo (Turbo + pnpm) | MED friction | Migration painful but mechanical |

---

## Open Questions / Verify Before Scaffolding

1. **Confirm exact Sui CLI version** — run `sui --version` against `mainnet` branch and pin via Suibase before scaffolding `Move.toml`.
2. **Confirm Next.js 15 vs 16** — prefer 16 if >2 months stable.
3. **Confirm Tailwind v4** stability — if still in RC, use 3.4.
4. **Confirm Privy Sui wallet pricing** if email-signin fallback is v1 scope.
5. **Confirm Switchboard On-Demand coverage on Sui mainnet** for exact pairs (flagged as STATE.md blocker).

## Confidence Assessment

| Area | Level | Reason |
|---|---|---|
| Smart contract toolchain (choice) | HIGH | Sui CLI is the only first-party option |
| Smart contract toolchain (version pins) | MED | Verify against live release notes before scaffolding |
| Backend language split | HIGH | Rust+TS split matches PRD's risk-engine performance need + founder's TS productivity |
| Indexer pattern (Sui) | MED | First-party indexer crate solid but evolving |
| Oracle | HIGH | Pyth dominance + Hermes pull model is settled |
| Hosting | HIGH | Hetzner + Vercel is cost-effective consensus |
| Frontend | HIGH | shadcn/Next15/TanStack Query is the dominant 2026 pattern |
| Wallet auth | HIGH | Mysten dapp-kit personal-message sign-in is documented best practice |
