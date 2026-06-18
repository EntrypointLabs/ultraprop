# SCOPE-LOCK.md

Every item below is a hard NO for v1 closed beta. Revisit only during v2 planning.

Source of truth: `docs/plans/Crypto-Native/PROJECT.md` § "Out of Scope (for v1, explicit)". Mirrored here verbatim and enumerated one-line-per-item so it can be pinned in Linear and Notion without ambiguity. Soft language ("probably out of scope", "maybe later") is forbidden — every item is a hard NO until v2 planning explicitly revisits it.

## Hard-NO list (v1)

- Real capital — v1 is shadow-allocation only; introducing real trader capital is v2 territory and requires the funded-vault custody model, payouts, and live risk engine that v1 deliberately defers.
- Mainnet DEX execution — the platform smart contract is the only execution surface in v1; routing fills through Cetus / Aftermath / Kriya on mainnet requires the v2 custody model and an audited post-trade enforcement path.
- Airdrop hunting — cannot be meaningfully paper-traded; airdrops require real qualifying transactions on mainnet, which v1's paper-trading sandbox cannot produce.
- Prediction markets — require real settlement against an external oracle outcome; outside the spot-only evaluation surface and deferred per PRD §13.3.
- Real stablecoin payouts — no real capital is at stake in v1, so there is nothing to pay out; rails (Squads payout vault, fiat off-ramp, jurisdictional KYC) all wait for v2.
- Auto-scaling capital — needs real capital to mean anything; v1 shadow allocations are fixed per tier ($10k / $25k / $50k).
- Profit-split ladder — needs real capital and real payouts to be meaningful; v1 paper-trades against a calibrated slippage model with no economic stake to split.
- Multi-category unlocks beyond spot — spot only in v1; perps come in Phase 2, options / structured products are post-v2.
- Affiliate program — Phase 3+ retention play; v1 is invite-only closed beta from the founder's existing networks, so referral surface is intentionally minimal.
- DAO governance — Phase 3+; introducing token-voting in v1 would force premature token decisions and dilute the closed-beta engagement signal.
- LP vault — Phase 3+ liquidity-provisioning surface; v1 has no real capital to LP, and modeling LP returns inside the slippage model would conflate two evaluation surfaces.
- Token — Phase 4 decision per PROJECT.md; closed beta runs with no token, no public discussion of a token, and operator playbook explicitly bans operators speculating about token allocation.
- Production reputation SBT — v1 ships the minimal "cohort SBT" (5 fields per PROJECT.md); the production reputation schema waits until v2 use cases are visible so v1 doesn't bake in a schema that has to migrate.
- Composability primitives — exposing SBT fields or vault state to third-party protocols (lending markets, leaderboard aggregators, etc.) is v2+; v1 keeps the SBT a closed credential surface so we don't lock in an ABI before the production schema lands.
- KYC — closed beta is invite-only, no fees, no fiat, no jurisdictional surface that requires KYC; add only when post-v2 jurisdictions require it.

## Why this file is binding

PITFALLS 4.7 (feature creep) — closed beta is the prime target for "wouldn't this be cool" pressure from invited traders, operators, and the founder themselves. This file is the prevention. Any proposal to ship one of the above in v1 has to pop SCOPE-LOCK.md first, with a documented justification that overrides the rationale captured here, and explicit lead sign-off. Linear must mirror this file verbatim as a pinned doc so every "can we add X" ticket can be triaged against it in one click.
