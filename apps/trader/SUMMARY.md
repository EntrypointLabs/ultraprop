# Ultraprop Trader App — Build Summary

The crypto-native prop-firm trader app: a dark-only, Sui-native evaluation cockpit where traders
prove themselves on shadow capital, climb a tier ladder, and earn a non-transferable Genesis SBT.
The whole app currently runs on a deterministic **mock data layer** — no backend is wired yet, but
every hook is shaped to be swapped for a real WebSocket gateway + Sui contract reads.

- Framework: Next.js 15.5.19 (App Router, React 19), Tailwind v4, TypeScript (strict, `ignoreBuildErrors=false`)
- State/data: zustand (session + onboarding + divergence-halt), @tanstack/react-query (seeded query cache), mock hooks
- Charts/FX: lightweight-charts v5 (equity curve, dynamic `ssr:false`), canvas-confetti (pass screen)
- Build: `pnpm --filter @app/trader build` is **GREEN** (all routes prerender/compile, `tsc --noEmit` clean)

## How to run

```bash
# from repo root
pnpm install                       # if you haven't already
pnpm --filter @app/trader dev      # dev server on http://localhost:3000
pnpm --filter @app/trader build    # production build (type-checked)
pnpm --filter @app/trader start    # serve the production build
pnpm --filter @app/trader exec tsc --noEmit   # standalone type check
pnpm exec biome check apps/trader  # lint/format (repo-root biome)
```

Demo IDs that make every dynamic link resolve:
- vault: `vault_starter_001` (`DEMO_VAULT_ID`)
- wallet: `0x9a4f2c1e7b8d3056af19e2c4b7d8f0a1c3e5d7b9f1a2c4e6d8b0f2a4c6e8d0b2` (`DEMO_WALLET`)

## Route map

| Route | Type | Screen |
| --- | --- | --- |
| `/` | static | Home / markets — Genesis banner, active-eval or start-eval hero, BTC/ETH/SOL markets table, tier-ladder teaser |
| `/start` | static | Tier picker — Starter/Basic/Pro cards (Basic/Pro lock on SBT progress), waitlist state, sign-in + halt prompts |
| `/evaluation/[vaultId]` | dynamic | Eval cockpit — equity curve, 4 rule pills, drawdown gauge, daily-reset countdown, positions, trade history, trade-intent form |
| `/evaluation/[vaultId]/passed` | dynamic | Pass terminal — confetti, SBT level reveal, share card, final stats |
| `/evaluation/[vaultId]/failed` | dynamic | Fail terminal — violated-rule debrief, trigger trade, cohort comparison, retry/step-down CTAs |
| `/evaluation/[vaultId]/inactive` | dynamic | Inactive terminal — no-penalty auto-close explainer, snapshot, resume CTA |
| `/points` | static | Genesis/points — cohort hero + countdown, tier ladder, how-to-level-up, cohort activity, daily + weekly scores |
| `/leaderboard` | static | Leaderboard — cohort stats, axis/window toggles, top-3 podium, sortable table, mobile cards |
| `/profile/[wallet]` | dynamic | Profile — header + SBT card, stat grid, tier badges, evaluation history (all Sui-explorer-linked) |
| `/cohort` | static | Cohort explainer — what it is / what it proves, tier ladder, design principles, passes-by-tier, no-token disclosure |
| `/style` | static | Kitchen-sink QA reference for every UI primitive (foundation-owned, kept) |

Every nav link and CTA was traced to a real route; `/profile/${session.address}` links are all guarded
behind a signed-in check. A bogus path (`/nope-404`) correctly returns the 404 page.

## What shipped, per screen

- **Home / markets** (`components/markets/*`): Genesis cohort banner (members, pass rate, active evals),
  `ActiveEvalCard` (live equity + return %, profit-target & max-DD pills, Resume CTA) shown when the demo
  vault is active else `StartEvalHero` (brand-lime CTA -> `/start`), live markets table (oracle tick flash,
  24h %, volume, sparkline, feed dot, inline Long/Short -> `/start?symbol=&side=`, leverage badge),
  toolbar (segmented All/Crypto, favorites + live toggles, search), tier-ladder teaser.
- **Tier picker** (`components/tiers/*`): keyboard-operable tier cards, locked tiers gated on
  `useSbt().passedTiers`, selected-card ring, shadow-capital headline + stats block, waitlist state,
  sign-in / divergence-halt warnings. Server page with hero + "how it works".
