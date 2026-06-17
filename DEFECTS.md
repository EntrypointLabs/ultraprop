# Trading Platform — Defect Backlog & Audit

Status checklist of known defects in the **trader** paper-trading app, from a full live browser walkthrough + code-level audit (2026-06). Severity tiers: 🔴 Blocker → 🟠 Major → 🟡 Minor → ⚙️ Config/failure-mode. Items marked **✅ Intentional v1 scope** are *not* defects — listed so they aren't mistaken for bugs.

Check items off as they are fixed. File refs are starting points, not exhaustive.

## The big picture
The app is **two disconnected stacks**:
1. A **real** Privy-auth + Sui on-chain onboarding flow (`/api/account`, `lib/sui/*`) — genuinely built, but **orphaned**: it never produces a vault that reaches the trading cockpit.
2. The **paper-sim cockpit** (`lib/sim/*`) that runs on a single **hardcoded demo vault** (`vault_starter_001`).

The cockpit renders well with live Hyperliquid data, but the **end-to-end trade loop is effectively non-functional for a visitor** because of the four blockers below (auth gate, stale-feed oscillation, wiped demo fixtures, no path in). Most social/onboarding surfaces are seeded mock data presented as if live.

---

## 🔴 Blockers — the trade loop is dead end-to-end
- [ ] **BLK-1 — Cannot place a trade: auth gates paper trading.** Every visitor sees "Sign in to trade" and the submit button is permanently disabled; no demo/guest bypass even though it's paper money. The whole order→position→close loop is unreachable without a live Privy session. → `apps/trader/components/trade/TradeIntentForm.tsx` (disable chain ~L553).
- [ ] **BLK-2 — Stale-feed banner oscillates, intermittently suspending trading.** Feed starts `"reconnecting"`, the 15s silence timer trips to `"stale"` (sets `divergenceHalt`), and flips every ~15–30s, locking the order form. Root causes: (a) SSE frames appear buffered/clumped through the Next.js dev rewrite proxy; (b) the FE suspends trading during the initial reconnect window. Fix: only go stale on a confirmed live→stale transition, don't gate the form while `reconnecting`, and ensure true SSE pass-through. → `apps/trader/lib/mock/hooks.ts` (`useVenueFeed`), `apps/trader/lib/feed/venueFeed.ts`, `apps/trader/components/shell/StaleFeedBanner.tsx`.
- [ ] **BLK-3 — Demo vault's seeded data is wiped on mount; cockpit always starts empty.** `usePaperEngine` calls `startEvaluation()` → `freshVault()`, overwriting seeded `DEMO_POSITIONS`/`DEMO_TRADES`/`DEMO_EQUITY_CURVE`. Result: Positions = "No open positions", Trade history empty, Account equity curve = blank canvas, every session. Fix: pre-populate the demo vault from fixtures on first `startEvaluation`, or skip the overwrite for the demo vault. → `apps/trader/lib/sim/usePaperEngine.ts:40-44`, `apps/trader/lib/sim/store.ts` (`freshVault`).
- [ ] **BLK-4 — Onboarding never reaches the cockpit; tier choice is cosmetic; no nav path in.** Real Sui account flow routes to `/markets`, never a vault; the only "Start" path hard-navigates everyone to the one shared demo vault and always runs the **Starter** tier regardless of selection. There is **no nav link** from home/markets to the cockpit. → `apps/trader/components/.../TierGrid.tsx:41-42`, `apps/trader/lib/sim/usePaperEngine.ts:10,45`, `CreateAccountFlow.tsx:50,68`.

---

