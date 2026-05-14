---
phase: 07-hardening-beta
type: execute
depends_on: ["05-engagement-layer", "06-calibration-admin"]
files_modified:
  - scripts/forward-test/
  - scripts/restore-drill.sh
  - docs/operator/playbook.md
  - docs/operator/language-canon.md
  - infra/wallet-matrix/
  - .github/workflows/forward-test-gate.yml
autonomous: true
requirements: [REQ-05, REQ-10, REQ-11]
must_haves:
  truths:
    - "7-day live forward-test passes: median |delta_bps| <= 5 bps on majors against live aggregator quotes."
    - "Backup + restore drill executed from a cold Backblaze B2 snapshot; measured RTO recorded in operator playbook."
    - "Wallet matrix test passes on Suiet, Sui Wallet, Backpack-Sui, Phantom, Backpack-Solana, Solflare."
    - "Operator playbook with full language canon committed to repo and mirrored to Notion."
    - "Linear ticket workflow operational; weekly scope-review cadence scheduled."
    - "Test cohort dry-run with 5 internal invitees completes a full evaluation cycle on both chains without operator override."
    - "Beta open: 50-100 invitees added to allowlist on both chains; soft launch communications sent."
  artifacts:
    - "7-day forward-test report"
    - "Restore-drill report with measured RTO"
    - "Operator playbook + language canon (full)"
    - "Beta-open allowlist (mirrored in Linear)"
  key_links:
    - from: "scripts/forward-test/runner.sh"
      to: "services/risk-engine/src/calibrator/v1"
      type: "function_call"
---

<objective>
Run the final pre-beta gates: 7-day live forward-test (BLOCKING), backup-and-restore drill with measured RTO, wallet matrix test, operator playbook + full language canon, test cohort dry-run with 5 internal invitees, and beta open to 50-100 invited traders. This phase is mostly verification + operational discipline rather than new code. The forward-test gate is what makes the "mainnet equivalent" claim defensible against day-1 beta participants. The restore drill is what protects against the indexer SPOF. The operator playbook is what prevents promise-inflation and override creep from emerging in real operations.
</objective>

<context>
@.claude/plans/Crypto-Native/PROJECT.md
@.claude/plans/Crypto-Native/STATE.md
@.claude/plans/Crypto-Native/ROADMAP.md
@.claude/plans/Crypto-Native/research/PITFALLS.md (§1.6 forward-test, §4.3 restore drill, §4.5 wallet edge cases)
@docs/operator/language-canon.md
</context>

<tasks>

<task type="auto" id="7.1" depends_on="">
  <name>7-day live forward-test gate — BLOCKING</name>
  <files>
    scripts/forward-test/runner.sh
    scripts/forward-test/report.ts
    .github/workflows/forward-test-gate.yml
    reports/forward-test/
  </files>
  <context>
    Why: REQ-10 + PROJECT.md beta-open gate #2. PITFALLS 1.6 — historical backtest is necessary but not sufficient; the model must hold against live market conditions for 7 consecutive days before traders trust it.
    Pattern: leverage shadow-quote logger from Phase 2. Drive synthetic test trades through the system at 1Hz over 7 days; aggregate `delta_bps` against live 7K (Sui) / Jupiter (Solana) quotes; success criterion = median |delta_bps| ≤ 5 bps for each of SOL/ETH/BTC across the full window.
  </context>
  <action>
    1. `runner.sh`: starts a long-running synthetic-trade generator (1 Hz, varied size + side + symbol) targeting a dedicated "forward-test" vault on each chain.
    2. `report.ts`: daily aggregation of shadow_quotes; produces `reports/forward-test/day-N.md` with median + p95 per symbol + cumulative for the run.
    3. `forward-test-gate.yml`: scheduled daily; on day 7, runs final aggregation. If any of SOL/ETH/BTC median > 5 bps for the full 7-day window, fails the gate.
    4. **GATE:** beta cannot open until the 7-day window completes with all 3 majors within spec. If the gate fails, the model is recalibrated (governance action via multisig) and the 7-day window restarts.
    **Avoid:** running the forward-test against historical data (defeats the purpose); accepting near-miss readings; restarting the window without recalibrating.
  </action>
  <verify>day-7 report shows all 3 majors median <= 5 bps; cumulative p95 <= 12 bps</verify>
  <done>
    - [ ] Forward-test generator runs continuously for 7+ days
    - [ ] Daily reports archived
    - [ ] **GATE PASSED:** median |delta_bps| <= 5 bps on all 3 majors
  </done>
  <rollback>kill forward-test generator; archive reports</rollback>
</task>

