# Crypto-Native Prop Trading Firm — v1 Closed Beta

## Vision

> "A crypto-native proprietary trading firm — a platform where skilled traders pay a small evaluation fee, prove themselves in a sandbox environment, and earn access to real capital they can trade across multiple crypto venues. Profits are split between the trader and the platform."

V1 is **not** the full vision above. V1 is the closed-beta engagement loop that:

- Validates the evaluation mechanic against real crypto traders before any real capital is at stake.
- Keeps invited traders "entertained" through the months between v1 (closed beta on testnet, paper trading) and v2 (mainnet capital), via a tier ladder + leveling SBT + leaderboard that lean into the soft-airdrop psychology of crypto users — without ever making explicit airdrop promises.

In the user's words:

> "Given that the v1 process and v2 might take quite a significant amount of time to implement, I feel like it's good to keep the v1 users/traders entertained. We can allow them to grow their reputation... a lot of crypto users would jump on this opportunity, because they also believe that somehow they are farming for an airdrop by doing those evaluations and increasing their tiers."

## What We're Building

A two-chain (Sui + Solana) paper-trading evaluation platform where:

- Invited traders connect a wallet, pick a tier, and paper-trade against **live mainnet prices** with a calibrated slippage and fill model.
- The platform's smart contract is the execution surface. It accepts trade intents, models fills deterministically, enforces drawdown / daily-loss / profit-target rules, and emits pass/fail events.
- Passing a tier mints or levels up a mutable "v1 cohort" SBT and unlocks the next tier's harder evaluation.
- A public leaderboard ranks traders by highest tier reached, consistency, and total shadow P&L.
- Sui and Solana ship at full feature parity at v1 launch (Sui leads in build sequence; Solana is ported from Sui patterns).

## Why It Exists

Two problems converge:

1. **No crypto-native prop firm exists at scale.** Skilled crypto traders globally — especially in Africa, Southeast Asia, and Latin America — are blocked from traditional prop firms by geography, KYC, and fiat rails. They're also already trading the assets the platform would offer.
2. **Building real-capital infrastructure takes time.** The v2 build (real vault, mainnet DEX execution, payouts, risk engine for live capital) is months of engineering. Without v1, that entire window is dark — no users, no signal, no validated evaluation mechanic. V1 fills that window with a working, on-chain-verifiable engagement loop that recruits and retains the trader cohort v2 will need.

## Who It's For

- **Primary:** 50–100 invited crypto traders sourced from the founder's existing networks (Octant, Bungee, study groups, Solana dev circles). Already crypto-native, already trade, already have wallets.
- **Secondary:** The operator team (initially 1 person, the founder), who needs visibility into beta health, slippage-model calibration, and trader behavior.

## Core Essence

**Paper-trading is indistinguishable from mainnet execution.** The price feed, slippage, and fill behavior in the evaluation must match what the trader would experience executing on mainnet.

If this breaks:
- Traders don't trust evaluations.
- Pass rate is meaningless as a skill signal.
- Funded mainnet results in v2 will diverge from beta results, invalidating everything learned.

Every other v1 feature is dressing on top of this.

## Actors

| Actor | Role |
|-------|------|
| **Trader** | Submits trade intents to the contract. Reads their dashboard. Receives pass/fail events. Can withdraw nothing in v1 (no real capital). |
| **Operator** | Manages the beta allowlist, monitors aggregate risk, handles support, tunes risk parameters off-chain. Cannot reverse on-chain rule enforcement. |
| **Smart contract (system)** | First-class system actor. Accepts trade intents, models fills using oracle + slippage model, enforces rules, emits events, mints/levels SBTs. Treated as a first-class actor, not a passive vault. |
| **Backend / risk service** | Streams oracle prices (Pyth / Switchboard), computes slippage models, indexes on-chain events into Postgres/TimescaleDB, serves real-time dashboards via WebSocket, alerts operator on anomalies. |

## User Flow

```
Operator → invites trader (wallet allowlist)
Trader   → connects wallet (Sui or Solana)
         → picks tier (Starter → Basic → Pro)
         → paper-trades against live mainnet prices
Contract → enforces DD + daily loss + profit target
         → emits pass/fail events
         → mints/levels SBT on pass
         → unlocks next tier evaluation
Backend  → streams oracle prices, models slippage,
         → indexes events, drives leaderboard
```

## Tier Ladder (v1)

| Tier | Profit target | Max DD | Shadow allocation |
|------|---------------|--------|-------------------|
| Starter | 8% | 10% | $10,000 |
| Basic | 8% | 8% | $25,000 |
| Pro | 10% | 8% | $50,000 |

- Pass tier N → unlock tier N+1 evaluation.
- Higher tier = better leaderboard position + stronger SBT level.
- No real capital backs any of this. Shadow balances only.

## v1 Cohort SBT

One mutable SBT per wallet, minted on first tier pass. Fields:

- `highest_tier` (Starter / Basic / Pro)
- `total_passes`
- `total_shadow_pnl`
- `total_trades`
- `last_active_at`