## 🟠 Major — trading engine & data correctness
- [ ] **MAJ-1 — Liquidation is display-only; it never closes a position.** Liq price + margin ratio are computed and shown, but nothing compares mark→liq to actually liquidate; positions can blow far past liq and keep marking unrealized PnL. → `apps/trader/lib/sim/store.ts:198-213`, `apps/trader/lib/sim/engine.ts` (`detectOutcome`).
- [ ] **MAJ-2 — No free-margin / collateral check on submit.** Only `sizeUsd>0` and the leverage cap are validated; positions can far exceed account equity. → `apps/trader/lib/sim/store.ts:313,320`.
- [ ] **MAJ-3 — No position netting / partial close / order types.** Same-symbol orders stack as independent positions (no averaging); close is all-or-nothing at mark; no TP/SL, limit, or stop orders. → `apps/trader/lib/sim/store.ts:369`, `PositionsTable.tsx:106`.
- [ ] **MAJ-4 — Leverage slider doesn't change the cross-mode liquidation price.** 1× and 6× show the same cross liq (slider only affects isolated). Misleads on cross-margin risk. → `apps/trader/components/trade/TradeIntentForm.tsx:524-545`.
- [ ] **MAJ-5 — 24h range always "—" and 24h change% stuck at seed values.** `MarkTick` carries no `high24h`/`low24h`/`change24h`; the HL adapter discards `prevDayPx`, so `mergeMarks` never updates them. Fix: add `change24h` (from `prevDayPx`) to `MarkTick` and merge it; decide a source for high/low. → `packages/shared/venues/src/hyperliquid.ts` (ctx→MarkTick), `apps/trader/lib/mock/hooks.ts` (`mergeMarks`).
- [ ] **MAJ-6 — `failed` terminal screen shows fabricated numbers, not the real vault.** Hardcoded `equity = start*0.892`, a fake trigger trade, and `violatedRule: "drawdown"` regardless of the actual outcome. (The `passed` screen is correct.) → `apps/trader/app/evaluation/[vaultId]/failed/page.tsx:29-57`.
- [ ] **MAJ-7 — `/inactive` route is unreachable.** `inactiveAt` is written but no code path sets status to `"inactive"`; the whole terminal screen is dead. → `apps/trader/lib/sim/store.ts:273,373,418`.
- [ ] **MAJ-8 — Candle chart blanks silently if the gateway/HL is down.** History-fetch error is swallowed; renders an empty canvas with no error/empty/loading state. → `apps/trader/components/charts/HLCandleChart.tsx:228-230`.
- [ ] **MAJ-9 — Market selector keyboard nav broken.** `onKeyDown` is only on the search input; once Arrow-down moves focus to the list, Escape doesn't close and Enter doesn't select. → `apps/trader/components/evaluation/MarketSelector.tsx:336-351`.
- [ ] **MAJ-10 — Continuous console warning loop from the chart.** `autoSize: true` + a manual ResizeObserver calling `applyOptions({ width })` fires "turn autoSize off…" every ~1s, drowning real errors. → `apps/trader/components/charts/HLCandleChart.tsx:108,171-177`.
- [ ] **MAJ-11 — `/docs` nav link 404s.** → `apps/trader/components/.../TopNav.tsx:18`.
- [ ] **MAJ-12 — AssetSpotlight "Long/Short" deep-links drop their intent.** Link to `/start?symbol=…&side=…` but `/start` never reads the params. → `apps/trader/components/home/spotlights/AssetSpotlight.tsx:120-124`.

---