- **Trade-intent form** (`components/trade/TradeIntentForm.tsx`, props `{ vaultId: string }`): symbol tabs
  with live oracle price, Long/Short, USD size + quick presets, **full slippage transparency** (oracle mid
  + size slippage bps + house **+2 bps tilt** that always worsens the fill = your fill + total cost),
  Pyth oracle tooltip/modal, submit disabled with banners (not signed in, halted, vault inactive, invalid
  size, 2s rate-limit with live countdown), optimistic confirmation flash.
- **Eval cockpit** (`components/evaluation/*`): async server page unwraps `params` -> client cockpit.
  `EquityCurve` (lightweight-charts v5 area series + DD-floor / profit-ceiling price lines, dynamic
  `ssr:false`), `RulePills` (4 live pills, each opens a rule modal), `DrawdownGauge` (radial), daily-reset
  countdown, `PositionsTable`, sortable/filterable `TradeHistory` with CSV export, embedded trade form.
- **Pass / fail / inactive terminals** (`components/terminal/*`): confetti + `SbtLevelReveal` + `ShareCard`
  on pass; `FailureDebrief` (violated rule, trigger trade with slippage/tilt, cohort comparison) on fail;
  no-penalty auto-close explainer on inactive. Local seeded fixtures overlay the demo vault into failed/
  inactive states without mutating shared mocks. Every on-chain item has a Sui-explorer link.
- **Points / Genesis** (`components/points/*`): outlined "GENESIS COHORT" hero with live reset countdown +
  4 stat tiles, tier ladder with active/passed/locked state, 4-step level-up guide, cohort activity,
  daily scores, 6-week history (current week PENDING).
- **Leaderboard** (`components/leaderboard/*`): cohort stat tiles, axis (tier/shadowPnl/passes/consistency)
  + window segmented controls, top-3 podium, sortable desktop table with axis-highlighted column, mobile
  cards. Links to `/profile/[wallet]`.
- **Profile** (`components/profile/*`): header (identicon, copy, ChainChip, explorer link, share), SBT card
  (deterministic level-reflecting SVG), stat grid, tier badges, evaluation history with per-row sparklines
  and Sui-explorer verify links.
- **Cohort** (`components/cohort/*`): editorial server sections + client stat/ladder sections, explicit
  **no-token / no-promise** disclosure.

## Design system

- **Tokens** (`app/globals.css`, Tailwind v4 `@theme`): semantic utilities only —
  `bg-bg / bg-surface / surface-2 / surface-3`, `border-border / border-soft`, `text-text / -muted / -faint`,
  `text-brand` (lime) + `brand-ink`, `bg-violet`, `text-up / down / warn / info`, `pill-safe/warn/danger`.
  Radii via theme (`rounded-sm/rounded/rounded-lg/full`), 14px base, dark-only (`.dark` on `<html>`).
  Helper classes: `.tabular` (all numerics), `.pixel-border`, `.pixel-banner`, `.flash-up/.flash-down`,
  `.live-pulse`. Violet focus ring + selection, reduced-motion handled.
- **Fonts**: `next/font/google` — Inter (`--font-inter`) sans, JetBrains Mono (`--font-mono-face`) for tabular.
- **Primitives** (`@/components/ui`, exercised on `/style`): Button, Card(+Header/Label/Content), Badge,
  Pill, StatTile, Modal/Dialog, Tooltip, Table(+Thead/Tbody/Tr/Th/Td), Tabs, SegmentedControl, Toggle,
  Input, Select, Skeleton, Countdown, Sparkline, RadialGauge, ConnectionDot, ChainChip, AssetIcon,
  Identicon/Avatar, PixelBanner.
- **Shell** (`@/components/shell`): Providers (react-query + store), TopNav, Footer, PixelTopBorder,
  OnboardingModal (first-visit, persisted dismissal), StaleFeedBanner (site-wide divergence-halt notice),
  StoreHydration, Logo, PagePlaceholder. Composed in `app/layout.tsx`.
- **Utils** (`@/lib/utils`): `cn` (tailwind-merge+clsx), `shortAddress`, `formatUsd`, `formatPct`, `formatNum`.

## Mock data layer (the backend seam)

All fixtures are seeded from `SEED_NOW` (1749312000000) and a `mulberry32` PRNG. **No `Date.now()` /
`Math.random()` at module eval or server render** — live jitter happens only inside client effects, so
SSR === first client paint (hydration-safe). Initial react-query data equals the seeded fixtures.