Designed so it can either evolve into the Phase 3 production reputation system or be cleanly superseded by it. **Never marketed as an airdrop allocation.** The credential's value rests on what it demonstrably proves about the holder's trading.

## Priority Stack

| Priority | Component | Survives 50% cut? |
|----------|-----------|-------------------|
| P0 | Sui contract + slippage/fill model | Yes |
| P0 | On-chain rule enforcement | Yes |
| P1 | Trader dashboard | Yes |
| P1 | SBT + tier ladder + leaderboard | Yes (retention is load-bearing) |
| P2 | Solana port (parity at launch) | Slips to Phase 2 if forced |
| P2 | Admin dashboard (full) | Notion + Discord fallback |

## Success Criteria

- [ ] **Engagement:** 30+ invited traders complete at least one full evaluation cycle (pass or fail) during the closed beta window.
- [ ] **Model fidelity:** Slippage model produces fills that match mainnet execution within ±5 bps on majors (SOL, ETH, BTC pairs) when backtested against 30 days of historical swap data.
- [ ] **Enforcement integrity:** Zero pass/fail decisions during beta require operator override or re-adjudication. Every outcome is explicable from on-chain data alone.
- [ ] **Cross-chain parity:** Sui and Solana ship the v1 evaluation flow simultaneously; a trader can complete the same evaluation on either chain.
- [ ] **Engagement loop integrity:** The SBT mint/level + tier unlock loop works end-to-end across all three tiers without operator intervention.

## Out of Scope (for v1, explicit)

| Out | Reason |
|-----|--------|
| Real capital + mainnet DEX execution | V2 territory. Untested risk model. Closed beta exists precisely so this doesn't have to be solved yet. |
| Airdrop hunting + prediction markets | Cannot be meaningfully paper-traded. Airdrops require real qualifying txs; prediction markets need real settlement. Deferred per PRD §13.3. |
| Real stablecoin payouts | No real capital to pay out. |
| Auto-scaling capital, profit-split ladder | Needs real capital to mean anything. |
| Multi-category unlocks beyond spot | Spot only in v1; perps comes in Phase 2. |
| Affiliate program, DAO governance, LP vault, token | Phase 3+. |
| Production reputation SBT / composability primitives | V1 cohort SBT is the placeholder; production schema waits until v2 use cases are visible. |
| KYC | Closed beta is invite-only, no fees, no fiat. Add only when jurisdictions require it post-v2. |

## Technical Notes

- **Custody model:** Non-custodial. Trader signs trade intents; the platform's contract is the execution surface and enforcer. Rules are enforced pre-trade because the contract *is* the only execution path in v1 — no third-party DEX execution.
- **Slippage model owner:** Backend engineer. Initial model: oracle price + parameterized spread/depth derived from historical mainnet swap data. Calibrated against 30 days of backtest before beta opens.
- **Chain sequence:** Sui first (Move objects naturally model per-trader evaluation vaults; resource semantics give stronger enforcement guarantees). Solana ported from Sui patterns once Sui is internally testing.
- **Indexer:** Self-hosted Postgres + TimescaleDB on a single VM for v1.

## Timeline

**14–18 weeks (~3.5–4.5 months)** for v1 closed beta launch.

| Weeks | Focus |
|-------|-------|
| 0–3 | Sui SC scaffolding + price feed integration |
| 0–3 | Slippage model v1 (BE) |
| 3–6 | Sui evaluation contract + trader UI |
| 3–6 | Indexer + dashboard backend |
| 6–9 | Solana port + cross-chain abstraction layer |
| 6–9 | SBT + tier ladder + leaderboard logic |
| 9–12 | Model calibration vs historical mainnet data |
| 9–12 | Admin dashboard + ops tooling |
| 12–15 | Internal testing (both chains) |
| 15–18 | Invite-only beta opens |

## Team

| Role | Person | Scope in v1 |
|------|--------|-------------|
| Product + frontend + some backend | Founder (you) | Trader app, admin app, product calls, some BE glue |
| Smart contract engineer | 1 person | Sui Move + Solana Anchor contracts, SBT, enforcement |
| Backend engineer | 1 person | Indexer, price feed, slippage model, real-time service |
| Designer | 1 person | Trader dashboard, leaderboard, public profile, brand |

## Open Questions Deferred to Later Phases

- **Custody model for v2 funded accounts.** Pre-trade enforcement against third-party DEXes is hard; the realistic enforcement is "after the swap, check invariants; if violated, revert." This must be settled before any mainnet capital deploys.
- **Slippage model v2.** V1 model is calibrated to historical mainnet data; v2 may need a live mainnet shadow-execution comparison loop.
- **SBT transition from v1 cohort to production reputation.** Either the v1 SBT evolves in place or a clean migration is designed before Phase 3.
- **Airdrop/category strategy.** Airdrop hunting and prediction markets are deferred but need design work before Phase 2 finishes.
- **Token decision.** Defaulted to no token in v1. Phase 4 decision.

---

## Clarification Decisions Log

Decisions reached during the post-research clarification rounds. Treat as binding constraints on the plan.

### Round 1 (Tier-1 blockers)

