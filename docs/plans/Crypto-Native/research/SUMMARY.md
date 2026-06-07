# Research Synthesis — Crypto-Native Prop Firm v1 Closed Beta

**Domain:** Sui Move paper-trading evaluation platform, closed beta, 14–18 weeks, 3-engineer team.
**Synthesized:** 2026-05-14
**Inputs:** `./STACK.md` `./FEATURES.md` `./ARCHITECTURE.md` `./PITFALLS.md` (all dated 2026-05-14)
**Overall confidence:** MEDIUM-HIGH on shape and direction; MEDIUM on specific version pins and external-incident specifics (see §8).

---

## 1. Executive Summary

The four research streams converge on a sharp, testable thesis:

> **V1 is one product wearing two costumes — an on-chain rule-enforcement engine and a soft-airdrop retention loop — both held together by a single load-bearing artifact: a calibrated, deterministic, on-chain slippage/fill model.**

Every other architectural call falls out of that statement. ARCHITECTURE.md §1 places the slippage model inside the vault transaction so pass/fail is reproducible from chain data alone. STACK.md §2 picks Rust for the off-chain risk engine specifically to mirror Move's numeric semantics. FEATURES.md §"Core Essence" reuses the same framing. PITFALLS.md §1 dedicates seven of its top-tier pitfalls (1.1–1.7) to this single attack surface, including the only ones with **continuous** mitigation (shadow-quote logger, forward-test gate, calibration drift alerts).

The second cross-cutting insight: **the engagement loop is not optional, not P2, and not "polish."** FEATURES.md's MVP cut confirms B1 (leaderboard) + B2 (profile) + B3 (SBT) + B6 (verifiable history) are *mutually reinforcing* and cutting any one halves the proposition. ARCHITECTURE.md §1 treats the SBT as a first-class on-chain module with friend-only mutation. PITFALLS.md §3 dedicates its own family (3.1–3.6) to engagement-loop failure modes — tier collapse, bottom-quartile attrition, promise inflation, mid-beta recalibration.

The third — and the one most likely to be under-weighted — is **the operator-override surface.** PROJECT.md's success criterion "zero pass/fail decisions require operator override" gets concretized in ARCHITECTURE.md §1 (admin module has only `pause` + `allowlist`, no vault-mutating capability) and in PITFALLS.md §4.1 (P0, mitigation: **enforced in Move, not in policy**). This is structural, not procedural — the contract literally must not contain a vault-mutating admin path. Discovering this on week 10 is too late.

**The architecture is well-understood; the timeline is the binding constraint.** ARCHITECTURE.md §6 proposes a 7-phase critical path against 14–18 weeks that the rest of the corpus broadly endorses. FEATURES.md's "survives 50% cut" set defines the minimum-viable scope. PITFALLS.md provides the gate criteria. The roadmap's job is to bolt these together into phase boundaries with explicit gates.

---

## 2. Cross-Cutting Insights

### Insight A — The slippage model is not a component, it's a control surface

Shows up in: STACK.md §2 (Rust choice), STACK.md §4 (Pyth+Switchboard), FEATURES.md A10/A11 (transparency as a UI primitive), ARCHITECTURE.md §1 (`slippage_model` pure module), §4 (`slippage-calibrator` daily cadence), §5 (on-chain trade steps 6–7), PITFALLS.md §1.1–1.7 (six P0/P1 failure modes on this one component), PITFALLS.md §3.6 (mid-beta recalibration requires on-chain versioning).

**Consolidated read:** Design as a **versioned, on-chain-anchored, off-chain-calibrated, continuously-shadow-tested** artifact from day one. Planner: dedicate a phase to it (not a task), gate beta open on both 30-day backtest AND 7-day forward-test.

### Insight B — Event schema integrity is a codegen problem, not a bridge problem

Shows up in: STACK.md §1 (anti-rec Wormhole/LayerZero), STATE.md decisions (shared event schema P0), ARCHITECTURE.md §2/§3 (canonical schema + adapter), PITFALLS.md §2.6 (codegen, not hand-translation), §4.4 (regression post-upgrade).