Hooks (`@/lib/mock/hooks`): `useSession`, `useDivergenceHalt`, `usePrices`/`usePrice`/`useMarkets`
(tick 1.5s), `useTiers`, `useVault`/`useEquityCurve` (tick 2s), `usePositions`, `useTradeHistory`,
`useSbt`, `useLeaderboard`, `useProfile`, `useCohort`/`useCohortStats`, `useConnection`. Plus the pure
`slippagePreview()` (`@/lib/slippage-preview`) and the raw zustand `useMockStore`.

### Where the real backend plugs in later

- **Price / oracle / connection** (`usePrices`, `usePrice`, `useMarkets`, `useConnection`,
  `useDivergenceHalt`): swap the client jitter interval for a **WebSocket gateway** subscription to the
  Pyth oracle feed. `useConnection` already models `live | reconnecting | stale`; wire it to socket state.
  `useDivergenceHalt` should be driven by a real oracle-divergence signal from the gateway, not the dev toggle.
- **Vault / equity / positions / rules** (`useVault`, `useEquityCurve`, `usePositions`, `useTradeHistory`):
  read from **Sui contract object reads** (vault object, position table) + indexer/WS for the equity curve.
  `RuleBudget` zones (`safe|warn|danger`) and the 4 rule kinds already match the on-chain rule set.
- **Trade submission** (`TradeIntentForm` + `slippagePreview`): `slippagePreview` mirrors the on-chain fill
  math (oracle mid + size slippage + fixed `TILT_BPS = 2`); submit currently optimistic-flashes. Replace
  with a Sui programmable transaction (intent -> fill) and reconcile via the WS fill event.
- **SBT / cohort / leaderboard / profile** (`useSbt`, `useCohort`, `useLeaderboard`, `useProfile`): read the
  Genesis SBT object + a leaderboard/cohort indexer. Explorer links already point at `suiexplorer.com`
  (object/txblock) — swap the network param when targeting testnet/mainnet for real.

## Build / lint / known gaps

- **Build**: GREEN. `pnpm --filter @app/trader build` compiles all routes; type check (`tsc --noEmit`) clean.
  Note: a stale `.next` cache can throw a spurious `Cannot find module './vendor-chunks/...'` at the
  page-data step after large in-place edits — `rm -rf apps/trader/.next` and rebuild clears it.
- **Lint**: repo uses **biome** at the root (the trader's `next lint` is unconfigured/deprecated). Safe and
  unused-import fixes were applied. Remaining ~16 findings are intentional/benign and non-blocking:
  - `noShadowRestrictedNames` (7): the foundation-defined `Symbol` mock type intentionally shadows the
    global and is used app-wide — deliberate API, not changed.
  - `noArrayIndexKey` (4): keys on static seeded lists that never reorder.
  - `noUnusedFunctionParameters` (3), `noExplicitAny` (1, lightweight-charts dynamic types),
    `noNonNullAssertion` (1, provably-present podium top-3).
- **Known gaps / next steps**:
  - No backend: every hook is mock-seeded (see seam above). Wallet connect is a mock `signIn`.
  - Divergence halt is a dev QA toggle (fixed bottom-left); replace with the real oracle signal.
  - Failed/inactive terminals use local overlay fixtures; real flows read the on-chain terminal state.
  - No automated tests yet; route coherence was verified by booting `next start` and curling every route
    (all 200, bogus path 404).

## Follow-up pass — auth, venue, Sui-only

Applied after the initial swarm:

- **Auth = Privy with Kalshi-style UX.** The nav "Sign in" and onboarding "Get started" now open
  `components/shell/LoginModal.tsx` — an email-first modal (email → 6-digit code) plus Continue with
  Google / Apple / X and "Continue with a wallet", footnoted "Protected by Privy · an embedded Sui
  wallet is created for you". It is mocked in the session/store layer (`loginOpen`/`openLogin`/
  `closeLogin` in `lib/mock/store.ts`); real Privy SDK wiring slots in here later. This supersedes
  the dapp-kit + Iron Session approach in `research/STACK.md §7`.
- **Trading venue transparency (Sui).** Modeled fills are routed through the **7K aggregator**
  (best of Cetus / Aftermath / Turbos / Kriya). `lib/slippage-preview.ts` exposes `VENUE` +
  `VENUE_ROUTE` and adds `venue`/`route` to `SlippagePreview`; `TradeRecord` carries `venue`. Surfaced
  in the trade ticket ("Fill preview · Pyth · 7K", a "Routed via 7K · 4 DEXes" row, venue in the oracle
  tooltip + info modal) and as a VENUE column in trade history (+ CSV).
- **Sui-only.** The UI is Sui-only. No chain toggle, no cross-chain badges; addresses are Sui-style.
  (The only "SOL" reference is the tradeable asset, a price market.)
