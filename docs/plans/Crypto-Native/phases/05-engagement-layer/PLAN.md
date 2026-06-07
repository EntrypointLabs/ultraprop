---
phase: 05-engagement-layer
type: execute
depends_on: ["02-backend-indexer", "03-trader-app-mvp"]
files_modified:
  - apps/trader/app/leaderboard/
  - apps/trader/app/trader/[chain]/[address]/
  - apps/trader/app/v1-cohort/
  - apps/trader/components/Leaderboard.tsx
  - apps/trader/components/PublicProfile.tsx
  - apps/trader/components/AntiPromiseDisclaimer.tsx
  - services/api-gateway/src/routes/leaderboard.ts
  - services/api-gateway/src/routes/profile.ts
  - assets/sbt/starter.png
  - assets/sbt/basic.png
  - assets/sbt/pro.png
  - .github/workflows/no-token-language-lint.yml
autonomous: true
requirements: [REQ-04, REQ-11]
must_haves:
  truths:
    - "Public leaderboard renders per-chain (no unified identity) sorted by highest tier reached, then consistency, then total shadow P&L."
    - "Public profile pages at /trader/sui/<addr> render verifiable evaluation history with on-chain transaction links."
    - "SBT renders correctly in Suiet and Sui Wallet UIs with 3 static designs (Starter/Basic/Pro)."
    - "/v1-cohort page describes the credential without using the words 'token', 'airdrop', 'allocation', or 'rewards beyond profit splits'."
    - "CI lint job blocks any PR that introduces token/airdrop language anywhere in apps/trader/."
    - "Anti-promise disclaimer renders in the footer of every leaderboard, profile, and SBT view."
    - "Leaderboard refresh cadence: public view = 60s; trader's own dashboard = real-time via WS."
  artifacts:
    - "Leaderboard page + components"
    - "Public profile pages per chain"
    - "/v1-cohort static page"
    - "3 SBT design assets"
    - "no-token-language-lint CI workflow"
  key_links:
    - from: "apps/trader/app/leaderboard/page.tsx"
      to: "services/api-gateway/src/routes/leaderboard.ts"
      type: "function_call"
    - from: "apps/trader/components/AntiPromiseDisclaimer.tsx"
      to: "apps/trader/app/v1-cohort/page.tsx"
      type: "import"
---

<objective>
Build the engagement layer: public leaderboards, public profile pages, three static SBT designs that level up via metadata-URI swap, and the `/v1-cohort` page that frames the credential without using token/airdrop language. The "no-token-language" CI lint and the AntiPromiseDisclaimer component are load-bearing for the messaging stance from Clarify R3 (REQ-11) — they're the only durable mitigation against PITFALLS 3.4 (promise inflation). This phase is mostly frontend + indexer-read work and can begin as soon as Phase 2 (indexer) and Phase 3 (trader app MVP) are complete.
</objective>

<context>
@.claude/plans/Crypto-Native/PROJECT.md
@.claude/plans/Crypto-Native/STATE.md
@.claude/plans/Crypto-Native/ROADMAP.md
@.claude/plans/Crypto-Native/research/FEATURES.md (B-tier differentiators)
@.claude/plans/Crypto-Native/research/PITFALLS.md (§3.4 promise inflation)
</context>

<tasks>