**Consolidated read:** The seam between Move contracts and the indexer is the JSON Schema in `packages/shared/events/` plus a codegen + CI lint gate. Must land in week 0–1 or downstream drifts. Planner: schema scaffolding is Phase 0, not Phase 1.

### Insight C — On-chain rule enforcement is non-negotiable and structural

Shows up in: PROJECT.md success criterion, STATE.md risks, ARCHITECTURE.md §1 (admin = `pause` + `allowlist` only), §4 (admin-api returns unsigned txs to operator wallet), PITFALLS.md §4.1 (enforced in Move), FEATURES.md C15/A21.

**Consolidated read:** The contract must be built such that no override path exists. Phase 1 architectural constraint that gates every subsequent admin/operator deliverable.

### Insight D — Retention is structural; SBT is credential, leaderboard is distribution

Shows up in: PROJECT.md §"Why It Exists" (v1→v2 window), FEATURES.md §"Engagement Retention" (points-without-dollar, public-profile-by-wallet, time-bound cohort), FEATURES.md MVP cut (B1/B2/B3/B6 survive together), ARCHITECTURE.md §1 (SBT first-class on-chain; leaderboard deliberately off-chain), PITFALLS.md §3.4 (promise inflation P0; soft-airdrop page B8 is load-bearing), §3.2/3.3/3.5.

**Consolidated read:** Engagement infrastructure is a *parallel* phase to the contract hardening work, not a sequential follow-on.

### Insight E — The indexer is a SPOF and a trust surface

Shows up in: STATE.md risks, STACK.md §5 (Hetzner CCX, pgbackrest), ARCHITECTURE.md §4 (modular monolith, cursor replay), §5 (on-chain replay possible), PITFALLS.md §4.3 (restore drill is a measured deliverable, not a doc task).

**Consolidated read:** Architecture is correct for SPOF tolerance; operational discipline is what makes it hold. Phase 7 must contain a literal "execute restore drill from cold backup; measure RTO."

### Insight F — Tool-access caveat (verification debt) — see §8

---

## 3. Recommended Phase Shape (Synthesized)

ARCHITECTURE.md §6 proposes 7 phases; FEATURES.md and PITFALLS.md broadly agree. Resolution of mild disagreements:

