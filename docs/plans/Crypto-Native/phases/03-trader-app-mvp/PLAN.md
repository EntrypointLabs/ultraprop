---
phase: 03-trader-app-mvp
type: execute
depends_on: ["01-sui-contract-core", "02-backend-indexer"]
files_modified:
  - apps/trader/
  - apps/trader/app/
  - apps/trader/components/
  - apps/trader/lib/
  - apps/trader/package.json
  - apps/trader/playwright.config.ts
autonomous: true
requirements: [REQ-04, REQ-05]
must_haves:
  truths:
    - "Trader can connect a Sui wallet via @mysten/dapp-kit and sign in via personal-message + nonce."
    - "Allowlist gating blocks non-allowlisted wallets at the open-evaluation entry point."
    - "Trade-intent form displays modeled fill + tilt + slippage bps before submission."
    - "Live equity curve updates within 200ms of an on-chain TradeFilled event."
    - "Rule-compliance pills (DD, daily loss, profit target, intent count) update in real time."
    - "Pass / Fail / Inactive UI is distinct for each terminal state; failure shows the trigger trade and the violated rule."
    - "Stale-feed pause UX engages within 2s when oracle divergence halt is active."
    - "Playwright happy-path test passes end-to-end on Sui devnet."
  artifacts:
    - "apps/trader/ (Next.js 15 App Router project)"
    - "Playwright E2E test for the Sui happy path"
  key_links:
    - from: "apps/trader/components/TradeIntentForm.tsx"
      to: "apps/trader/lib/slippage-preview.ts"
      type: "function_call"
    - from: "apps/trader/lib/ws.ts"
      to: "services/api-gateway/src/ws/fanout.ts"
      type: "WebSocket protocol"
---