<task type="auto" id="5.1" depends_on="">
  <name>Public leaderboard (multi-axis, per chain, separate from trader's own dashboard)</name>
  <files>
    apps/trader/app/leaderboard/page.tsx
    apps/trader/components/Leaderboard.tsx
    services/api-gateway/src/routes/leaderboard.ts
    infra/postgres/migrations/0010_leaderboard_view.sql
  </files>
  <context>
    Why: REQ-04 — engagement loop's distribution mechanism. FEATURES.md B1 — proven retention mechanic in prop-firm and futures platforms. Clarify R3 — per-chain, no cross-chain identity.
    Pattern: Postgres materialized view refreshed every 60s; sorts by `highest_tier DESC, consistency_score DESC, total_shadow_pnl DESC`. Pseudonymous (truncated address); opt-in display name from profile.
  </context>
  <action>
    1. `0010_leaderboard_view.sql`: materialized view joining `vaults` + `cohort_sbt` data + computed consistency_score (Sharpe-like over evaluation P&L sequence). Indexed on tier + score.
    2. Cron job in api-gateway refreshes the matview every 60s.
    3. `GET /leaderboard?chain=sui&tier=Pro` returns paginated rows.
    4. `Leaderboard.tsx`: per-tier filters; row click → profile page.
    5. Pseudonymous: show truncated address like `0xabc...d3f`; trader profile page can expose a display name they set explicitly.
    **Avoid:** unified cross-chain leaderboard (Clarify R3 explicit); refreshing on every page view (DB load); exposing full addresses without trader consent.
  </action>
  <verify>seed 50 synthetic vaults across tiers; assert leaderboard sorts correctly; assert refresh cadence ~60s</verify>
  <done>
    - [ ] Materialized view + 60s refresh job operational
    - [ ] Per-chain + per-tier filters work
    - [ ] Pseudonymous by default; display name optional
  </done>
  <rollback>git checkout -- apps/trader/app/leaderboard apps/trader/components/Leaderboard.tsx services/api-gateway/src/routes/leaderboard.ts infra/postgres/migrations/0010_leaderboard_view.sql</rollback>
</task>

<task type="auto" id="5.2" depends_on="5.1">
  <name>Public profile pages — /trader/sui/<addr></name>
  <files>
    apps/trader/app/trader/[chain]/[address]/page.tsx
    apps/trader/components/PublicProfile.tsx
    apps/trader/components/EvaluationHistoryTable.tsx
    services/api-gateway/src/routes/profile.ts
  </files>
  <context>
    Why: REQ-04 — verifiable track record portable to anyone. FEATURES.md B2 + B6. Clarify R3 — separate per-chain profiles.
    Pattern: server-rendered Next.js Route segment under `[chain]/[address]`. Pulls SBT state + full evaluation history + equity-curve sparklines from the indexer.
  </context>
  <action>
    1. Route segment `/trader/[chain]/[address]/page.tsx` validates `chain === 'sui'` and address format.
    2. `PublicProfile.tsx`: shows SBT image + level, total passes, total trades, cumulative shadow P&L, win rate, AntiPromiseDisclaimer.
    3. `EvaluationHistoryTable.tsx`: every evaluation as a row with tier, outcome (Passed/Failed/Inactive), date, P&L, equity curve sparkline, on-chain explorer link (Suiscan).
    4. Profile page has `<meta>` + Open Graph tags so the embed renders well when shared on X/Discord.
    5. Display-name setter (gated to the owning wallet) lives at `/me/profile`.
    **Avoid:** showing full address without truncation alongside the SBT level (clutter); cross-chain profile aggregation (deferred); requiring auth to view (public means public).
  </action>
  <verify>visit /trader/sui/<test_addr> — assert SBT renders, history table shows all past evaluations, OG image works in Twitter card validator</verify>
  <done>
    - [ ] Per-chain profile pages render correctly
    - [ ] Evaluation history shows full history with explorer links
    - [ ] Open Graph metadata generates correct embeds
  </done>
  <rollback>git checkout -- apps/trader/app/trader apps/trader/components/PublicProfile.tsx apps/trader/components/EvaluationHistoryTable.tsx services/api-gateway/src/routes/profile.ts</rollback>
</task>

<task type="auto" id="5.3" depends_on="">
  <name>SBT 3 static designs + level-up metadata-URI swap</name>
  <files>
    assets/sbt/starter.png
    assets/sbt/basic.png
    assets/sbt/pro.png
    assets/sbt/metadata.json
    contracts/sui/sources/cohort_sbt.move (Display update)
    services/api-gateway/src/sbt/uri.ts
  </files>
  <context>
    Why: Clarify R2 — static SBT art (3 designs). REQ-04 — level-up must render in wallets correctly.
    Pattern: assets hosted on Arweave or IPFS pinned via Pinata for permanence; URI stored on-chain in the SBT object; level-up rewrites URI; wallet UIs (Suiet, Sui Wallet) refresh metadata on next view.
  </context>
  <action>
    1. Designer delivers 3 PNG/SVG assets (Starter/Basic/Pro) + a thumbnail variant.
    2. Pin assets to Arweave or Pinata IPFS. Record CIDs in `assets/sbt/metadata.json`.
    3. Extend `cohort_sbt.move` to expose `image_url` field via `display::register`; `mint_or_level_up` writes the URI for `highest_tier`.
    4. SBT-renders-in-wallets validation: install dev builds of Suiet and Sui Wallet; mint test SBTs at each tier; visually verify they show in the NFT/collectibles tabs with correct image.
    **Avoid:** procedural generation (out of v1 scope per Clarify R2); fully-on-chain SVG (deferred); centralized image hosting on platform's own server (not durable).
  </action>
  <verify>mint test SBT at Starter; level up to Basic; level up to Pro; verify wallet UI updates within ~5min on each step</verify>
  <done>
    - [ ] 3 static designs pinned to IPFS/Arweave
    - [ ] Level-up rewrites URI on-chain
    - [ ] SBTs visually render in Suiet and Sui Wallet test builds
  </done>
  <rollback>git checkout -- assets/sbt contracts/sui/sources/cohort_sbt.move services/api-gateway/src/sbt/uri.ts</rollback>
</task>

<task type="auto" id="5.4" depends_on="5.1,5.2,5.3">
  <name>/v1-cohort page + AntiPromiseDisclaimer + no-token-language CI lint</name>
  <files>
    apps/trader/app/v1-cohort/page.tsx
    apps/trader/components/AntiPromiseDisclaimer.tsx
    apps/trader/content/v1-cohort.mdx
    .github/workflows/no-token-language-lint.yml
    scripts/lint-no-token-language.ts
    docs/operator/language-canon.md
  </files>
  <context>
    Why: REQ-11 — soft-airdrop messaging stance. Clarify R3 — neither promise nor deny. PITFALLS 3.4 — promise inflation is P0 and uniquely irreversible.
    Pattern: public page describes the credential as proof-of-skill, foundational, non-transferable, mint-once. No mention of token/airdrop. Operator playbook (language-canon.md) enforces the discipline internally. CI lint blocks any PR introducing banned terms in `apps/trader/`.
  </context>
  <action>
    1. `v1-cohort.mdx`: copy approved in language-canon.md. Sample structure: what the SBT proves; how it's earned; why it's non-transferable; what makes the v1 cohort foundational. **Zero use of: "token", "airdrop", "allocation", "reward beyond profit splits", "future utility".**
    2. `AntiPromiseDisclaimer.tsx`: small footer component, ~one paragraph: "The v1 cohort SBT is a verifiable credential of trading skill earned during closed beta. It is non-transferable and not a stake in any asset." Renders on `/leaderboard`, `/trader/.../...`, `/v1-cohort`, and below the SBT level-up animation on `/passed`.
    3. `lint-no-token-language.ts`: greps `apps/trader/` for banned terms (case-insensitive); fails on match. Allowlist file `scripts/lint-no-token-language.allowlist.txt` for legitimate uses (e.g., the word "token" appearing in a smart-contract type name is allowed via comment annotation).
    4. `.github/workflows/no-token-language-lint.yml`: runs on every PR touching `apps/trader/`.
    5. `docs/operator/language-canon.md`: operator playbook excerpt — exact phrasing for "do not speculate," public copy boundaries, redirect patterns when asked.
    **Avoid:** soft "we don't currently plan" denials (the option not chosen in Clarify R3); plain regex grep without allowlist (false positives); language canon in Slack/Discord only (must be in Notion + Linear + repo).
  </action>
  <verify>create test PR that adds "airdrop" to a button label; assert CI fails. Remove. Assert CI passes. Run lighthouse on /v1-cohort to assert it loads cleanly.</verify>
  <done>
    - [ ] /v1-cohort page live with approved copy
    - [ ] AntiPromiseDisclaimer renders in 4 required surfaces
    - [ ] CI lint blocks banned terms in apps/trader/
    - [ ] language-canon.md committed; mirrored to Notion
  </done>
  <rollback>git checkout -- apps/trader/app/v1-cohort apps/trader/components/AntiPromiseDisclaimer.tsx apps/trader/content/v1-cohort.mdx .github/workflows/no-token-language-lint.yml scripts/lint-no-token-language.ts docs/operator/language-canon.md</rollback>
</task>

</tasks>

<verification>
- [ ] Leaderboard renders with correct sort
- [ ] Profile pages render at /trader/sui/<addr>
- [ ] SBT level-up swaps image; verified in Suiet and Sui Wallet
- [ ] /v1-cohort page contains zero banned terms (verified by CI lint passing on it)
- [ ] AntiPromiseDisclaimer visible on all 4 required surfaces
- [ ] no-token-language-lint CI gate fails on intentional violation, passes on clean state
</verification>

<success_criteria>
Phase 5 is complete when a public visitor can browse the leaderboard, click into a trader's profile, see their full evaluation history with on-chain verification links, view the trader's SBT correctly rendered, and the `/v1-cohort` page describes the credential's value without ever using the words token, airdrop, or allocation. The CI lint enforces this language discipline for every future change. The operator playbook's language canon is committed to the repo and mirrored to Notion.
</success_criteria>

<output>
Create `.claude/plans/Crypto-Native/phases/05-engagement-layer/SUMMARY.md` after completion, documenting task results and any deviations from the plan.
</output>