<task type="auto" id="7.2" depends_on="">
  <name>Backup + restore drill from cold Backblaze B2 snapshot; measure RTO</name>
  <files>
    scripts/restore-drill.sh
    docs/operator/runbook-restore.md
    reports/restore-drill/<date>.md
  </files>
  <context>
    Why: PITFALLS 4.3 — the indexer is a SPOF; the only durable mitigation is a tested restore procedure with a measured Recovery Time Objective.
    Pattern: spin up a fresh Hetzner VM; pgbackrest restore from B2 cold backup; replay indexer cursor from on-chain truth; measure end-to-end time from "primary VM dead" to "WS gateway serving fresh data."
  </context>
  <action>
    1. Provision a temporary "DR drill" Hetzner VM.
    2. `restore-drill.sh`: pulls latest pgbackrest backup from B2; restores to the DR VM; starts the indexer; lets it catch up to head from on-chain RPC.
    3. Measure: time-to-restore (pgbackrest), time-to-catchup (indexer to head), time-to-first-WS-message-from-gateway. Sum = effective RTO.
    4. Write report to `reports/restore-drill/<date>.md` with measured timings.
    5. Update `docs/operator/runbook-restore.md` with the exact (validated) procedure.
    6. Acceptance: RTO ≤ 2 hours for beta. If it's longer, identify the slowest step and shorten it (likely: indexer catch-up — pre-snapshot the indexer Postgres alongside the chain replay).
    **Avoid:** "I've read the runbook" as acceptance (must execute); skipping the indexer catch-up phase (the SPOF is data freshness, not just availability).
  </action>
  <verify>open reports/restore-drill/<date>.md; confirm measured RTO; confirm DR VM serving fresh data identical to primary</verify>
  <done>
    - [ ] Restore drill executed end-to-end
    - [ ] RTO measured and <= 2h
    - [ ] Runbook updated with validated steps
    - [ ] DR VM torn down after drill
  </done>
  <rollback>tear down DR VM; archive drill report regardless of outcome</rollback>
</task>

<task type="auto" id="7.3" depends_on="">
  <name>Wallet matrix test (Suiet, Sui Wallet, Backpack-Sui, Phantom, Backpack-Solana, Solflare)</name>
  <files>
    infra/wallet-matrix/test-plan.md
    infra/wallet-matrix/results/<date>.md
    apps/trader/e2e/wallet-matrix/
  </files>
  <context>
    Why: REQ-05 + PITFALLS 4.5 — wallet adapter edge cases reliably die in production unless the entire matrix is verified by hand + automation.
    Pattern: a checklist run by a human on real builds of each wallet; covers connect, sign personal-message, sign transaction, reject transaction, reconnect after browser refresh, multi-account switching.
  </context>
  <action>
    1. `test-plan.md`: list of test cases per wallet — connect, sign-in personal-message, open evaluation, submit trade, switch account mid-session, refresh-browser-persists-session, log out.
    2. For each of the 6 wallets, run all test cases on a clean browser profile; record results in `results/<date>.md`.
    3. Convert at least 2 wallets (Suiet + Phantom) into Playwright fixtures and add to CI so future regressions are caught automatically.
    4. File Linear tickets for any P0/P1 failures discovered.
    **Avoid:** skipping the "switch account mid-session" case (real users do this constantly); accepting "works on my machine"; allowing Playwright fixtures to mock the full matrix (need real wallet builds in CI for at least the 2 priority wallets).
  </action>
  <verify>open results/<date>.md; verify all 6 wallets × ~7 cases ≈ 42 test cases recorded; zero P0 failures open</verify>
  <done>
    - [ ] All 6 wallets tested on full case list
    - [ ] Suiet + Phantom Playwright fixtures in CI
    - [ ] Any P1+ failures triaged + fixed before beta open
  </done>
  <rollback>archive test results; revert any fixes that broke other paths</rollback>
</task>

<task type="auto" id="7.4" depends_on="">
  <name>Operator playbook (full) + Linear ticket workflow + weekly scope-review cadence</name>
  <files>
    docs/operator/playbook.md
    docs/operator/language-canon.md (extended)
    docs/operator/runbook-pause.md
    docs/operator/runbook-allowlist.md
    docs/operator/runbook-trader-support.md
    .linear-templates/
  </files>
  <context>
    Why: REQ-11 + PITFALLS 3.4 + 4.1 — operational discipline is the entire mitigation here. The playbook codifies what the contract+CI gates can't enforce: how to talk, when to escalate, when not to override.
    Pattern: Notion + repo dual-home; canonical version in repo; Notion mirrors automatically via a CI job.
  </context>
  <action>
    1. `playbook.md`: index of all runbooks + on-call rotation + escalation paths + decision log template.
    2. `language-canon.md` (extended): canonical responses to: "Will there be a token?", "Will I get an airdrop?", "Can you override my failed evaluation?", "Why did my trade fill at that price?". Every answer rehearsed and committed to writing.
    3. `runbook-pause.md`: when to pause, who signs the multisig action, communication template, how to unpause.
    4. `runbook-allowlist.md`: how invite codes work (if any), how to add a wallet, audit trail expectations.
    5. `runbook-trader-support.md`: tiered response by Linear severity; SLA targets (P0 = 4h, P1 = 24h, P2 = 1wk).
    6. Linear templates: bug, support, incident, governance-action. CI mirrors playbook to a Notion doc on every merge.
    7. Weekly scope-review meeting scheduled on calendar; agenda template in `docs/operator/scope-review.md`.
    **Avoid:** docs that no one has read; canonical language with hedges ("we don't currently plan" was explicitly rejected in Clarify R3); SLA targets that are aspirational rather than committed.
  </action>
  <verify>operator team signs off on having read all 5 docs; Linear templates render correctly; first scope-review meeting on calendar</verify>
  <done>
    - [ ] All 5 operator docs complete, committed, mirrored to Notion
    - [ ] Linear templates active
    - [ ] Weekly scope-review cadence scheduled
    - [ ] Operator signoffs collected
  </done>
  <rollback>git checkout -- docs/operator/ .linear-templates/</rollback>
