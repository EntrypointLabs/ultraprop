This document specifies a crypto-native proprietary trading firm — a platform where skilled traders pay a small evaluation fee, prove themselves in a sandbox environment, and earn access to real capital they can trade across multiple crypto venues. Profits are split between the trader and the platform. Losses are absorbed by the platform's capital pool, which is funded primarily by traders who fail evaluations.

The model mirrors how traditional web2 prop firms operate (FTMO, MyForexFunds, TopstepTrader, etc.) but applied to crypto markets and improved by what the blockchain natively offers: transparent track records, on-chain reputation, instant settlement, and permissionless access from anywhere in the world.

**Why this works:** Roughly 80–90% of retail traders lose money. In a traditional prop firm structure, the evaluation fees from this majority fund the capital allocated to the minority who can actually trade. The platform makes money on three streams: evaluation fees (the largest), profit splits on funded traders, and tier upgrades. When a funded trader loses, the platform eats the loss — but that loss is structurally smaller than the aggregate evaluation revenue.

**Why crypto:** Crypto markets run 24/7, settle in minutes, and have far lower barriers to entry than traditional finance. There's a massive untapped pool of skilled crypto traders globally — particularly in regions like Africa, Southeast Asia, and Latin America — who are blocked from traditional prop firms by geography, KYC complexity, or the need for fiat banking rails. They're also already trading the assets we're offering.

## 2. Problem Statement

### 2.1 The trader's problem

Skilled crypto traders consistently face a capital ceiling. Most are trading with $500 to $5,000 of personal funds. Even a 100% annual return on $2,000 is only $2,000 — not life-changing. To scale, they need access to larger pools of capital, but their options are limited:

- Borrow money — high risk, requires creditworthiness, often unavailable in their region.
- Raise from family or friends — limited ceiling, social friction if it goes wrong.
- Join a traditional prop firm — most are forex/equities only, not crypto. The few that exist are geographically restricted, require fiat onboarding, and don't support DeFi-native trading like perps DEXes, prediction markets, or airdrop farming.
- Become a fund manager — requires legal infrastructure, accredited investors, and regulatory licensing most traders can't navigate.

### 2.2 The platform's opportunity

No crypto-native prop firm currently exists at scale. The few attempts in the space are either:

- Web2 prop firms that bolted on a single crypto pair as a marketing gimmick (no real crypto-native integration).
- DAOs or trading collectives that lack the structured evaluation model and clear payout terms traders actually want.
- Copy-trading platforms that aren't really prop firms — the trader still needs capital to participate.

This leaves a clean opening: a purpose-built crypto prop firm with proper risk controls, transparent on-chain accounting, and support for the full crypto trading stack.

---

## 3. How Traditional Prop Firms Work (Baseline)

Before describing improvements, it's important to lock down the mechanics being replicated. The web2 prop firm playbook works like this:

### 3.1 The evaluation phase

A trader pays a fee — usually $100 to $500 depending on the size of the account they're trying to qualify for. They're given a demo account loaded with simulated capital and a set of rules:

- **Profit target:** Hit a specific profit percentage within a time window (e.g., 8% in 30 days).
- **Maximum daily loss:** Don't lose more than a set percentage on any single day (e.g., 5%).
- **Maximum overall drawdown:** Don't ever go below a set percentage from peak equity (e.g., 10%).
- **Minimum trading days:** Must actively trade on a minimum number of days to prove consistency, not luck.

If they hit the profit target without breaking any rules, they pass. If they violate any rule, they fail and forfeit the fee.

### 3.2 The funded phase

Passing traders graduate to a "funded account" — real capital provided by the firm. The funded account has stricter rules than the evaluation (since real money is on the line) but offers a profit split — typically 70–90% to the trader, 10–30% to the firm. Profits are paid out on a regular schedule (usually monthly or biweekly).

If the funded trader violates a rule, the account is terminated. The trader can re-enter by paying for a new evaluation. The firm absorbs the loss on that account.

### 3.3 Tier scaling

Funded traders who perform consistently get scaled up — their account size is increased on a regular cadence. A trader who starts at $25,000 might be at $100,000 within a year, and $500,000 within two.