- **No external smart-contract audit for v1.** Closed-beta is invite-only with no real capital at stake. Correctness coverage in v1 comes from: (1) fuzz harness on Sui Move + Solana Anchor contracts, (2) property-based tests comparing on-chain Move/Anchor output vs Rust reference implementation of the slippage model, (3) the blocking 7-day live forward-test gate before beta opens, (4) the blocking 30-day historical backtest gate at end of Phase 6. **External audit becomes a hard requirement before v2 (real capital).** Add to v2 prerequisites.
- **Backend engineer is onboard at week 0.** Full parallel workstreams from day 1: BE engineer on price feed + slippage calibrator + indexer starting week 0 alongside SC engineer's Sui scaffolding. Plan assumes this and proceeds with maximum parallelism.
- **Shadow-quote source on Sui = 7K Protocol aggregator API.** Single integration; routes across Cetus, Aftermath, Turbos, Kriya; tracks realistic aggregator-quality fills that a real trader would experience. Solana side uses Jupiter aggregator for the same purpose.
- **Operational tooling:**
  - **Linear** for ticket queue (audit trail, SLA discipline, mandatory for every beta support touchpoint).
  - **Discord + Notion** for day-to-day communication and documentation (operator playbook, language canon live here).
  - **Squads** as the upgrade authority for Solana programs (2/3 multisig: founder + SC engineer + operator).
  - **Sui native MultiSig** as the upgrade authority for Sui packages (same 2/3 quorum).
  - Multisig setup is a **Phase 0 deliverable**, not deferred — single-key risk during Phase 1-3 deploys is unacceptable.

### Round 2 (Tier-2 numerics — Phase 1 contract parameters)

- **Oracle staleness thresholds:** Solana revert if Pyth price age > 5s; Sui revert if Pyth price age > 10s (higher Sui threshold accounts for Wormhole VAA posting latency).
- **Slippage tilt:** +2 bps against the trader on every modeled fill. The simulated fill is always slightly worse than the median observed fill on the live aggregator. Honest enough to trust, conservative enough that passers would also pass on mainnet.
- **Calibration drift alerts:** soft alert when |residual median| ≥ 3 bps over 24h; hard alert at ≥ 5 bps over 24h.
- **Daily-loss-limit timezone:** **UTC for everyone.** Daily resets at 00:00 UTC for all traders. Vault state stores `daily_loss_reset_at` timestamp; no per-trader timezone field. Dashboard shows countdown `"Daily reset in Xh Ym"`.
- **SBT visual strategy:** **Static per tier (3 designs)** — Starter / Basic / Pro. Pass triggers metadata-URI update to swap the rendered image. Designer ~3-5 days; SC engineer ~1 day. Reversible if v1.5 wants procedural or on-chain SVG later.
- **Trade-intent rate limit:** `min_interval` = 1s (Solana) / 2s (Sui); `MAX_INTENTS` = 200 per evaluation. Per-vault state holds `last_intent_at` + `intent_count`; vault reverts `RATE_LIMITED` or `INTENT_CAP` accordingly. Blocks HFT/latency-arbitrage strategies; covers swing + discretionary. Tunable post-beta.

### Round 3 (Tier-3 — engagement narrative + post-launch behavior)

- **Cross-chain identity = separate per-chain profiles.** URLs: `/trader/sui/<addr>` and `/trader/solana/<addr>`. No unification layer in v1. Trader cross-links them in their own bio if they want. Reversible — a signed-attestation unification layer can be added later without breaking existing profiles.
- **v1 SBT → v2 transition = in-place evolution.** Same SBT object/PDA across v1 and v2. v1 fields (`highest_tier`, `total_passes`, `total_shadow_pnl`, `total_trades`, `last_active_at`) stay; v2 adds (`real_capital_passes`, `real_pnl`, `funded_at`, `payout_history`). The v1 cohort SBT is the genesis credential — never re-issued, never transferable, remains top-tier identity primitive in v2. **Soft-airdrop page copy reflects this without using token/airdrop language.**
- **Mid-evaluation abandon = NOT supported.** The vault has no `abandon_evaluation()` entrypoint. A trader who wants to quit simply stops trading. After **7 days of inactivity** the vault auto-terminates with reason `Inactive` (distinct from `Failed` and `Passed` in the SBT history). **Risk flagged:** traders may hold open positions that slowly bleed without crossing DD; indexer must monitor this and the operator playbook must include a manual nudge protocol for stalled vaults. Phase 1 contract must implement the `Inactive` termination path; Phase 2 indexer must surface "stalled vault" alerts to the operator.
- **Soft-airdrop messaging stance = neither promise nor deny.** Public copy never uses the words "token," "airdrop," "allocation," or "rewards beyond profit splits." The `/v1-cohort` page describes the SBT as verifiable proof of trading skill earned during closed beta, non-transferable, mint-once-per-wallet, foundational credential of the platform. **No FAQ entry on token.** Operator playbook (private, in Notion) prohibits operators from speculating about token allocation in any channel; if asked, redirect to public copy. This is the FTMO + Hyperliquid playbook — preserves legal posture, preserves credibility if there is never a token, preserves optionality if there ever is.