## 🟡 Minor — UX / experience friction
- [ ] **MIN-1 — No "reconnecting" warning.** For the first ~15s (or while flapping) the sim marks PnL against frozen seed prices with no visible signal (`StaleFeedBanner` only reacts to `"stale"`). → `apps/trader/components/shell/StaleFeedBanner.tsx:14`.
- [ ] **MIN-2 — Header leverage badge always shows the tier cap (10×), not the selected leverage.** → `apps/trader/components/evaluation/EvaluationCockpit.tsx` (MarketStrip badge).
- [ ] **MIN-3 — Size input not clamped to the "Max: $10,000" label**; the over-leverage reason is hidden behind the auth banner. → `apps/trader/components/trade/TradeIntentForm.tsx` (size input, disable chain).
- [ ] **MIN-4 — "Your fill" colored red for longs / green for shorts** (technically "worse than mid," but reads as inverted/alarming). → `apps/trader/components/trade/TradeIntentForm.tsx:828-836`.
- [ ] **MIN-5 — `/markets` lists only 3 markets** with no hint the ~179-perp universe exists in the cockpit.
- [ ] **MIN-6 — Auth theater.** Signup "create a password" step is inert (Privy is passwordless); login password field is decorative; the allowlist gate is faked (`allowlisted: true` hardcoded) while copy claims a closed beta. → `SignupFlow.tsx`, `apps/trader/lib/mock/hooks.ts:68`.
- [ ] **MIN-7 — TopNav balance pill** shows hardcoded `$0` with a chevron to a non-existent dropdown. → `TopNav.tsx:72-83`.
- [ ] **MIN-8 — Dead `href="#"` links** (Footer Terms/Privacy/Discord/Report-a-bug, auth Forgot-password). → `Footer.tsx:46-63`, `LoginFlow.tsx:197`.
- [ ] **MIN-9 — Sui Explorer links point to fabricated object IDs** on the legacy `suiexplorer.com` host; resolve to nothing but framed as on-chain proof. → `EvaluationHistory.tsx:80,153`, `ProfileHeader.tsx:14-15`, `SbtCard.tsx:122`.
- [ ] **MIN-10 — `/points` renders a "Genesis Cohort" page** (label/route mismatch with `/cohort`).
- [ ] **MIN-11 — "SIM HALT" dev button visible to all users** (renders whenever the feed is not stale). → `apps/trader/components/shell/StaleFeedBanner.tsx:14-22`.
- [ ] **MIN-12 — Cockpit layout collapses below ~768px** (market strip wraps poorly, compliance strip too narrow).
- [ ] **MIN-13 — Discovery dead-end:** no path from home/`/start`/`/markets` to the cockpit; `/onboarding` just shows the Privy login modal to signed-out users.

---

## ⚙️ Config / failure-mode landmines
- [ ] **CFG-1 — `GATEWAY_URL` defaults to `http://localhost:8787`.** Any deploy without that env → catalog/feed/candles all fail, feed never goes live, chart blanks. Gateway `PORT` is also hardcoded (not `process.env.PORT`). → `apps/trader/next.config.ts:16`, `services/api-gateway/src/index.ts`.
- [ ] **CFG-2 — Catalog fetch failure silently degrades to the 3-market seed** with no surfaced error; the ~179-market universe vanishes. → `apps/trader/lib/mock/hooks.ts:150-156`.
- [ ] **CFG-3 — Wallet auto-provisioning failure hangs onboarding** on "Preparing your account…" with the button disabled forever, no error. → `SuiWalletGate.tsx:25`, `CreateAccountFlow.tsx:61,124`.

---

## ✅ Intentional v1 scope (NOT defects)
- Paper-only, no real custody/orders (form says "Simulated · No real funds").
- Privy email-OTP + Google/Apple OAuth are real and server-verified; `/api/account` + Sui `open_account` are real (firm-signed, idempotent, env-gated).
- Hyperliquid gateway/adapter are real (WS+REST, reconnect/backoff). Bybit adapter intentionally throws "not implemented"; funding-subscribe is a no-op.
- Leaderboard / points / cohort / profile are seeded fixtures (any wallet returns the same demo profile).
- Sim vault state **is** persisted (zustand `persist`).
- `apps/admin` is a one-line placeholder stub.
- `Market.onlyIsolated` defaults `false` (not yet sourced from HL) — the force-isolated markets are tradeable in cross mode in the sim.
- `sui move build` not yet run in this environment — **Phase 5 Move edits need a compile-confirm on a sui-CLI machine.**

---

## Recommended fix order
1. **Unblock the trade loop:** demo/guest mode so paper orders submit (BLK-1) + stop wiping demo fixtures (BLK-3) + fix stale-banner oscillation / don't suspend during reconnect (BLK-2).
2. **Make risk real:** liquidation actually closes positions + free-margin check (MAJ-1, MAJ-2).
3. **Connect onboarding → a real per-user vault; make tier choice mean something** (BLK-4).
4. **Live 24h change/range + cross-mode liq + real `failed` data** (MAJ-5, MAJ-4, MAJ-6).
5. **Robustness:** gateway-URL prod guard, chart empty-state, keyboard nav, autoSize warning (CFG-1, MAJ-8, MAJ-9, MAJ-10).
