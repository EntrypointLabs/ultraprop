# Trader Application — Platform Audit & Defect Backlog

Whole-application defect checklist for the **trader** app and its platform (auth, onboarding, trading cockpit, social/gamification, shell, the `apps/websites` marketing site, `apps/admin`, the `api-gateway`, `packages/shared/venues`, and the Sui contracts). Re-audited 2026-06 against the current branch (post-`main`-merge) via three code-level audits + targeted live verification. Severity tiers: 🔴 Blocker → 🟠 Major → 🟡 Minor → ⚙️ Config/failure-mode. Items marked **✅ Intentional v1 scope** are *not* defects.

Check items off as fixed. File refs are starting points (line numbers drift), not exhaustive. `[NEW]` = added in this re-audit.

## What changed since the last audit
The `main` merge was almost entirely cosmetic for the defect surface (copy + a new marketing site); the trader **core engine/feed/cockpit files were not changed**, so their defects persist unchanged.
- **Improved:** `MIN-5` — `/markets` breadth is no longer hardcoded to 3; it's now data-driven off the live feed (but see `MAJ-17` — it still never loads the catalog and shows 3 without the feed).
- **No fixes landed** for any blocker or major risk item.
- **New surfaces:** a real marketing site at `apps/websites/` (builds clean) and platform-wide copy now advertising multiple venues that aren't implemented.
- Added items: `MAJ-13`–`MAJ-17`, `MIN-14`–`MIN-25`.
- Note: a live browser re-walk drifted off-task this pass; behavioral claims for the unchanged trading core carry over from the prior live walkthrough. Re-running a focused live pass is available on request.

## The big picture
The app is **two disconnected stacks**: (1) a **real** Privy-auth + Sui on-chain onboarding flow (`/api/account`, `lib/sui/*`) that is **orphaned** — it never produces a vault that reaches the cockpit; and (2) the **paper-sim cockpit** (`lib/sim/*`) running on a single **hardcoded demo vault** (`vault_starter_001`). The cockpit renders well with live Hyperliquid data, but the **end-to-end trade loop is dead for a visitor** (the four blockers). Most social/marketing surfaces are seeded mock data presented as live, and copy now over-promises a multi-venue catalog that isn't built.

## App inventory
- **`apps/trader`** — the product. Functional UI; trade loop blocked end-to-end (see blockers).
- **`apps/websites`** — **real, functional single-page marketing site; builds clean** (not a stub). Defects are outbound-link only (`MAJ-14`, `MAJ-15`, `MIN-23`).
- **`apps/admin`** — **one-line placeholder stub** (`src/index.ts` = `PLACEHOLDER`). Intentional; not yet an app.
- **`services/api-gateway`** + **`packages/shared/venues`** — real (Hono indexer + HL WS/REST adapter); only Hyperliquid is implemented.

---

## System-flow alignment — vs `prop-firm-system-flow.excalidraw`
The repo-root system map defines an 8-stage journey (v1 paper app → v2 on-chain funded firm). The build matches it architecturally; the deltas below are the only places the implementation is *off* the intended flow.

| Stage (map intent) | Current state | On-flow? |
|---|---|---|
| 1 · Land & Auth — Privy OTP/OAuth + embedded Sui wallet | real & working | ✅ |
| 2 · Provision Account — `/api/account`→`openTradingAccount` (firm signs, eval fee), mints AccountCap (map: **WIRED ✓**) | on-chain call real, but routes to `/markets`, never the cockpit; provision-failure hangs | ⚠️ severed → `BLK-4`, `CFG-3` |
| 3 · Select Market — `useMarketCatalog()` `/api/catalog?venue=hl` + `openVenueFeed()` SSE→`markPx`, indexer-fronted | built exactly so; `/markets` never loads the catalog, feed stale-oscillates | ⚠️ → `MAJ-17`, `BLK-2` |
| 4 · Place Trade — `TradeIntentForm`→`submitOrder`→`applyFill()` (4.5bps taker) | built & fidelity matches; visitor can't submit, no margin check | ⚠️ → `BLK-1`, `MAJ-2` |
| 5 · Evaluate — `recompute`/`accrueFunding`+fees/`evaluateRules`/`detectOutcome` | built; rules-based eval matches | ✅ |
| 6 · Pass/Fail (map: APP-ONLY, no on-chain handoff) — `detectOutcome`→`/passed`\|`/failed` | `/passed` real; `/failed` fabricates data; `/inactive` unreachable | ⚠️ → `MAJ-6`, `MAJ-7` |
| "Handoff gap" → `promote()`/`withdraw_for_trading()` | not built (map says so) | ✅ intended (v2) |
| 7 · Funded (v2) / 8 · Payout (v2) — on-chain `promote`→`withdraw_for_trading`, `accrue_payout`→`claim` | not built in the app (map says so) | ✅ intended (v2) |