<objective>
Ship the trader-facing app on Sui only (Solana follows in Phase 4 via parity). Cover the full evaluation loop: connect wallet → sign in → allowlist check → tier picker → live trading with slippage transparency → equity curve + rule pills → pass/fail/inactive terminal screens. The slippage transparency UI (showing modeled fill + +2 bps tilt pre-submit) is the load-bearing trust primitive: traders see the math before they hit submit, eliminating "the system tricked me" complaints (mitigates PITFALLS 3.5 and 4.1's UI surface).
</objective>

<context>
@.claude/plans/Crypto-Native/PROJECT.md
@.claude/plans/Crypto-Native/STATE.md
@.claude/plans/Crypto-Native/ROADMAP.md
@.claude/plans/Crypto-Native/research/STACK.md (§3 Frontend)
@.claude/plans/Crypto-Native/research/FEATURES.md (A-tier table stakes)
@packages/shared/events/codegen/ts/index.ts
</context>

<tasks>

<task type="auto" id="3.1" depends_on="">
  <name>Next.js 15 App Router scaffold + Mysten dapp-kit + Iron Session sign-in</name>
  <files>
    apps/trader/package.json
    apps/trader/next.config.ts
    apps/trader/app/layout.tsx
    apps/trader/app/page.tsx
    apps/trader/app/api/auth/nonce/route.ts
    apps/trader/app/api/auth/verify/route.ts
    apps/trader/lib/session.ts
    apps/trader/components/WalletConnect.tsx
    apps/trader/components/Providers.tsx
  </files>
  <context>
    Why: REQ-04 — every interaction starts here. STACK.md §3 specifies Next 15 App Router + @mysten/dapp-kit + Iron Session.
    Pattern: nonce-based personal-message sign-in (no formal SIWS for Sui yet; this is the de-facto pattern).
  </context>
  <action>
    1. Initialize Next 15 App Router project. Install @mysten/dapp-kit, @mysten/sui, @tanstack/react-query, zustand, iron-session, shadcn/ui (Tailwind 4 if stable), tailwindcss.
    2. Wire `Providers.tsx` with WalletProvider (dapp-kit), QueryClientProvider, and the shadcn theme provider.
    3. Build sign-in flow: POST `/api/auth/nonce` → returns UUID + 10-min TTL; client signs personal message via `useSignPersonalMessage`; POST `/api/auth/verify` validates signature, sets Iron Session cookie keyed by `(chain, address)`.
    4. `WalletConnect.tsx` wraps dapp-kit's wallet button + sign-in flow in one UX.
    **Avoid:** Lucia Auth (deprecated 2024); JWT in localStorage; storing private keys anywhere.
  </action>
  <verify>pnpm --filter trader dev; open localhost:3000; connect Suiet wallet; complete sign-in; verify Iron Session cookie set</verify>
  <done>
    - [ ] Wallet connect flow works for at least 2 Sui wallets (Suiet + Sui Wallet)
    - [ ] Sign-in completes and persists across page reloads
    - [ ] Logout clears session
  </done>
  <rollback>rm -rf apps/trader && git checkout -- pnpm-workspace.yaml</rollback>
</task>

<task type="auto" id="3.2" depends_on="3.1">
  <name>Allowlist gating + tier picker + open-evaluation flow</name>
  <files>
    apps/trader/app/start/page.tsx
    apps/trader/components/TierPicker.tsx
    apps/trader/lib/contracts/registry-sui.ts
    apps/trader/middleware.ts
  </files>
  <context>
    Why: REQ-05 — closed beta is invite-only. PROJECT.md tier ladder.
    Pattern: middleware checks Iron Session + on-chain allowlist via `registry::is_allowlisted` view function; tier picker renders 3 cards (Starter/Basic/Pro) with parameters from `tier_config`.
  </context>
  <action>
    1. `middleware.ts`: redirects to `/waitlist` if signed-in wallet is not in the on-chain allowlist (queried via a cached read).
    2. `/start` page renders `<TierPicker />` with the 3 tier cards.
    3. On tier select: build + sign a `registry::open_evaluation(tier_id)` transaction via `useSignAndExecuteTransaction`; on success, redirect to `/evaluation/<vault_id>`.
    4. Loading + error states for: rejected by allowlist, rejected by paused, rejected by `EOracleDivergence`.
    **Avoid:** trusting client-side allowlist checks (always re-verify in middleware via on-chain read).
  </action>
  <verify>signed-in non-allowlisted user redirected to /waitlist; allowlisted user can open Starter tier; vault_id returned and dashboard renders</verify>
  <done>
    - [ ] Allowlist enforcement at middleware level
    - [ ] Tier picker uses on-chain `tier_config` params, not hardcoded
    - [ ] Vault open transaction succeeds and routes to dashboard
  </done>
  <rollback>git checkout -- apps/trader/app/start apps/trader/components/TierPicker.tsx</rollback>
</task>

<task type="auto" id="3.3" depends_on="3.2">
  <name>Trade-intent form with full slippage transparency (modeled fill + +2 bps tilt pre-submit)</name>
  <files>
    apps/trader/app/evaluation/[vaultId]/page.tsx
    apps/trader/components/TradeIntentForm.tsx
    apps/trader/lib/slippage-preview.ts
  </files>
  <context>
    Why: REQ-04 + load-bearing trust primitive. PROJECT.md essence: paper trading must FEEL mainnet-equivalent — the slippage math is shown pre-submit so it can never feel hidden.
    Pattern: slippage-preview.ts wraps the Rust reference impl compiled to WASM (preferred) OR a TS port that re-implements the same fixed-point math. WASM is preferred for parity with on-chain.
  </context>
  <action>
    1. Build out-of-the-box `TradeIntentForm` with: symbol picker (BTC/ETH/SOL only), side toggle (Long/Short), size input, modeled-fill preview showing `[oracle: $X.XX] + [slippage: Y bps] + [house tilt: +2 bps] = [your fill: $Z.ZZ]` + total cost.
    2. `slippage-preview.ts`: compute the same fill the contract will compute, using either the WASM-compiled Rust reference or a port. Must match on-chain output to within 1 ULP.
    3. On submit: builds + signs `evaluation_vault::submit_intent(...)`. Disable submit when: rate-limit window active, oracle stale, divergence halted, vault paused.
    4. Display rate-limit countdown (2s after last submit) as a visible UI cue.
    **Avoid:** approximate slippage preview that diverges from on-chain math (creates "system lied to me" perception); allowing submit during halts (UX bug = trust breach).
  </action>
  <verify>Playwright: submit a 1 SOL buy; assert preview fill matches the resulting TradeFilled event's fill price to within 1 ULP</verify>
  <done>
    - [ ] Preview fill matches on-chain fill exactly
    - [ ] Submit disabled during rate-limit, stale, divergence
    - [ ] Visible countdown for rate-limit window
  </done>
  <rollback>git checkout -- apps/trader/app/evaluation apps/trader/components/TradeIntentForm.tsx apps/trader/lib/slippage-preview.ts</rollback>
</task>

<task type="auto" id="3.4" depends_on="3.3">
  <name>Live equity curve + rule-compliance pills + drawdown gauge</name>
  <files>
    apps/trader/components/EquityCurve.tsx
    apps/trader/components/RulePills.tsx
    apps/trader/components/DrawdownGauge.tsx
    apps/trader/lib/ws.ts
  </files>
  <context>
    Why: REQ-04 — engagement requires real-time visibility into where you stand against the rules. FEATURES.md A10/A11.
    Pattern: TradingView Lightweight Charts for the curve; rule pills show DD / daily loss / profit target / intent count as colored chips (green = safe, amber = within 30% of breach, red = within 10%).
  </context>
  <action>
    1. `lib/ws.ts`: opens WS connection to api-gateway, subscribes to `vault:<vault_id>` and `price:<symbol>`. Messages flow into TanStack Query cache via `queryClient.setQueryData`.
    2. `EquityCurve.tsx`: TradingView Lightweight Charts area-chart of equity over time. Annotation lines at `peak_equity * (1 - max_dd)` and `starting_equity * (1 + profit_target)`.
    3. `RulePills.tsx`: 4 pills with state-derived color thresholds. Click each → modal with the rule text + current state.
    4. `DrawdownGauge.tsx`: radial gauge showing current DD as % of max DD.
    **Avoid:** computing rule state client-side (always read indexer-derived state for parity with contract); polling for updates (WS-only).
  </action>
  <verify>Playwright: submit losing trade, verify DD gauge updates; submit winning trade to target, verify profit target pill goes green → success</verify>
  <done>
    - [ ] Equity curve renders + updates in real time
    - [ ] All 4 rule pills accurate against contract state
    - [ ] DD gauge updates on every fill
  </done>
  <rollback>git checkout -- apps/trader/components/Equity* apps/trader/components/Rule* apps/trader/components/Drawdown*</rollback>
</task>

<task type="auto" id="3.5" depends_on="3.4">
  <name>Pass / fail / inactive terminal screens + failure debrief + stale-feed pause UX</name>
  <files>
    apps/trader/app/evaluation/[vaultId]/passed/page.tsx
    apps/trader/app/evaluation/[vaultId]/failed/page.tsx
    apps/trader/app/evaluation/[vaultId]/inactive/page.tsx
    apps/trader/components/FailureDebrief.tsx
    apps/trader/components/StaleFeedBanner.tsx
  </files>
  <context>
    Why: REQ-04 — clear terminal state is part of the engagement loop. Clarify R3 — `Inactive` is distinct from `Failed`. PITFALLS 3.3 — bottom-quartile attrition is mitigated by a respectful failure debrief.
    Pattern: each terminal state has its own page with appropriate CTA. Failure debrief shows the trigger trade + violated rule + a "stats vs. cohort" comparison (median tier-passer's stats at the same point).
  </context>
  <action>
    1. `passed/page.tsx`: confetti, SBT level-up animation hook, "Continue to {next tier}" CTA, share-on-X embed card.
    2. `failed/page.tsx`: shows trigger trade, violated rule, equity curve up to failure, FailureDebrief component, "Retry the same tier" or "Step down to lower tier" CTAs (re-application gated by allowlist — closed beta).
    3. `inactive/page.tsx`: gentle re-engagement CTA; no penalty messaging.
    4. `StaleFeedBanner.tsx`: when WS pushes `divergence_halt: true`, banner appears site-wide; trade form disabled; banner copy: "Oracle feeds diverged; trading paused to protect your evaluation. Resumes automatically."
    **Avoid:** harsh failure copy ("You lost!"); making `Inactive` feel like punishment; auto-redirecting away from a halted state (let trader see what's happening).
  </action>
  <verify>Playwright: drive a vault to fail; assert /failed page renders with correct trigger trade; simulate divergence halt; assert StaleFeedBanner visible across all pages</verify>
  <done>
    - [ ] All 3 terminal pages render correctly
    - [ ] Failure debrief shows trigger trade + rule + cohort comparison
    - [ ] Stale-feed banner appears within 2s of halt and disappears within 2s of resume
  </done>
  <rollback>git checkout -- apps/trader/app/evaluation/[vaultId]</rollback>
</task>

<task type="auto" id="3.6" depends_on="3.5">
  <name>Playwright happy-path E2E test on Sui devnet</name>
  <files>
    apps/trader/playwright.config.ts
    apps/trader/e2e/sui-happy-path.spec.ts
    apps/trader/e2e/fixtures/wallet.ts
  </files>
  <context>
    Why: REQ-05 — proves the trader funnel works end-to-end before any human invitee touches it. PITFALLS 4.5 — wallet adapter edge cases die in production unless a real test matrix runs in CI.
    Pattern: Playwright with a programmatic Sui wallet stub (mnemonic-funded; signs via @mysten/sui); runs against deployed Sui devnet contracts.
  </context>
  <action>
    1. Configure Playwright with a single Chromium project; mock the wallet via a custom extension/injection that responds to dapp-kit's wallet-standard messages.
    2. `sui-happy-path.spec.ts`: deploy fresh contract; allowlist test wallet; connect + sign in; open Starter; submit 3 winning trades hitting the profit target; assert /passed renders + SBT minted on-chain.
    3. Wire into CI workflow `services.yml` (or new `e2e.yml`) — run on PRs that touch `apps/trader/` or `contracts/sui/`.
    **Avoid:** Cypress (heavier, weaker multi-tab support); E2E in unit-test runner (timing flakes).
  </action>
  <verify>npx playwright test sui-happy-path.spec.ts</verify>
  <done>
    - [ ] Test runs in <5 min on CI
    - [ ] Test passes against fresh Sui devnet deploy
    - [ ] Failure modes covered in additional cases (rule-violation path)
  </done>
  <rollback>git checkout -- apps/trader/playwright.config.ts apps/trader/e2e/</rollback>
</task>

</tasks>

<verification>
- [ ] `pnpm --filter trader build` — green
- [ ] `npx playwright test` — happy path + at least one rule-violation case green
- [ ] Manual wallet test: Suiet + Sui Wallet both complete sign-in + first trade
- [ ] Slippage preview matches on-chain fill within 1 ULP (verified by Playwright assertion)
- [ ] Stale-feed banner triggers on simulated divergence halt
</verification>

<success_criteria>
Phase 3 is complete when an allowlisted Sui devnet wallet can: connect → sign in → pick Starter tier → open an evaluation → submit trades with full slippage transparency (modeled fill displayed pre-submit, matching the eventual on-chain fill within 1 ULP) → see the live equity curve + rule pills update in real time → reach a terminal state (Pass/Fail/Inactive) with appropriate UI. Playwright E2E test covers the happy path end-to-end and is wired into CI. Solana wallet support is intentionally absent; it lands in Phase 4 via the port.
</success_criteria>

<output>
Create `.claude/plans/Crypto-Native/phases/03-trader-app-mvp/SUMMARY.md` after completion, documenting task results and any deviations from the plan.
</output>