</task>

<task type="auto" id="7.5" depends_on="7.1,7.2,7.3,7.4">
  <name>Test cohort dry-run with 5 internal invitees + beta open</name>
  <files>
    docs/launch/beta-checklist.md
    docs/launch/beta-comms-templates.md
    reports/launch/dry-run.md
    reports/launch/beta-open-summary.md
  </files>
  <context>
    Why: REQ-05 — the final pre-launch safety net. PITFALLS 3.5 — public leaderboard demoralization, mid-evaluation friction, and any UX cliff is best surfaced by a controlled internal cohort before opening the funnel.
    Pattern: 5 internal invitees (operator + SC engineer + BE engineer + founder + designer) complete a full evaluation cycle on Sui and Solana. Triage any P0/P1 issues. Then open the gate to the broader allowlist.
  </context>
  <action>
    1. Onboard the 5 internal traders; each completes Starter on both chains; at least 2 attempt Basic.
    2. Capture issues in Linear with severity; resolve all P0/P1 before public beta.
    3. `dry-run.md`: report each tester's experience, time to complete, friction points, suggested improvements.
    4. Beta-open prep: assemble the 50-100 invitee allowlist (mirror in Linear); send invite comms using `beta-comms-templates.md` (signal-only — no token/airdrop language); stagger invitations over 3-5 days to keep load manageable.
    5. Add invitees to on-chain allowlist via multisig governance action.
    6. Monitor first-week metrics: time-to-first-trade, evaluation pass rate, support ticket volume, calibration drift status.
    7. `beta-open-summary.md`: written at +7 days from beta open; first measurement against PROJECT.md success criteria.
    **Avoid:** opening beta with P0 issues unresolved; using AI-generated beta comms (the language canon is hand-crafted); flooding all 100 invitees in a single batch.
  </action>
  <verify>5 internal testers signed off; allowlist mirrored in Linear; first invite cohort sent; first metrics dashboard live</verify>
  <done>
    - [ ] Internal dry-run complete with zero unresolved P0/P1
    - [ ] Beta open communications sent to first cohort
    - [ ] First-week metrics dashboard active
    - [ ] beta-open-summary.md scheduled for +7 days
  </done>
  <rollback>pause beta via multisig; revoke allowlist entries; refund engagement (closed beta has no fees so this is a noop)</rollback>
</task>

</tasks>

<verification>
- [ ] **GATE: 7-day forward-test report shows median |delta_bps| <= 5 bps on all 3 majors**
- [ ] **GATE: Restore drill RTO measured and within target**
- [ ] Wallet matrix test results documented; no open P0/P1
- [ ] Operator playbook + language canon committed + mirrored to Notion
- [ ] Linear ticket workflow + weekly scope-review scheduled
- [ ] Internal dry-run with 5 testers complete; no unresolved P0/P1
- [ ] First beta cohort allowlisted + invited
- [ ] First-week metrics dashboard tracking success criteria
</verification>

<success_criteria>
Phase 7 is complete when both blocking gates are passed (7-day forward-test within spec; restore drill RTO measured ≤ 2h), the wallet matrix is verified across 6 wallets, the operator playbook + language canon is in production use with the team trained on it, the internal dry-run cohort has completed evaluations with zero unresolved P0/P1 issues, and the first batch of 50-100 invited beta traders has been allowlisted on both chains with invitations sent. The platform is now live in closed beta. The first +7-day summary report will measure actual cohort behavior against the PROJECT.md success criteria — that's the start of beta operations, beyond this plan's scope.
</success_criteria>

<output>
Create `.claude/plans/Crypto-Native/phases/07-hardening-beta/SUMMARY.md` after completion, documenting task results and any deviations from the plan.
</output>
