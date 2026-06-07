# Roadmap: Crypto-Native Prop Trading Firm — v1 Closed Beta

## Progress Markers
`[ ]` Not started · `[~]` In progress · `[x]` Complete · `[!]` Blocked

## Timeline: 14–18 weeks total. Team: founder + 1 SC eng + 1 BE eng + 1 designer.

## Phase Dependencies

```
Phase 0 → Phase 1 ──────────────────┐
       ↘ Phase 2 ┐                  ├→ Phase 6 → Phase 7
                 ├→ Phase 3         │
       ↘ Phase 1 ┘                  │
                  Phase 5 ──────────┘
```
Phases 1/2/3 overlap heavily (wk 1–9). Phase 5 (Engagement) runs in parallel with Phase 3 completion (wk 7–12). Phase 7 ends with beta open.

## Phases

### Phase 0: Foundation [ ]
**Goal:** Monorepo + toolchain + event schema + multisig + Hetzner stack live; verification debt cleared.
**Tasks:** ~8 atomic. **Depends on:** None. **Requirements:** [REQ-08, REQ-09]
**Verification:** `pnpm build` green; `cargo build` green; event schema codegen drift check; Pyth Hermes WS receives ticks; both multisigs control test deploy keys.

### Phase 1: Sui Contract Core [ ]
**Goal:** Sui evaluation_vault + slippage_model (versioned) + cohort_sbt with rule enforcement & capability-split admin.
**Tasks:** ~10 atomic. **Depends on:** Phase 0. **Requirements:** [REQ-02, REQ-06, REQ-07, REQ-12]
**Verification:** `sui move test` green; fuzz harness runs ≥N seconds in CI; upgrade-compat gate green; property tests vs Rust reference impl match within 1 unit of last place.

### Phase 2: Backend / Indexer [ ]
**Goal:** chain-adapter/sui + Postgres+TSDB + price feed + slippage-calibrator v0 + shadow-quote logger via 7K Protocol.
**Tasks:** ~9 atomic. **Depends on:** Phase 0; benefits from Phase 1 events. **Requirements:** [REQ-01, REQ-08]
**Verification:** indexer cold-replays from cursor; shadow-quote logger writes `(sim, live, delta_bps)` per trade; stalled-vault detector fires on 7-day inactivity.

### Phase 3: Trader App MVP [ ]
**Goal:** Wallet connect + allowlist + evaluation flow + live equity curve + pass/fail UI on Sui.
**Tasks:** ~9 atomic. **Depends on:** Phases 1 + 2. **Requirements:** [REQ-04, REQ-05]
**Verification:** Playwright end-to-end happy path passes; stale-feed pause UX triggers; trade-intent shows slippage tilt pre-submit.

*(Phase 4 has been removed from this revision.)*

### Phase 5: Engagement Layer [ ] *(parallel with Phase 3 completion)*
**Goal:** Public leaderboard + trader profile pages + SBT level-up + `/v1-cohort` page with soft-airdrop messaging stance.
**Tasks:** ~7 atomic. **Depends on:** Phase 2 (indexer) + designer SBT art. **Requirements:** [REQ-04, REQ-11]
**Verification:** SBTs render in Suiet + Sui Wallet; `/v1-cohort` page contains zero token/airdrop language (CI lint); leaderboard sorts deterministically.

### Phase 6: Calibration + Admin [ ]
**Goal:** 30-day backtest harness passes ±5 bps; admin app (pause + allowlist + read-only); calibration drift alerts live.
**Tasks:** ~6 atomic. **Depends on:** Phases 2 + 3. **Requirements:** [REQ-01, REQ-06]
**Verification:** **GATE: 30-day historical backtest within ±5 bps on majors.** Admin app has no vault-mutating endpoint (CI audit). Drift alerts wired to Discord at 3 / 5 bps.

### Phase 7: Hardening + Beta [ ]
**Goal:** Forward-test pass; restore drill measured; operator playbook live; beta opens to 50–100 invited traders.
**Tasks:** ~7 atomic. **Depends on:** Phase 6. **Requirements:** [REQ-05, REQ-10, REQ-11]
**Verification:** **GATE: 7-day live forward-test holds ±5 bps median residual.** Backup restore RTO measured. Wallet matrix test passes. Language-canon Notion doc signed. Test cohort dry-run (5 invitees) completes without operator override.

## Requirements (referenced by phases)

| ID | Requirement | Source |
|----|-------------|--------|
| REQ-01 | Slippage model matches mainnet within ±5 bps on majors | PROJECT.md Success Criteria |
| REQ-02 | Zero rule-enforcement disputes during beta | PROJECT.md Success Criteria |
| REQ-04 | SBT + tier-unlock loop works end-to-end without operator help | PROJECT.md Success Criteria |
| REQ-05 | 30+ invited traders complete ≥1 full evaluation | PROJECT.md Success Criteria |
| REQ-06 | Admin = pause + allowlist only; no override path in contract | Clarify R1 + PITFALLS 4.1 |
| REQ-07 | Versioned on-chain SlippageConfig; vault captures version at start | Clarify R2 + PITFALLS 3.6 |
| REQ-08 | Canonical event schema via codegen + CI gate | STATE.md + PITFALLS 2.11 |
| REQ-09 | Multisig upgrade authority on Sui from day 1 | Clarify R1 + PITFALLS 4.8 |
| REQ-10 | 7-day forward-test gate before beta opens | PROJECT.md + PITFALLS 1.6 |
| REQ-11 | Soft-airdrop messaging stance: no token/airdrop language in public copy | Clarify R3 + PITFALLS 3.4 |
| REQ-12 | UTC daily-loss reset; static SBT art (3 designs); rate-limit 2s + 200 cap | Clarify R2 |

## Success Criteria (from PROJECT.md)
- [ ] 30+ invited traders complete ≥1 full evaluation
- [ ] Slippage model matches mainnet within ±5 bps on majors
- [ ] Zero rule-enforcement disputes during beta
- [ ] SBT + tier-unlock loop works without operator intervention

## Risks & Mitigations (from STATE.md + PITFALLS.md)

| Risk | Mitigation | Phase |
|------|------------|-------|
| Slippage model too generous → invalid passes | Backtest + forward-test gates; shadow-quote logger; daily drift alerts | 2, 6, 7 |
| Operator override creep | Capability split: contract has no vault-mutating admin path | 1 |
| Event schema drift | Codegen + CI gate | 0 |
| Indexer SPOF / data loss | Restore drill with measured RTO before beta opens | 7 |
| Promise inflation (token speculation) | Language canon + no token/airdrop in public copy | 5, 7 |
| Mid-beta recalibration invalidates in-flight | Versioned SlippageConfig; vault captures version at start | 1 |
| Pyth feed-ID gap on Sui testnet | Phase 0 verification sprint identifies gaps before Phase 1 starts | 0 |

## Next Steps
After ROADMAP.md is reviewed, run `/orc-swarm <phase description>` to generate detailed PLAN.md for any phase you're ready to start. Phase 0 is the natural starting point.
