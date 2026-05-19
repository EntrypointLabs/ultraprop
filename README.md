# prop-firm

Crypto-native proprietary trading firm — v1 closed beta. A two-chain (Sui + Solana) paper-trading evaluation platform where invited traders prove themselves against live mainnet prices with a calibrated slippage and fill model. The platform smart contract is the only execution surface: it accepts trade intents, models fills deterministically, enforces drawdown / daily-loss / profit-target rules, and emits pass/fail events that mint or level a v1 cohort SBT.

Full vision, success criteria, scope decisions, and roadmap live in [`docs/plans/Crypto-Native/PROJECT.md`](docs/plans/Crypto-Native/PROJECT.md). Out-of-scope items are canonised in [`SCOPE-LOCK.md`](SCOPE-LOCK.md). Toolchain pins are tracked in [`VERSIONS.md`](VERSIONS.md).

## Quickstart

```bash
pnpm setup    # one-time: toolchain check, install, build shared layer, contracts if CLIs present
pnpm dev      # run every workspace concurrently — open whichever localhost you care about
```

Requires Node >=22 (LTS 24 recommended via `.nvmrc`), pnpm >=9, and Rust stable (channel pinned in `rust-toolchain.toml`). Chain-specific tooling (`sui`, `anchor`, `solana`) is needed only when working inside `contracts/`. Setup gracefully skips steps for CLIs you don't have installed — install them when you want to work on that workspace.

### Root scripts

| Script | What it does |
|---|---|
| `pnpm setup` | Toolchain check → `pnpm install` → build `@shared/*` TS packages → `cargo build --workspace` (if cargo) → `sui move build` (if sui CLI) |
| `pnpm dev` | Runs `predev` (re-runs setup if deps/shared packages missing), then `turbo run dev` (5 TS workspaces in watch mode) + `cargo watch` for the Rust workspace, streams merged with `[ts]` / `[rust]` prefixes |
| `pnpm build` | `turbo run build` — production builds with topological ordering |
| `pnpm typecheck` | `turbo run typecheck` across all TS workspaces |
| `pnpm lint` | `turbo run lint` + root-level `biome check .` |
| `pnpm test` | `turbo run test` + `cargo test --workspace` |
| `pnpm format` | `biome format --write .` |
| `pnpm check:toolchain` | Reports which optional CLIs are missing |
| `pnpm build:rust` | `cargo build --workspace` only |
| `pnpm build:contracts` | `sui move build` + (later) `anchor build` |
| `pnpm clean` | Removes `node_modules`, `dist`, `.turbo`, `.next`, `target`, `*.tsbuildinfo` everywhere |

## Workspace Layout

```
prop-firm/
├── apps/
│   ├── trader/                  # Trader dashboard (Next.js, Phase 3)
│   └── admin/                   # Operator dashboard (Phase 6)
├── services/
│   ├── risk-engine/             # Rust — Pyth Hermes WS, slippage model, indexer
│   └── api-gateway/             # TypeScript — WS fan-out + REST gateway (Phase 2)
├── packages/
│   └── shared/
│       ├── events/              # Cross-chain event schema (TypeBox + codegen, Phase 0.3)
│       ├── contracts-abi/       # Sui + Solana ABI bindings
│       └── slippage/            # Rust off-chain reference impl (Phase 1.3)
├── contracts/
│   ├── sui/                     # Sui Move evaluation contract (Phase 1)
│   └── solana/                  # Anchor port (Phase 4)
├── docs/
│   └── plans/Crypto-Native/     # PROJECT.md, STATE.md, ROADMAP.md, phases/
├── package.json                 # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json                   # Turborepo task graph
├── Cargo.toml                   # Rust workspace root
├── rust-toolchain.toml          # Pinned Rust channel + components
├── biome.json                   # TS lint + format
├── tsconfig.base.json           # Inherited by every TS workspace
├── .nvmrc / .editorconfig
├── VERSIONS.md                  # Live-verified toolchain pins
└── SCOPE-LOCK.md                # Hard-NO list for v1
```

Rust crates (`services/risk-engine`, `packages/shared/slippage`) are managed by the root `Cargo.toml` workspace, **not** the pnpm workspace. Every other workspace is TypeScript and listed in `pnpm-workspace.yaml`.

## Roadmap

See [`docs/plans/Crypto-Native/ROADMAP.md`](docs/plans/Crypto-Native/ROADMAP.md) for the phased plan. Phase 0 (this scaffold) clears the prerequisites so Phases 1 (Sui contracts), 2 (backend/indexer), 3 (trader app), and 4 (Solana port) can each drop into a ready workspace without re-scaffolding.