- **Engagement layer placement.** SBT (B3) lands with Sui contract MVP (it's an on-chain module); public surface (B1/B2/B6) lands in parallel Phase 5.
- **Admin app priority.** Allowlist + pause (P0 operator capabilities) land Phase 1/2; full read-only admin dashboard slips to Phase 6.
- **Calibration timing.** Two distinct blocking gates: 30-day backtest end of Phase 6; 7-day forward-test start of Phase 7.

**Synthesized 6-phase shape:**

1. **Phase 0 — Foundation (wk 0–2):** monorepo + toolchain pin + event schema + codegen + CI schema gate + wallet adapter + price-feed subscription + DB schema + cursor design + multisig setup + scope-lock document. **Verification sprint** clears all MED-confidence version pins.
2. **Phase 1 — Sui Contract (wk 1–6, overlap):** oracle_adapter + staleness reverts; tier_config + registry + AdminCap (capability split: pause + allowlist only); slippage_model with on-chain versioned config; evaluation_vault as **owned-object**; rule enforcement (DD/daily-loss/target/rate-limit); cohort_sbt with friend-only mutation; fuzz harness; upgrade-compat CI gate; property-based tests.
3. **Phase 2 — Backend/Indexer (wk 2–7, overlap):** chain-adapter/sui + canonical event normalizer; db-writer + Postgres+TSDB hypertables; ws-fanout; price-feed; slippage-calibrator v0; **shadow-quote logger**; indexer cursor + lag metric.
4. **Phase 3 — Trader App MVP (wk 3–9, overlap):** wallet connect + allowlist gating; tier picker; trade-intent form with slippage transparency; live equity curve + rule pills; positions/history/explorer link; pass/fail UI; stale-feed pause UX; failure debrief UI; error guards.
5. **Phase 5 — Engagement Layer (wk 7–12):** public leaderboard (multi-axis, pseudonymous); public profile pages; verifiable evaluation history permalinks; SBT mint ceremony + level-up art (cuttable); soft-airdrop-signal page; anti-promise disclaimer everywhere; SBT-renders-in-wallets validation; cohort framing.
6. **Phase 6 — Calibration + Admin (wk 9–13):** 30-day backtest harness; slippage-calibrator v1 with daily alerts; calibration dashboard; admin app (allowlist UI + pause + read-only vault views); replayability test in CI; schema-drift CI gate; Sybil clustering job.
7. **Phase 7 — Hardening + Beta (wk 12–18):** **7-day forward-test gate (BLOCKING)**; external audit of fill math (BLOCKING); backup + restore drill (measured RTO); wallet matrix test; operator playbook + language canon; test cohort dry-run; Linear-shadow process; weekly scope-review; beta open.

**Parallelism:** Phase 5 (Engagement) runs in parallel with Phase 3 completion. Phase 1/2/3 overlap heavily wk 1–7.

---

## 4. Critical Path and Cut Points

### Critical path (blocks everything downstream)

1. Event schema + codegen — wk 0–1
2. `oracle_adapter` + Pyth feed-ID verification on Sui testnet — wk 1 (STATE.md blocker)
3. `evaluation_vault` API frozen — wk 6–7 (Engagement layer and admin app unblock)
4. Slippage model on-chain config + versioning — Phase 1
5. 30-day backtest harness — Phase 2 (multi-week build)
6. 7-day forward-test gate — Phase 7 (cannot be skipped)

### Cut order (if timeline slips)

Per PROJECT.md "survives 50% cut" + FEATURES.md MVP:

1. **First to cut:** B4 mint ceremony→static page; B9 consistency score→raw P&L; B10 hall of fame; B12 SBT art→static per tier; B14 public cohort dashboard→operator-only; B15 embed cards→text only; A12 mobile-responsive→desktop-first.
2. **Second:** Full admin app→Notion+Discord; B11 backtest replay; B16/17/18/19.
3. **Non-cuttable:** All PITFALLS Phase 0/1/2/7 P0 items — event schema, owned-object vault, on-chain SlippageConfig versioning, capability split, oracle staleness reverts, shadow-quote logger, 30-day backtest, 7-day forward-test, promise-inflation disclaimers, override-creep prevention.

---

## 5. Decision Lock-Ins (orc-clarify should NOT re-ask)

Triangulated across ≥3 sources. Treat as binding:

| Decision | Triangulated in | Confidence |
|---|---|---|
| Sui single-chain, Sui Move | PROJECT + STATE + ARCH §6 | HIGH |
| Monorepo: contracts/, services/, apps/, packages/shared/ | STATE + STACK §6 + ARCH §4 | HIGH |
| Shared event schema = Move-to-indexer seam (P0) | STATE + STACK §1 + ARCH §2 + PITFALLS 2.6 | HIGH |
| No cross-chain bridge in v1 | STACK §1 + ARCH §3 | HIGH |
| Rust for risk-engine + indexer; TypeScript for WS gateway/API | STACK §2 + ARCH §4 | HIGH |
| Modular monolith on single Hetzner VM | STACK §5 + ARCH §4 | HIGH |
| Postgres 16 + TimescaleDB 2.15+ self-hosted | STACK §5 + ARCH §4 | HIGH |
| Pyth Hermes primary + Switchboard failover (Sui) | STACK §4 + ARCH §1/§5 + PITFALLS 1.3 | HIGH |
| Sui dapp-kit (+ Privy optional for onboarding) | STACK §3 | HIGH |
| Next.js 15+ App Router + TanStack Query + Zustand + shadcn + TradingView Lightweight | STACK §3 | HIGH |
| Trader auth: Sui personal-msg sign-in + Iron Session | STACK §7 | HIGH |
| Operator auth: separate domain + WorkOS/Clerk + magic-link + WebAuthn + audit log | STACK §7 | HIGH |
| Per-trader vault is **owned-object** — never shared mutable | ARCH §1/§2 + PITFALLS 2.1 | HIGH |
| Leaderboard is **off-chain**, indexer-computed | ARCH §1 + PITFALLS anti-pattern | HIGH |
| Slippage params on-chain in versioned SlippageConfig; vault captures version at start | PITFALLS 1.7 + 3.6 + ARCH §1 | HIGH |
| Admin = `pause` + `allowlist` only; **no override path in contract** | PROJECT + STATE + ARCH §1 + PITFALLS 4.1 | HIGH |
| Backend never holds admin keys; admin-api returns unsigned txs | ARCH §4 | HIGH |
| Sui native MultiSig for upgrade caps from day 1 | PITFALLS 4.8 + STACK §1 | HIGH |
| Allowlist + invite-only is v1 Sybil mitigation; behavioral clustering is log-only | FEATURES + PITFALLS 3.1 | HIGH |
| Spot only in v1; no perps, prediction markets, airdrop hunting | PROJECT §13 + FEATURES C | HIGH |
| No fees, payouts, KYC in v1 | PROJECT §13 + FEATURES C | HIGH |
| SBT mutable, non-transferable, 5 fields per PROJECT | PROJECT + ARCH §1 + FEATURES B3 | HIGH |
| Restrict v1 to BTC/ETH/SOL majors only | PITFALLS 1.4 + FEATURES C9 | HIGH |
| Contract-level intent rate-limit + per-evaluation cap | PITFALLS 1.5 | MED on specific numbers |
| Beta opens on TWO blocking gates: 30-day backtest + 7-day forward-test | PROJECT + PITFALLS 1.6 | HIGH |

---

## 6. Open Clarification Questions — Deduplicated and Ranked

### Tier 1 — Blocks Phase 0

1. External audit of fill/slippage math — commissioned? when? budget? vendor? (PITFALLS 2.5)
2. Sui native MultiSig — key custody arrangement? (PITFALLS 4.8)
3. Linear (or equiv) as ticket tool, or Discord-only? (PITFALLS 4.6)
4. Live shadow-quote source on Sui — Cetus, Aftermath, 7K aggregator? (PITFALLS 1.1)
5. Pyth feed-ID coverage on Sui testnet for SOL/ETH/BTC — STATE.md blocker
6. Backend engineer onboarding date — STATE.md blocker; calibration owner

### Tier 2 — Blocks Phase 1

7. Pyth/Switchboard staleness threshold on Sui — default 10s via Wormhole
8. Slippage "house-conservative" tilt — default +2 bps against trader
9. Per-trader timezone anchor — in scope or "UTC for everyone"? (PITFALLS 4.9)
10. SBT art strategy — static-per-tier vs procedurally-generated vs on-chain SVG
11. Rate-limit specific values — `min_interval_ms` + max intents per evaluation
12. Sui Move 2024 friend syntax — `public(friend)` vs `package`-visibility (verification debt)
13. Sui event ingest — `suix_subscribeEvent` vs checkpoint polling (rec: polling for replay)

### Tier 3 — Blocks Phase 5+

14. Leaderboard refresh cadence — per-minute public, sub-second private
15. v1 cohort SBT in v2 — in-place evolution or read-only persistence? (affects soft-airdrop page copy)
16. "Abandon" semantic for mid-evaluation quit — distinct from rule-breach fail?
17. Behavioral Sybil thresholds — operator-review-only in v1 (rec); specific cluster thresholds

---

## 7. Risk Surface Map (P0 risks against phase shape)

| Phase | P0 risks landing here | Mitigation pattern |
|---|---|---|
| Phase 0 | Event schema drift (2.6); feature creep (4.7) | Codegen + CI lint gate; scope-lock doc |
| Phase 1 | Shared-object contention (2.1); upgrade-compat (2.3); Cetus-class precision (2.5); determinism break (1.7); override creep (4.1); oracle staleness (1.3) | Owned-object; upgrade-compat CI; fuzz harness; on-chain SlippageConfig; capability split; staleness reverts |
| Phase 2 | Generous slippage (1.1); forward-test gap (1.6); calibration drift (4.2) | Shadow-quote logger; forward-test gate planning; daily calibration alerts |
| Phase 3 | Promise inflation (3.4); override creep UI (4.1); oracle staleness UX (1.3) | Disclaimer everywhere; admin read-only for vaults; stale-feed pause UX |
| Phase 5 | Promise inflation (3.4) | Anti-promise disclaimer in every SBT/leaderboard view; soft-airdrop page |
| Phase 6 | Mid-beta recalibration invalidating in-flight (3.6); calibration drift (4.2) | Versioned model; vault captures version at start; daily alerts |
| Phase 7 | Forward-test failure (1.6); Cetus-class precision (2.5); override creep (4.1); promise inflation (3.4) | 7-day forward-test BLOCKING; external audit BLOCKING; operator playbook + language canon |

**Explicit risk gates the roadmap must surface (cannot hide inside tasks):**

1. End of Phase 1: upgrade-compat CI gate live; fuzz harness ≥N seconds per CI run.
2. End of Phase 2: shadow-quote logger writes `(sim_fill, live_quote, delta_bps)` for every test trade; 7-day median |delta_bps| measurement live.
3. End of Phase 6: 30-day historical backtest within ±5 bps on majors.
4. Start of Phase 7: 7-day live forward-test starts; must hold ±5 bps median.
5. Before beta open: external audit complete; restore drill executed with measured RTO; wallet matrix test passes.
6. Throughout Phase 7+: calibration-drift alert dashboard live; alert at 3 bps soft / 5 bps hard.

---

## 8. Tool-Access Caveat — Verification Debt

**All four research agents reported denied WebFetch/WebSearch access.** Consequences:

- **Version pins from training data (knowledge cutoff Jan 2026):** Sui CLI 1.40–1.45, Next.js 15 (may be 16), Tailwind 4 (may be 3.4 RC) — all flagged MED by STACK.md.
- **External incident specifics unverified:** Cetus 2025 post-mortem, FTMO/Topstep numerics (10% target, 5% DD), Hyperliquid retention specifics — flagged MED by FEATURES.md and PITFALLS.md.
- **Specific API names may have shifted:** `suix_subscribeEvent`, Pyth `get_price_no_older_than`, Sui Move 2024 `public(friend)` vs `package` — flagged MED-LOW by ARCH §9.

**Mitigation (must be in roadmap):**

1. **Insert a verification sprint** (Phase -1 or as Phase 0's first task) where SC engineer + BE engineer verify, with live web access: Sui CLI version + Move framework rev; Pyth feed-ID coverage on Sui testnet; Switchboard On-Demand on Sui mainnet; Cetus 2025 post-mortem; Pyth best practices.
2. **Output:** pinned-versions document committed before scaffolding starts. Every MED-confidence STACK.md item becomes HIGH or "verified-as-of-DATE."
3. **PITFALLS.md Sources footer** lists URLs for Phase 1 setup — treat as deliverable, not footnote.

Without this, verification debt leaks into Phase 1/2 as "weird bugs" attributable to assumed-wrong API behavior.

---

## 9. Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack — language/framework choices | HIGH | Rust+axum, TS+Hono, Next, shadcn, Pyth+Switchboard are dominant 2026 patterns |
| Stack — specific version pins | MEDIUM | Sui CLI, Next.js majors need live verification |
| Stack — vendor pricing | MEDIUM | Shinami/Vercel pricing changes |
| Features — A-tier table stakes | HIGH | Well-attested across web2 prop firms and crypto engagement |
| Features — B-tier specifics | MEDIUM | Patterns proven; specific numbers need design polish |
| Features — C-tier anti-features | HIGH | Explicit in PROJECT.md §13 or derivable from priority stack |
| Architecture — high-level decomposition | HIGH | 3 concentric rings, modular monolith, adapter seam well-grounded |
| Architecture — Sui Move specifics | MEDIUM | Friend-module, dynamic-field cost, event subscription mechanism flagged |
| Architecture — indexer at v1 scale | HIGH | 100-trader load on single Hetzner VM is feasible |
| Pitfalls — Sui Move | MEDIUM-HIGH | Documented; upgrade rules evolve |
| Pitfalls — Cetus 2025 | MEDIUM | Pattern real; root cause needs verification |
| Pitfalls — Pyth/Switchboard staleness | MEDIUM | Defaults are conventions, not standards |
| Pitfalls — operator-override | HIGH | Structural mitigation enforceable in code |
| Pitfalls — slippage fidelity techniques | HIGH | Standard quant practice |
| Pitfalls — engagement retention specifics | LOW-MEDIUM | Public retrospectives sparse |

**Overall:** MEDIUM-HIGH. Shape is well-understood; specific numerics need verification before lock-in.

---

## 10. Gaps to Address

1. **Verification debt** (§8) — biggest single gap; Phase 0 verification sprint.
2. **Backend engineer onboarding timing** — STATE.md blocker; calibration owner unstaffed.
3. **External audit decision + timing** — Tier-1; affects Phase 7 timeline by weeks.
4. **Specific numeric thresholds** — staleness reverts, oracle divergence halt, intent rate limits, residual alerts, "house-conservative" tilt. None can be TBD.
5. **SBT art and metadata strategy** — designer dependency; static saves weeks vs procedural.
6. **SBT profile URL structure** — `/profile/<sui-address>` is the natural v1 form; confirm this is the intended surface.
7. **v1→v2 SBT transition story** — affects soft-airdrop page copy.
8. **Per-trader timezone anchor** — touches vault schema, affects Phase 1 contract design.
9. **Test cohort logistics** — who/when for 5-invitee dry-run.
10. **Operator language canon + Notion playbook** — promise-inflation mitigation is procedural; needs a real document.

---

## 11. Recommendations for orc-clarify

1. Lead with Tier-1 open questions (§6); they block Phase 0 with downstream effects.
2. Do NOT re-ask the lock-ins (§5) — quote back: "we are treating these as locked; confirm or contest."
3. Surface verification debt (§8) — ask: "do we get live web access for Phase 0, or is the verification sprint an inviolable Phase 0 task?"
4. Audit decision is timeline-critical — extract firm answer or deadline-to-decide.
5. Backend engineer staffing — extract hire/assign date so calibration phase is plan-able.
6. For Tier-2 questions, suggest defaults and ask confirm/contest: 10s staleness threshold; +2 bps tilt; per-trader UTC default timezone; procedural SBT art with ~3 designs (one per tier); 2s min interval + 200 intents/eval; checkpoint polling for Sui events.

---

## 12. Recommendations for orc-generate

1. **Use the 6-phase shape in §3.** Phase 5 (Engagement) runs in parallel with Phase 3 completion.
2. **Make verification debt a Phase 0 deliverable** (§8), separate from monorepo scaffold.
3. **Bake risk gates from §7 into phase exit criteria** — not optional polish.
4. **Slippage model is its own phase-shaped artifact** spanning Phases 0/1/2/6/7. Consider a "Slippage Model Track" annotation across phases.
5. **Operator-override capability split (PITFALLS 4.1)** is an architectural constraint in Phase 1, not a Phase 6 UX item. Admin app's read-only constraint propagates from this.
6. **Cut order in §4** — if compressed to 14 weeks, follow that order. PITFALLS Phase 0/1/2/7 P0 items are non-cuttable.
7. **Avoid scope creep** by quoting the priority stack in every phase's "out of scope," especially Phase 5 (engagement) — the magnet for "wouldn't this be cool" features.

---

## Summary Card

- **Suggested phases:** 6 (Phase 4 slot removed; Phase 0–3 + 5–7 remain, plus verification sprint absorbed into Phase 0)
- **Parallelism:** Phase 5 (Engagement) runs in parallel with Phase 3 completion
- **Blocking gates:** 30-day backtest at end of Phase 6; 7-day forward-test at start of Phase 7; external audit before beta open
- **Critical-path lock-ins:** event schema (wk 0–1), vault API freeze (wk 6–7), slippage versioned config (Phase 1), backtest harness (Phase 2)
- **Overall confidence:** MEDIUM-HIGH. Shape sharp; specific numerics need verification before lock-in.
- **Biggest gap:** verification debt (§8) + BE engineer onboarding + audit decision.