**Off-flow divergences (the only real flow breaks):** `BLK-4` (provision→cockpit severed; account orphaned), `MAJ-6` (failed screen ignores `detectOutcome`), `MAJ-13` (multi-venue copy vs the map's Hyperliquid-only stage 3). Everything else in this doc is a quality/UX defect *within* a stage, not a flow-structure break. The map confirms the funded + payout halves and the executor-driven on-chain risk gates are **intentionally v2 / not built** — those are not defects.

---

## 🔴 Blockers — the trade loop is dead end-to-end
- [x] **BLK-1 — A visitor can't reach a tradeable cockpit.** Originally framed as "auth gates trading" — but **auth-gating is correct**: an evaluation must be identity-attributable, so trading *should* require a session. The genuine blocker was that the *authenticated* flow never reached a tradeable vault — that's **BLK-4**. → `TradeIntentForm.tsx`, `EvaluationCockpit.tsx`, `lib/auth.ts`. **✓ Resolved (Wave 1):** auth is **required to trade on every vault**; the authenticated per-user vault (BLK-4) is the real unblock. The earlier guest bypass was testability-driven (a wrong product call) and is now demoted to a dev/test-only flag `DEMO_TRADING_ENABLED` (`NEXT_PUBLIC_DEMO_TRADING`, **off by default**) so the loop stays exercisable in headless without shipping anonymous trades. The demo vault is a **read-only preview** for signed-out visitors (seeded tabs render; the order form shows "Sign in to trade"). ⚠️ On-chain trade recording is still **not wired** (`log_trade` event-only, no live caller — v2/executor, see `CON-*`): auth gives in-app identity, not the on-chain record.
- [x] **BLK-2 — Stale-feed banner oscillates, intermittently suspending trading.** Status→`stale` on any 15s gap (incl. the initial reconnect window); `setDivergenceHalt(status==="stale")` then gates the form; no live→stale-only guard. → `apps/trader/lib/feed/venueFeed.ts`, `apps/trader/lib/mock/hooks.ts`, `components/shell/StaleFeedBanner.tsx`. **✓ Fixed (Wave 1):** `everLive` latch (never stale on cold start) + halt set only on a live→stale transition (cleared on live; reconnecting leaves it). Oscillation gone (live-confirmed). Recovery now drives its own 3s reconnect instead of EventSource native backoff — **live-confirmed ~4s** after gateway restart (was >30s).
- [x] **BLK-3 — Demo vault's seeded data is wiped on mount; cockpit always starts empty.** `startEvaluation()`→`freshVault()` overwrites `DEMO_POSITIONS/TRADES/EQUITY_CURVE`. → `apps/trader/lib/sim/usePaperEngine.ts`, `apps/trader/lib/sim/store.ts`. **✓ Fixed (Wave 1):** `buildVault` routes the demo vault to `seededDemoVault()` (positions/trades/equity from fixtures, reconciled realized total), idempotent so reloads don't clobber. Positions + trades render (live-confirmed). Also fixed an exposed chart crash: the equity curve now coalesces same-second ticks so lightweight-charts renders it instead of blanking (unit-test-locked).
- [x] **BLK-4 — Onboarding never reaches the cockpit; tier choice is cosmetic.** `TierGrid.handleStart` hard-navigates everyone to `DEMO_VAULT_ID`; the engine always runs `TIERS[0]` (Starter). → `apps/trader/components/tiers/TierGrid.tsx`, `apps/trader/lib/sim/usePaperEngine.ts`, `lib/auth.ts`, `app/evaluation/[vaultId]/page.tsx`. **✓ Fixed (Wave 1):** selected tier carried via `?tier=` and applied at vault creation; signed-in → per-user `userVaultId(session.address)`, signed-out → demo vault. Per-user-vault tier-carrying + the demo-vs-per-user auth split are **live-confirmed** via direct nav (starter 10×/$10k, basic 8×/$25k, pro 8×/$50k; non-demo vaults show the sign-in wall, demo doesn't). Only completing a real Privy OTP login is unexercised (auth infra, not BLK-4 logic). Minor follow-up: no explicit tier *label* in the cockpit (tier shows only via the leverage/equity/target params).

---

## 🟠 Major

### Trading engine & risk
- [x] **MAJ-1 — Liquidation is display-only; it never closes a position.** `detectOutcome` checks bust/target/drawdown/daily-loss only; no mark-vs-liq close. → `apps/trader/lib/sim/engine.ts:177-205`, `store.ts:198-213`. **Flow note:** the system map's v1 evaluation is rules-based (drawdown/daily-loss/target), *not* position-liquidation — so this is a venue-fidelity gap, not a break in the intended eval flow; effective priority is lower than its tier implies.
- [x] **MAJ-2 — No free-margin / collateral check on submit.** Only `sizeUsd>0` + leverage clamp; positions can far exceed equity. → `apps/trader/lib/sim/store.ts:317-339`.
- [~] **MAJ-3 — Partial close (now) + order types (deferred to spec).** **Per product, positions are INDEPENDENT by design — NO netting/averaging:** each trade is its own position with a unique id, direction, leverage, size, and its OWN drawdown, so the current "new position per submit" behavior is CORRECT, not a defect. **Partial close** is being added (Wave 5c) so close is no longer forced all-or-nothing. **TP/SL/limit/stop → a dedicated `orc:spec`** run after the defect fixes. → `apps/trader/lib/sim/store.ts`, `PositionsTable.tsx`.
- [x] **MAJ-4 — Leverage slider doesn't change the cross-mode liquidation price** (only isolated). → `apps/trader/lib/sim/engine.ts` (`liquidationPrice`), `TradeIntentForm.tsx:512-520`.

### Live data & feed
- [x] **MAJ-5 — 24h range always "—" and 24h change% stuck at seed values.** `MarkTick` carries no `change24h/high24h/low24h`; HL `prevDayPx` is discarded; `mergeMarks` hardcodes them `null`. → `packages/shared/venues/src/hyperliquid.ts:198-214`, `apps/trader/lib/mock/hooks.ts:178-215`.
- [x] **MAJ-17 — [NEW] `/markets` never loads the ~179-market catalog and has no search/filter.** The table renders `usePrices()` (seeded with 3) and never consumes `useMarketCatalog()`/`/api/catalog`; if the feed is slow/down it permanently shows 3 rows, contradicting the "full ... perpetual catalog" copy. No search input is rendered despite `MarketsTable` supporting one. → `apps/trader/components/home/HomeMarketsTable.tsx:11,32-37`, `apps/trader/lib/mock/hooks.ts:199-214`. (Supersedes the breadth half of `MIN-5`/`CFG-2`.)

### Terminal states
- [x] **MAJ-6 — `failed` screen shows fabricated numbers, not the real vault** (`equity = start*0.892`, fake trigger trade, `violatedRule:"drawdown"` always). → `apps/trader/app/evaluation/[vaultId]/failed/page.tsx:29-58`.
- [x] **MAJ-7 — `/inactive` route is unreachable** — no code path ever sets status to `"inactive"`. → `apps/trader/lib/sim/store.ts`, `types.ts:9`.

### Chart & input
- [x] **MAJ-8 — Candle chart blanks silently if the gateway/HL is down** (swallowed fetch error, no error/empty/loading state). → `apps/trader/components/charts/HLCandleChart.tsx:225-235`.
- [x] **MAJ-9 — Market selector keyboard nav broken** — `onKeyDown` only on the search input; Escape/Enter dead once focus enters the list. → `apps/trader/components/evaluation/MarketSelector.tsx:330-355`.
- [x] **MAJ-10 — Continuous console warning loop from the chart** (`autoSize:true` + manual ResizeObserver `applyOptions({width})`). → `apps/trader/components/charts/HLCandleChart.tsx:104-110,168-180`.

### Navigation & links
- [x] **MAJ-11 — `/docs` nav link 404s** (verified: link present, no route). → `apps/trader/components/shell/TopNav.tsx:18`.
- [x] **MAJ-12 — `/start` deep-links silently drop `?symbol=`/`?side=`.** `/start` never reads `useSearchParams`; intent is discarded. Now triggered from THREE places: `AssetSpotlight.tsx:120,125` and **(new)** the whole markets table `MarketsTable.tsx:58-59,247,256`. → `apps/trader/app/start/page.tsx`, `components/tiers/TierGrid.tsx`.

### Truthfulness & trust
- [x] **MAJ-13 — Multi-venue copy ("Bluefin, DeepBook & Hyperliquid") — RETAINED by product decision (won't-fix).** Originally flagged as advertising not-yet-implemented venues, but per product this copy is **intentional/aspirational and stays**. An earlier wave's partial removal was **reverted**. Not a defect to action — noted only that the build serves the Hyperliquid catalog today. (Copy/label/framing items `MIN-4`, `MIN-10`, `MIN-18`, `MIN-24` are likewise deprioritized — the focus is functionality, not wording.)
- [ ] **MAJ-14 — [NEW] Marketing site legal links 404.** `/terms`, `/privacy`, `/media-kit` are linked but no routes exist (only `app/page.tsx`). Compliance-sensitive for a financial product. → `apps/websites/app/page.tsx:53-57,209-219`.
- [ ] **MAJ-15 — [NEW] Marketing site primary CTAs point to unlaunched subdomains.** Hero/header/columns link `https://app.ultraprop.xyz` and `https://docs.ultraprop.xyz`; if those aren't deployed, every meaningful CTA dead-ends. → `apps/websites/lib/links.ts:3-4`, `apps/websites/app/page.tsx`.
- [x] **MAJ-16 — [NEW] Leaderboard "This Cohort / All-time" window toggle is inert.** `window` is passed to `useLeaderboard` but never read; both segments return identical rows. → `apps/trader/app/leaderboard/page.tsx:70-75`, `apps/trader/lib/mock/hooks.ts:379`.
- [x] **MIN-9 (trust-sensitive; consider Major) — "Verify on-chain" links resolve to nothing.** Profile + cohort "Verify ↗" links use the dead `suiexplorer.com` host with fabricated/invalid IDs, under copy claiming independent verifiability. → `ProfileHeader.tsx:15`, `SbtCard.tsx:122`, `EvaluationHistory.tsx:80,153`, `components/cohort/WhatItProves.tsx:135-141`.

---

## 🟡 Minor
- [x] **MIN-1 — No "reconnecting" warning;** the sim marks PnL against frozen seed prices during the first ~15s with no signal. → `StaleFeedBanner.tsx:13-16`.
- [x] **MIN-2 — Header leverage badge shows the tier/market cap, not the selected leverage.** → `EvaluationCockpit.tsx` (MarketStrip badge).
- [x] **MIN-3 — Size input not clamped to its "Max: $X" label.** → `TradeIntentForm.tsx`.
- [ ] **MIN-4 — "Your fill" colored red for longs / green for shorts** (worse-than-mid logic reads as inverted). → `TradeIntentForm.tsx:820-840`.
- [x] **MIN-5 — Markets breadth no longer hardcoded to 3** (now data-driven). Residual breadth/copy issues moved to `MAJ-17`.
- [x] **MIN-6 — Auth theater:** signup "create a password" step is inert (Privy is passwordless); login password decorative; allowlist gate faked (`allowlisted:true`) while copy claims a closed beta (`WaitlistState` is dead code). → `SignupFlow.tsx:181-218`, `LoginFlow.tsx:182-192`, `apps/trader/lib/mock/hooks.ts:68`.
- [x] **MIN-7 — TopNav balance pill** shows hardcoded `$0` with a chevron but no dropdown handler (inert). → `TopNav.tsx:72-83`.
- [x] **MIN-8 — Six dead `href="#"` footer links** (Report-a-bug, Terms, Privacy, Discord, X, Docs). → `Footer.tsx:46,50,53,57,60,63`.
- [ ] **MIN-10 — `/points` renders a "Genesis Cohort" page** (near-duplicate of `/cohort`); no points/token system exists — the nav label is a misnomer. → `app/points/page.tsx`, `components/points/GenesisHero.tsx:38-40`, `TopNav.tsx:17`.
- [x] **MIN-11 — "SIM HALT" dev button visible to all users** (renders whenever the feed isn't stale; no env/role guard). → `StaleFeedBanner.tsx:14-26`.
- [x] **MIN-12 — Cockpit responsiveness — verified, no fix needed.** On inspection the cockpit already uses responsive primitives (flex-wrap market strip, `overflow-x-auto` tables, `grid-cols-1` stacking — 36 responsive utilities) and renders cleanly at 768px (live-confirmed). The original "collapses <768px" was a carryover assumption, not a reproduced break. A 375px pixel-polish pass is an optional low-priority follow-up (mobile trading is niche here). → `EvaluationCockpit.tsx`.
- [x] **MIN-13 — Discovery dead-end:** no path from home/`/start`/`/markets` to the cockpit; `/onboarding` redirects signed-out users to the login modal. → `onboarding/page.tsx`, `CreateAccountFlow.tsx:46`.
- [x] **MIN-14 — [NEW] Auth-screen Terms/Privacy are dead `href="#"`** (and bare non-link `<span>`s in the login modal). → `AuthShell.tsx:107,114`, `LoginModal.tsx:90-91`.
- [x] **MIN-15 — [NEW] "Forgot password?" link is dead and nonsensical on a passwordless OTP flow.** → `LoginFlow.tsx:195-200`.
- [x] **MIN-16 — [NEW] OnboardingModal "Learn more" is a no-op** (just closes the modal, no destination). → `components/shell/OnboardingModal.tsx:43`.
- [x] **MIN-17 — [NEW] Leaderboard "Trades" column is a fabricated formula** (`passes*12 + consistency/5`), presented as a real trade count. → `LeaderboardTable.tsx:210`.
- [ ] **MIN-18 — [NEW] False "live" chrome over static seed data:** `CohortActivity` hardcodes `<ConnectionDot status="live" />`; `CohortStatsStrip` labels frozen numbers "Live"/"real-time". → `components/points/CohortActivity.tsx:22`, `components/cohort/CohortStatsStrip.tsx:14,31,78`.
- [x] **MIN-19 — [NEW] Leaderboard body sorts by `rank` independently of the page axis** (header highlight disagrees with sort until clicked). → `LeaderboardTable.tsx:67-106`.
- [x] **MIN-20 — [NEW] `GenesisBanner` & `StartEvalHero` are orphaned dead components** (never mounted; `/markets` renders only `HomeMarketsTable`); `GenesisBanner` also links "View cohort" → `/points`. → `components/markets/{GenesisBanner,StartEvalHero}.tsx`, `GenesisBanner.tsx:61`.
- [x] **MIN-21 — [NEW] Favorites are ephemeral & component-local** (`new Set(["BTC"])` per component, reset on nav/reload). → `HomeMarketsTable.tsx:11`.
- [ ] **MIN-22 — [NEW] Marketing footer minutiae:** unused `lucide-react` dep; dead `links.blog` export; Discord/Telegram rendered as inert "Soon" spans despite real URLs; "Protocol Explorer" inert. → `apps/websites/package.json:18`, `apps/websites/lib/links.ts:5-8`, `apps/websites/app/page.tsx:39,47-48`.
- [x] **MIN-23 — Sui address-casing — SUPERSEDED by the de-crypto direction.** Per product, wallet addresses are being hidden in favor of human-readable account handles (e.g. `rabbit_mx`), so the displayed-address casing concern is moot. Internal read/write stay consistently lowercased. (Handles work in Wave 5c; real SuiNS naming is a future option.)
- [ ] **MIN-24 — [NEW] Leaderboard legend omits the "Passes" axis** it offers as a control. → `app/leaderboard/page.tsx:128-141`.

---

## ⚙️ Config / failure-mode landmines
- [x] **CFG-1 — `GATEWAY_URL` defaults to `http://localhost:8787`; gateway PORT hardcoded.** Any deploy without the env → catalog/feed/candles fail, feed never goes live, chart blanks. The new `vercel.json` only sets the build command — it does **not** inject `GATEWAY_URL`. → `apps/trader/next.config.ts:16`, `services/api-gateway/src/index.ts`, `apps/trader/vercel.json`.
- [x] **CFG-2 — Catalog fetch failure silently degrades to the 3-market seed** with no surfaced error. → `apps/trader/lib/mock/hooks.ts:145-165`.
- [x] **CFG-3 — Wallet auto-provisioning failure strands onboarding forever.** Fire-and-forget `createWallet` with no failure branch and effect deps that never change → "Preparing your account…" with the CTA disabled permanently, no retry/error. → `SuiWalletGate.tsx:20-30`, `CreateAccountFlow.tsx:55-70,118-128`.

---

## ✅ Intentional v1 scope (NOT defects)
- Paper-only, no real custody/orders ("Simulated · No real funds").
- **Authenticated paper trades are NOT yet recorded on-chain.** `log_trade`/`pass_evaluation` are event-only with no live caller — the sim→on-chain attribution is the v2/executor path (`CON-*`). Auth establishes the trader's in-app identity; the on-chain trade record is a separate, still-open piece. (Trading requires auth; the demo vault is a read-only preview, with a dev/test-only `DEMO_TRADING_ENABLED` bypass that is off in production.)
- Privy email-OTP + Google/Apple OAuth are real and server-verified; `/api/account` + Sui `openTradingAccount` are real (firm-signed, idempotent, env-gated, JWT-verified). Theme/settings/account-menu/sign-out all work.
- Hyperliquid gateway/adapter are real (WS+REST, reconnect/backoff). Bybit adapter throws "not implemented"; Bluefin/DeepBook are unbuilt (advertising them is `MAJ-13`).
- Leaderboard / points / cohort are seeded fixtures; **`buildProfile` returns the same demo profile for any wallet** (the account tab mixes real Privy identity with mock history — note for later).
- Sim vault state **is** persisted (zustand `persist`).
- `apps/admin` is a one-line placeholder stub.
- `apps/websites` is a real, clean-building marketing site (its only defects are outbound links: `MAJ-14`/`MAJ-15`/`MIN-22`).
- `Market.onlyIsolated` defaults `false` (not sourced from HL) — force-isolated markets are tradeable in cross mode.
- `/style` is an unlinked component-gallery dev route.
- `sui move build` not yet run in this environment — **Phase 5 Move edits need a compile-confirm on a sui-CLI machine.**

---

## ⛓️ Contract / v2-spec divergences (on-chain — outside the app audit)
Surfaced by the system map's divergence box and the v2 PRD (`contracts/sui/PRD.md`). These are Move-contract concerns, not app defects — tracked here so the whole system is on one list. All are **v2 scope** unless the plan changes.
- [ ] **CON-1 — `AccountCap` is transferable (`has store`); the v2 spec wants it soulbound / non-transferable** (the trader's durable passport). → `contracts/sui/sources/accounts.move`.
- [ ] **CON-2 — Starter profit split seeded 80/20; spec says 75/25.** → `contracts/sui/sources/constraints.move` / `tier_config`.
- [ ] **CON-3 — Eval state is mutated in place via `reactivate()`/`promote()`; spec wants a fresh `TradingAccount` object per attempt.** → `accounts.move`.
- [ ] **CON-4 — First-payout eval-fee refund: not implemented.** → `treasury`.
- [ ] **CON-5 — Multisig `VaultCap` gate on payouts: not implemented.**
- [ ] **CON-6 — On-chain evaluation time-limit: open question / unspecified.**
- [ ] **CON-7 — `propfirm.move` is still an empty stub.**

---

## Recommended fix order
1. **Unblock the trade loop:** demo/guest mode so paper orders submit (`BLK-1`) + stop wiping the demo vault (`BLK-3`) + fix stale-banner oscillation / don't suspend during reconnect (`BLK-2`).
2. **Make risk real:** liquidation actually closes positions + free-margin check (`MAJ-1`, `MAJ-2`).
3. **Connect onboarding → a real per-user vault; make tier choice mean something** (`BLK-4`, `MIN-13`).
4. **Stop over-promising:** remove/qualify the multi-venue & "live" claims (`MAJ-13`, `MIN-18`); load the real catalog into `/markets` (`MAJ-17`); fix the inert leaderboard toggle (`MAJ-16`).
5. **Truth & links:** real `failed` data (`MAJ-6`), reachable `/inactive` (`MAJ-7`), `/docs` + deep-link + dead-link cleanup (`MAJ-11`, `MAJ-12`, `MIN-8/14/15`), verifiable on-chain links (`MIN-9`).
6. **Robustness & launch:** gateway-URL prod guard (`CFG-1`), chart empty-state (`MAJ-8`), keyboard nav (`MAJ-9`), autoSize warning (`MAJ-10`), marketing legal/CTA links (`MAJ-14`, `MAJ-15`).

---

## 🤖 Agent brief — paste this to one-shot the fixes
Hand the fenced block below to a fresh agent (or orchestrator). It is self-contained and assumes this `DEFECTS.md` + `prop-firm-system-flow.excalidraw` are at the repo root.

```text
You are fixing defects in the Ultraprop trader app (a paper-trading prop firm). SOURCE OF TRUTH: before editing anything, read DEFECTS.md (defect IDs + file refs + severity) and prop-firm-system-flow.excalidraw (the intended 8-stage flow) at the repo root. Your goal: make the app walk stages 1->6 of that map end-to-end for a user, and clear the defect list in priority order.

ARCHITECTURE YOU MUST RESPECT (do not break these):
- Monorepo seam: apps/trader (Next.js) calls same-origin /api/* which next.config rewrites() proxies to the Hono gateway (services/api-gateway). The gateway is the ONLY caller of Hyperliquid. The browser must NEVER hit api.hyperliquid.xyz directly.
- The ["prices"] React Query cache has a SINGLE writer (openVenueFeed SSE -> mergeMarks). Keep that contract: change the writer, never add a second one and never change the key or its readers.
- lib/sim/engine.ts is PURE (no Date/Math.random/IO). The clock + account aggregation live in store.recompute. Keep it pure; add/extend tests in the vitest island (lib/sim/*.test.ts).
- Price purpose split: markPx = PnL/equity/liq/display, midPx = fills, oraclePx = funding basis. Never swap them.
- SCOPE IS PAPER-ONLY v1. Do NOT build the funded/payout (v2) halves and do NOT wire the sim to on-chain log_trade/pass_evaluation — the system map marks those intentionally-not-built. The CON-* contract items are out of scope unless explicitly asked.

CONVENTIONS: no Zod (manual narrowing + instanceof Error); Biome 2-space; WHY-only comments; single-line Conventional Commit subjects with NO Co-Authored-By / no body. Do NOT commit unless told to.

WORKING LOOP: do it in the waves below. After each wave run `pnpm --filter @app/trader typecheck && pnpm --filter @app/trader build && pnpm --filter @app/trader test`. For any UI change, boot both servers — `pnpm --filter @service/api-gateway dev` (port 8787) and `GATEWAY_URL=http://localhost:8787 pnpm --filter @app/trader dev` (port 3000) — and verify in a browser. Check each item off in DEFECTS.md as you finish it.

WAVE 1 — unblock the trade loop (the four blockers):
- BLK-1: add a demo/guest mode so paper orders submit without a Privy session in the demo vault (remove the auth gate for the demo vault only).
- BLK-3: stop startEvaluation() wiping the demo fixtures — pre-populate the demo vault from DEMO_POSITIONS/DEMO_TRADES/DEMO_EQUITY_CURVE (or skip the freshVault overwrite for the demo vault id).
- BLK-2: only flip divergenceHalt on a confirmed live->stale transition; do NOT suspend the form during the initial "reconnecting" window; confirm SSE frames aren't buffered through the rewrite (heartbeat already exists on the gateway).
- BLK-4: carry the selected tier + a real per-user vault id from onboarding into the cockpit instead of the hardcoded demo vault.

WAVE 2 — make risk real & faithful:
- MAJ-2: free-margin/collateral check on submit. MAJ-1: liquidation actually closes a position (lower priority — the map's eval is rules-based). MAJ-4: cross-mode liq must respond to the leverage slider.

WAVE 3 — truth & terminal states:
- MAJ-6: /failed reflects the real vault / detectOutcome. MAJ-7: make /inactive reachable. MAJ-13 + MIN-18: remove/qualify the multi-venue "Bluefin/DeepBook" + "live" claims (v1 is Hyperliquid-only per the map). MAJ-16: wire the leaderboard window toggle. MAJ-17: load the real catalog into /markets + add search.

WAVE 4 — data, chart, links, config:
- MAJ-5 (carry change24h/range on MarkTick from prevDayPx), MAJ-8 (chart empty/error state), MAJ-9 (selector keyboard nav), MAJ-10 (autoSize warning), MAJ-11/MAJ-12 + MIN-8/14/15 (dead/404 links + /start deep-link params), MIN-9 (real explorer URLs), CFG-1/2/3 (gateway-URL prod guard, catalog error surface, wallet-provision failure + retry), and the apps/websites link defects (MAJ-14/15, MIN-22).

FINISH: verify a user (real or demo) walks stages 1->6 of prop-firm-system-flow.excalidraw end-to-end. Report what changed per defect ID and anything deferred. This is a large scope — if you can't finish, stop at a green wave boundary and report progress; do not leave the build broken.
```