### 3.4 The economics

The math works because:

1. Most traders fail their evaluation. Roughly 90% never pass. Their fees become the firm's revenue.
2. The minority who pass and become funded mostly trade conservatively (the rules force this). Their wins are split with the firm.
3. Even when funded traders fail, the loss is capped by the max drawdown rule — so the firm never loses more than ~10% of the allocated capital on any given account.
4. Across thousands of evaluations and hundreds of funded accounts, the firm's loss rate is mathematically much smaller than the aggregate fee revenue.

---

## 4. Product Overview

The platform consists of two interconnected environments and a set of supporting systems:

### 4.1 The Testnet Arena (evaluation phase)

A sandbox environment running on the Sui testnet, where traders prove their skill before getting real capital. Key properties:

- **Paid entry:** Traders pay $100 (or tiered amounts based on the funded account size they're targeting) to access the arena. Payment is made on mainnet in stablecoins (USDC primarily, USDT and DAI also accepted).
- **Real testnet trading:** Traders use the same protocol integrations they'll use in the funded phase, just pointed at testnet contracts. This means their experience in the evaluation is identical to their experience funded.
- **Two challenge types:** Traders pick their preferred path when they pay:
    - **Time-based:** Hit the profit target within a fixed window (e.g., 30 days, 60 days, or 90 days). Longer windows cost less but reduce urgency.
    - **Threshold-based:** No time limit. Hit a higher profit target, with stricter consistency rules. Suited for traders who want to prove themselves at their own pace.
- **Real-time tracking:** Equity curve, daily P&L, drawdown, and rule compliance status all visible to the trader in real time.
- **Hard failure conditions:** Breaking a rule (max daily loss, max drawdown) immediately ends the challenge. No appeals.

### 4.2 The Funded Vault (live phase)

Once a trader passes evaluation, they receive a live trading account funded by the platform's capital pool. Key properties:

- **Real capital:** Allocated in stablecoins, deployed to integrated venues based on the trader's strategy choice.
- **Mainnet execution:** All trades happen on real mainnet protocols. No simulated trades, no shadow execution.
- **Profit splits:** Default 80/20 in the trader's favor, with the top tiers improving to 90/10. Payouts in stablecoins, on a biweekly cycle.
- **Strict risk rules:** Daily loss caps, max drawdown limits, position size limits, and venue concentration limits. Smart contracts enforce these — not human reviewers.
- **Account termination:** Violating any rule ends the funded account. The trader can re-enter by paying for a new evaluation. No partial penalties, no warnings.

### 4.3 Trading categories supported

Traders pick a primary category when paying for evaluation. They can later add categories at higher tiers.

| Category | What the trader does |
| --- | --- |
| **Spot** | Buy and sell tokens directly on DEXes. Lower risk, lower velocity. Suited for traders who run swing trades on majors or thematic narratives. |
| **Perpetuals** | Trade leveraged perpetual futures on decentralized perps venues. Higher reward potential, much tighter risk rules. The trader's strategy here is fully responsible for managing leverage and liquidation risk. |
| **Prediction Markets** | Take positions on event outcomes — elections, sports, crypto-native events, macro outcomes. Discrete payoffs, binary settlement. Suited for traders with strong research and information edges. |
| **Airdrop Hunting** | Use the funded capital to interact with protocols expected to do retroactive airdrops. The trader picks targets, executes the qualifying interactions, holds for the snapshot, claims the airdrop. Higher operational complexity but uncorrelated returns. The platform takes a cut of claimed airdrops, valued at the day of claim. |

---

## 5. Capital Mechanics & Economics

### 5.1 Where the capital comes from

The funded vault is sourced from three pools, in this order of priority:

1. **Evaluation fees from failed traders.** This is the primary engine. If 1,000 traders pay $100 each and 90% fail, the platform retains $90,000 from failures alone. A portion of this goes to the operating treasury; the rest goes to the funded vault.
2. **Platform retained earnings.** The 20% profit split on funded traders' winnings flows back into the vault.
3. **Strategic capital deployment.** Over time, idle stablecoins in the vault can be deployed into yield strategies (Aave, Morpho, Spark, Sky) to generate base yield. This is a secondary revenue stream and a buffer against funded trader losses.

**Important:** The vault is on-chain. Every dollar in, every dollar out, every allocation to every trader is verifiable. This is one of the platform's strongest differentiators from web2 prop firms, where capital adequacy is a black box and traders have no proof the firm can actually pay out.

### 5.2 The loss-coverage model

When a funded trader hits their max drawdown, the platform absorbs the loss. The mechanics:

- The funded account starts at the allocated size (e.g., $100,000).
- Max drawdown is set at 10% — so the worst-case loss to the platform is $10,000 per terminated account.
- On termination, the remaining balance returns to the vault.
- The platform's expected loss per allocation is statistically much smaller than the gross evaluation revenue that funded it.

**Worked example:** Out of 1,000 traders paying $100 evaluations, 100 pass (10% pass rate, conservative). Of those 100, allocate them an average of $50,000 each — $5M deployed. Assume 40% of funded traders eventually hit max drawdown ($200,000 × 0.10 = ~$200,000 in losses absorbed). 60% trade profitably or break even; on those, assume average net profit of $5,000/trader before split → $300,000 gross trader profit, of which the platform takes 20% = $60,000. Evaluation revenue alone: $1,000 × $100 = $100,000. Net result on this cohort: $100K eval fees + $60K profit splits − $200K funded losses = −$40K. The numbers only work above a certain scale and with proper risk rules; this is why ruthless rule enforcement matters.

*(The numbers above are illustrative. The actual model needs to be calibrated with conservative assumptions and re-tuned quarterly based on real cohort performance. This is one of the core ongoing operational tasks.)*

### 5.3 Revenue streams summary

| Stream | % of revenue (est.) | Mechanics |
| --- | --- | --- |
| **Evaluation fees** | 65–75% | Charged upfront for testnet challenges. Non-refundable. Scales by target account size. |
| **Profit splits** | 15–20% | 10–20% cut of funded trader winnings, taken at each biweekly payout. |
| **Tier upgrade fees** | 5–10% | Optional one-time fees to fast-track tier progression or unlock additional trading categories. |
| **Vault yield** | 3–5% | Yield earned on idle vault capital deployed to lending protocols. Pure platform revenue. |
| **Airdrop splits** | Variable | Platform takes 30–40% of airdrop value claimed by funded traders. Unpredictable but potentially large. |

---

## 6. Tier System

Tiers serve two purposes: they segment traders by capital allocation, and they reward consistency over time. The system is hybrid — entry tier is determined by what evaluation the trader pays for, but tier progression is earned through performance.

### 6.1 Entry tiers (set at evaluation purchase)

| Tier | Eval Fee | Funded Size | Profit Target | Max DD | Profit Split |
| --- | --- | --- | --- | --- | --- |
| **Starter** | $100 | $10,000 | 8% | 10% | 75 / 25 |
| **Basic** | $250 | $25,000 | 8% | 10% | 80 / 20 |
| **Pro** | $500 | $50,000 | 8% | 10% | 80 / 20 |
| **Elite** | $1,000 | $100,000 | 10% | 8% | 85 / 15 |
| **Whale** | $2,500 | $250,000 | 10% | 8% | 90 / 10 |

### 6.2 Performance-based progression

Once funded, traders climb the ladder through two parallel mechanisms:

- **Capital scaling:** Every consecutive month a funded trader hits at least 5% net profit without rule violations, their account size increases by 25%. After three consecutive profitable months, by 50%.
- **Profit split improvement:** After six months of consistent profitability, the profit split improves by 5 percentage points (e.g., 80/20 becomes 85/15). Capped at 90/10.
- **Multi-category unlocks:** Traders start with one category. Hitting a tier milestone unlocks the ability to add a second and eventually third category to the same funded account.

### 6.3 Tier downgrade and reset

If a funded trader's account is terminated (max drawdown hit), they lose their tier progress. To re-enter, they pay for a new evaluation. They can choose to re-enter at the same tier, downgrade to a cheaper tier, or upgrade if they have the conviction. There's no penalty beyond the lost progress and the new evaluation fee.

---

## 7. Crypto-Native Improvements Over Traditional Prop Firms

Mirroring the traditional model is the foundation. The improvements below are what make this product distinctly better than a web2 prop firm — and they're not bolted on, they're structural.

### 7.1 On-chain transparency

Every funded account is a smart contract address. Every trade, every P&L move, every payout is recorded on-chain. Traders can prove their track record to anyone — recruiters, fund LPs, other DAOs — without trusting the platform to vouch for them.

Traditional prop firms have a credibility problem: traders pass evaluations, then claim to be funded, but have no verifiable proof. On this platform, the proof is the chain. Anyone can check.

### 7.2 On-chain reputation as a primitive

Each trader gets a soulbound credential (SBT) that accumulates achievements: "Passed Pro Evaluation," "Sustained 6 months profitable," "1,000 trades executed without rule violation," etc. This credential is portable — other crypto protocols can read it and grant the trader access, lower fees, or higher limits based on their proven track record.

This turns the platform into an identity layer for skilled traders, not just a capital provider.

### 7.3 Instant settlement and global access

Web2 prop firms struggle with payouts. Wire transfers take days, sometimes weeks. International traders face FX losses, bank rejections, and compliance friction. On this platform, payouts are stablecoin transfers — minutes, not days, and the trader can receive them anywhere in the world without a bank.

### 7.4 Permissionless entry, no KYC theatre

Traders connect a wallet, pay an evaluation fee, and start trading. No multi-day onboarding, no document uploads, no geographic restrictions imposed by regulatory paranoia. The platform may add lightweight KYC for high-tier accounts or jurisdictions that require it, but it's not the default friction.

### 7.5 Composability

Because the platform is on-chain, other protocols can build on top of it. Examples:

- A lending protocol could offer credit lines collateralized by a trader's verified track record.
- A copy-trading platform could automatically mirror the top funded traders.
- A DAO could allocate treasury funds to top-tier funded traders as a yield strategy.

None of this is possible in a web2 prop firm. This is the long-term moat.

### 7.6 Programmatic rule enforcement

In a web2 prop firm, rules are enforced by software but adjudicated by humans — and disputes happen. On this platform, rules are enforced by smart contracts. The max drawdown is a hard constraint at the contract level. There are no disputes about whether a rule was violated; the chain settled it. This reduces operational overhead and removes the trust problem.

### 7.7 Native support for crypto-only strategies

Traditional prop firms can't support airdrop hunting, prediction markets, or LP positions because they have no infrastructure for them. This platform is built around these strategies as first-class trading categories, not afterthoughts.

---

## 8. Integrations

The platform itself doesn't run an exchange. Traders execute through integrated third-party venues. For v1, integrations are scoped generically — the actual selection of specific protocols happens as part of partnership negotiation.

### 8.1 Categories of integration

| Category | What we need from the partner | Example partners |
| --- | --- | --- |
| **Spot DEXes** | Programmable swap routing, deep liquidity, sub-account or vault support so the platform's smart contract can execute on the trader's behalf within risk limits. | Cetus, Aftermath, Turbos, Kriya, 7K Protocol |
| **Perpetuals** | Sub-account or isolated margin support, programmatic position management, real-time P&L feeds, programmatic liquidation alerts. | Bluefin, Suilend Perps |
| **Prediction Markets** | Market discovery API, position tracking, settlement notification. | Polymarket (if portable), native Sui prediction markets as they launch |
| **Lending (for vault yield)** | Permissionless deposit / withdraw, audited contracts, clear yield tracking. | Suilend, Scallop, NAVI |
| **Stablecoin rails** | Reliable bridging, on/off-ramp for evaluation fees and payouts. | Wormhole, Circle CCTP, deBridge, Mayan |
| **Identity / SBT** | Issue and read trader reputation credentials. | Sui's native object model |

### 8.2 Integration model

For each integration, the platform needs three things:

1. **Programmatic execution.** The platform's contract must be able to execute trades on the trader's behalf, scoped to the funded account's risk limits. No partner integration goes live without this.
2. **Real-time data feed.** The platform's risk engine needs sub-second updates on the funded account's P&L, open positions, and margin status to enforce drawdown rules in real time.
3. **Atomic risk enforcement.** If a trade would push the account past a risk limit, it must fail at the contract level — not after the fact. This requires pre-trade simulation hooks or programmatic position limits enforced by the venue.

### 8.3 Integration prioritization for v1

v1 launches with the minimum viable integration set:

- One major spot DEX on Sui (Cetus via the 7K Protocol aggregator).
- One major perps venue on Sui (Bluefin).
- One major lending protocol on Sui for vault yield.
- Wormhole or CCTP for stablecoin movement.

Prediction markets and airdrop hunting categories launch in v2.

---

## 9. Trader Experience

### 9.1 Onboarding flow

1. Land on marketing site. See clear breakdown of tiers, evaluation rules, profit splits. Track record statistics shown live on-chain.
2. Connect wallet (Sui Wallet, Suiet, or compatible Sui wallet).
3. Pick tier and challenge type. See full ruleset, projected timeline, fee breakdown.
4. Pay evaluation fee in USDC (or supported stablecoin).
5. Receive evaluation account credentials. Land in the Trading Dashboard.

### 9.2 The Trading Dashboard (during evaluation)

Single-page view, organized in three zones:

- **Account header:** Current equity, starting equity, P&L (absolute and percent), days remaining (for time-based challenges), profit target progress bar, drawdown gauge.
- **Rule compliance panel:** Live status of every rule (daily loss, max DD, min trading days, etc.) with green / amber / red indicators. Crossing into amber triggers a warning notification.
- **Execution panel:** Order entry interface for the trader's chosen category. Embedded views of integrated venue UIs where possible.
- **Trade log:** Every trade ever taken on this account, with timestamps, sizes, P&L, on-chain transaction links.
- **Live equity curve:** Chart of account equity over time, with rule thresholds drawn as lines.

### 9.3 Pass / fail moments

When a trader hits the profit target, they get an immediate notification: their evaluation is complete, and they can claim their funded account. A one-click flow promotes them to the funded vault.

When a trader violates a rule, the evaluation immediately ends. They get a clear breakdown of which rule was violated, what the trigger trade was, and where to go next (retry, downgrade tier, refund options if applicable).

### 9.4 Funded dashboard

Same shape as the evaluation dashboard, with these additions:

- **Payout calendar:** Next payout date, projected payout amount based on current P&L, full payout history.
- **Tier progress:** Visible ladder showing current tier, next milestone, progress toward scaling up.
- **Reputation panel:** Soulbound credential view — every achievement earned, with a public profile link the trader can share.
- **Category management:** Tabs for each trading category the trader has unlocked.

### 9.5 Trader profile (public)

Every trader has a public profile page (e.g., propfirm.xyz/trader/[wallet]). Shows verified track record, current tier, total earnings, win rate, sharpe-like consistency metric, achievement credentials. This is the trader's portable trading résumé.

---

## 10. Admin Dashboard

The admin dashboard is the operator's command center. It must surface every signal needed to manage risk, capital, and trader operations in real time. Built for a small operations team (initially 1–3 people, scaling to a few more as volume grows).

### 10.1 Top-level metrics view

The first screen every operator sees on login. Designed to answer one question in three seconds: is the platform healthy right now?

- **Vault status:** Total capital in vault, capital deployed to funded accounts, idle capital, yield earned this month.
- **Active evaluations:** Number of paying traders currently in the testnet arena, broken down by tier and challenge type.
- **Active funded accounts:** Total count, total capital deployed, aggregate P&L today / this week / this month.
- **Risk heatmap:** Funded accounts ranked by proximity to their max drawdown. Anything in the red zone (within 3% of max DD) is flagged at the top.
- **Revenue today:** Evaluation fees collected, profit splits realized, vault yield generated.
- **Alerts feed:** System-generated alerts — accounts approaching DD limits, partner integration issues, large pending payouts, anomalous trade patterns.

### 10.2 Trader management view

Sortable, filterable table of every trader on the platform. For each trader:

- Wallet address, account size, tier, days funded, P&L (total and current period), current drawdown, win rate, category, last trade timestamp.
- Click into trader detail page: full trade history, account contract address, equity curve, payout history, support ticket history.
- Manual actions: pause account (in extreme cases), trigger early payout (for partner ops), issue support credit, suspend for ToS violation.

### 10.3 Capital allocation view

Where the operator manages the vault itself:

- **Capital flow log:** Every dollar in / dollar out, by source (evaluation fees, profit splits, vault yield) and destination (allocations to traders, payouts, treasury sweeps).
- **Yield deployment:** Current distribution of idle vault funds across lending protocols. Tools to rebalance based on yield comparison.
- **Capacity planning:** Model showing how much new funded capital can be allocated based on current vault size, expected loss rate, and reserve requirements. Prevents over-allocation.
- **Stress test simulator:** Model what happens if X% of funded accounts hit max DD simultaneously. Use this to set reserve ratios.

### 10.4 Risk monitoring view

Real-time risk surface across the platform:

- **Per-trader risk:** Distance to max DD, position concentration, leverage, recent loss velocity.
- **Per-venue risk:** Total platform exposure on each integrated venue. Useful if a partner protocol has an exploit or downtime.
- **Correlation risk:** If multiple funded traders are taking the same position (e.g., all long SOL with 10x leverage), aggregate exposure is flagged.
- **Black swan modeling:** Pre-built scenarios — BTC drops 30%, a stablecoin depegs, a partner protocol gets exploited. Estimated platform impact for each.

### 10.5 Revenue and finance view

Operator's view of platform economics:

- Daily / weekly / monthly revenue by stream.
- Evaluation pass rate trend (this is the single most important business metric — if pass rate drifts up, evaluation rules need tightening; if it drifts down, marketing needs adjusting).
- Cohort analysis — track every monthly cohort of evaluations from purchase through pass / fail / funded / terminated.
- Treasury operations log — sweeps from vault to operating treasury, expense tracking, token reserves.

### 10.6 Operations and support view

- **Support ticket queue:** Trader-submitted issues, prioritized by tier and severity. Integration with Discord and email.
- **Audit log:** Every admin action ever taken, who took it, when, and why. Immutable.
- **Partner status:** Health checks on every integrated venue — uptime, RPC latency, API errors.

### 10.7 Trader-facing controls

Things the operator can change for individual traders without touching code:

- Adjust tier (e.g., upgrade after manual review of an appeal).
- Issue evaluation credits (for promotions or compensation).
- Toggle category access.
- Update payout wallet (after multi-step verification).
- Account freeze / unfreeze.

---

## 11. Technical Architecture (High-Level)

Implementation specifics for Sui (Move) are deferred to a separate technical spec. At the PRD level, the architecture has five layers:

### 11.1 Smart contract layer

- **Vault contract:** Holds platform capital, allocates funds to funded accounts, enforces accounting.
- **Evaluation contract:** Handles evaluation purchases, tracks testnet challenge state, mints pass certificates.
- **Funded account contracts:** Each funded account is its own contract (or object, on Sui). Holds capital, enforces risk rules at the contract level, executes trades through integrated venues.
- **Reputation contract:** Issues soulbound credentials, manages trader profile state.
- **Payout contract:** Manages biweekly payout cycles, profit split calculation, treasury sweeps.

### 11.2 Off-chain risk engine

A dedicated service that monitors every funded account in real time, pre-validates trades against risk rules, and triggers contract-level enforcement actions if a rule is violated. Written in Rust for performance. Subscribes to chain events via WebSocket RPC.

### 11.3 Indexer / data layer

Indexes all platform on-chain activity into a queryable database (PostgreSQL primary, with TimescaleDB for time-series P&L data). Powers both the trader dashboard and the admin views.

### 11.4 Frontend layer

- **Trader app:** Next.js / React. Sui wallet adapter via @mysten/dapp-kit. Real-time updates via WebSocket subscriptions to the indexer.
- **Admin app:** Separate Next.js / React app, gated behind operator authentication. Heavier on data tables, charts, modeling tools.

### 11.5 Integration layer

SDK wrappers around each integrated venue. The platform's contracts call these wrappers. Each wrapper standardizes the integration contract: open position, close position, fetch position state, fetch P&L.

---

## 12. Cost Efficiency

The platform's profitability depends on keeping operating costs low relative to revenue. The biggest cost categories and how to manage them:

### 12.1 Chain selection

Sui was chosen specifically because transaction costs are negligible — sub-cent per transaction. This matters because:

- Funded accounts may execute hundreds of trades per month. On Ethereum mainnet, this would be cost-prohibitive.
- Risk enforcement may require frequent contract-level state updates. Cheap fees mean we can enforce rules in real time without amortizing checks.
- Payouts to thousands of traders, biweekly, must be near-zero cost.

### 12.2 Smart contract design

- Use Sui's native object model, which naturally supports per-account isolation — exactly what funded accounts need.
- Avoid unnecessary on-chain computation. Trade execution must be on-chain (for transparency), but analytics and reporting are off-chain (the indexer).
- Batch operations where possible — e.g., process all biweekly payouts in a single transaction, not one per trader.

### 12.3 Infrastructure

- **RPC:** Use a paid Sui RPC provider (Shinami primary, Triton/QuickNode failover) for production reliability. Estimated cost: $500–$2,000/month for a platform with 1,000 active accounts.
- **Indexer:** Self-hosted on a single beefy VM initially. Migrate to a managed service (e.g., Triton or QuickNode indexing) only if the volume justifies it.
- **Frontend hosting:** Vercel for trader app and admin app. Edge functions for low-latency data fetching.
- **Backend:** A single Rust service for the risk engine, deployed on a managed container platform (Fly.io, Railway). Horizontal scaling only when needed.
- **Database:** Managed PostgreSQL (Neon or Supabase) for v1, dedicated cluster when row counts cross 10M.

### 12.4 Team scaling plan

v1 should ship with a team of three to four people:

- One smart contract engineer (Sui Move).
- One full-stack / frontend engineer (you).
- One operations / risk lead (initially can be founder).
- One growth / marketing lead (post-launch).

This is enough to ship v1 and operate to roughly 1,000 active accounts. Beyond that, scale operations and engineering on a per-need basis.

### 12.5 Capital efficiency

The largest cost on the balance sheet is the capital reserve required to cover funded trader losses. Strategies to keep this efficient:

- Deploy idle vault capital to audited lending protocols. Treasury yield offsets a portion of the funded loss rate.
- Cap aggregate allocated capital at a multiple of vault size (initially 1.5x — for every $1 in vault, allocate $1.50 across funded accounts). Adjust this ratio as historical loss data accumulates.
- Reserve a fixed percentage (15–20%) of vault as a never-touch buffer for tail events.

---

## 13. Phased Roadmap

### 13.1 Phase 0 — Foundations (4 to 6 weeks)

- Smart contract scaffolding on Sui.
- Off-chain risk engine prototype.
- Trader auth and basic dashboard shell.
- Admin dashboard shell.
- Internal testing on testnet with sample integrations.

### 13.2 Phase 1 — Closed Beta (4 weeks)

- Launch evaluation flow on testnet with one trading category (spot) and one tier (Starter).
- Invite 50 to 100 traders from your existing networks (Octant, Bungee, study groups, existing crypto trading communities).
- No real capital deployed yet — funded accounts are also testnet during beta. Beta participants receive a discount on their first real evaluation.
- Iterate on the evaluation rules, dashboard UX, risk engine.

### 13.3 Phase 2 — Public Launch v1 (6 to 8 weeks)

- Open evaluations to public on mainnet.
- Real capital deployment for traders who pass.
- Spot and perps categories. Three tiers (Starter, Basic, Pro).
- Marketing push targeting crypto trading communities.

### 13.4 Phase 3 — Expansion (3 to 6 months post-v1)

- Add prediction markets and airdrop hunting categories.
- Add Elite and Whale tiers.
- Launch reputation credential system.
- Open partner program (other protocols building on top of trader reputation).

### 13.5 Phase 4 — Ecosystem (6 to 12 months post-v1)

- DAO governance for evaluation rules, tier parameters, vault deployment.
- Public LP vault — outside investors can supply capital to the funded vault and earn a share of platform revenue.
- Protocol expansion (Hyperliquid L1, Monad, Berachain, etc., based on liquidity and product readiness).
- Trader-as-fund model — top funded traders can take outside allocations from copy-traders.

---

## 14. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| **Evaluation pass rate too high** | If too many traders pass and we run out of vault capital, allocation must pause. Mitigation: model pass rate weekly, tighten rules if drift detected, cap concurrent funded accounts. |
| **Partner protocol exploit** | If an integrated venue gets exploited and platform funds are exposed, we lose. Mitigation: cap per-venue exposure, prefer venues with strong audit + bug bounty history, hold vault yield deployments only in tier-one protocols. |
| **Stablecoin depeg** | Most vault capital is in USDC. A USDC depeg would cripple the platform. Mitigation: diversify vault to USDC + USDT + DAI; monitor depeg risk in real time; have automatic conversion rules. |
| **Trader collusion / fraud** | Sybil traders pay multiple evaluations, coordinate to game the system. Mitigation: on-chain analysis to detect linked wallets, behavioral analysis on trade patterns, manual review of high-tier accounts. |
| **Regulatory risk** | Some jurisdictions may classify funded accounts as managed investment products. Mitigation: structure platform as a tool, not a manager; legal review pre-launch; geo-block where required; consider entity structure that limits exposure. |
| **Reputation system gaming** | Bad actors farm reputation credentials by passing evaluations and not actually trading the funded phase. Mitigation: tie reputation credential weight to time funded, not just to passing. Decay credentials slowly if inactive. |
| **Adverse market conditions** | In a sustained bear market, evaluation purchases drop sharply, while funded traders may underperform. Mitigation: build cash runway to survive 12 months of low volume; add bear-friendly trading categories (e.g., prediction markets, delta-neutral strategies). |

---

## 15. Open Questions

These are decisions that need resolution before v1 ships but aren't blocking the PRD:

1. **Refund policy on system errors.** If a partner venue has downtime and that downtime causes a trader to violate a rule, do we refund? Lean: yes, but case-by-case, with a documented criteria.
2. **Multi-account policy.** Can a single trader hold multiple funded accounts at different tiers? Probably yes (it's how web2 prop firms operate), but needs concrete rules.
3. **Currency of evaluation fees.** Default to USDC. Should we accept SUI at a small discount to encourage on-chain alignment?
4. **Affiliate / referral program.** Traditional prop firms get a huge chunk of growth from affiliate trading influencers. Need to design a referral structure that's profitable and doesn't cannibalize evaluation revenue.
5. **Token.** Should the platform have a token? Strong arguments both ways. A token enables LP vault, governance, and incentives — but adds regulatory complexity and dilutes founder economics. Default position: launch without one, add one in Phase 4 if the model justifies it.
6. **Insurance.** Do we offer an insurance fund for funded traders if the platform itself fails? Probably yes at higher tiers, funded by a small premium on evaluation fees.

---

## 16. Appendix — Comparison vs Traditional Prop Firms

| Dimension | Traditional (FTMO etc.) | This Platform |
| --- | --- | --- |
| **Onboarding time** | 1–7 days (KYC, document review, account setup). | Under 5 minutes (connect wallet, pay). |
| **Markets supported** | Forex, indices, some commodities. Crypto rarely or as a single pair. | Spot, perps, prediction markets, airdrops — all crypto-native. |
| **Payout speed** | 3–14 days via wire transfer or third-party processor. | Minutes, in stablecoins, to any wallet. |
| **Track record portability** | Lives in firm's database. Can't be verified externally. | On-chain. Verifiable by anyone, portable to other protocols. |
| **Geographic restrictions** | Heavy. Many countries blocked, KYC blocks more. | None at protocol level. Light geo-restrictions only if legally required. |
| **Capital adequacy proof** | Trust the firm's marketing. Several major prop firms have collapsed. | Vault is on-chain. Anyone can verify reserves at any time. |
| **Rule enforcement** | Software-detected, human-adjudicated. Disputes common. | Contract-enforced. No disputes possible. |
| **Composability** | None. Closed system. | Open. Other protocols can build on the platform's reputation primitive, funded vault, and trader profile. |
