# Feature Landscape — Crypto-Native Prop Trading Firm v1

**Domain:** Crypto-native prop trading firm — closed beta paper-trading evaluation engagement loop
**Researched:** 2026-05-14
**Time horizon:** v1 closed beta (14–18 weeks). V2 (mainnet capital) explicitly out of scope.

---

## Research Note on Verification

Both `WebFetch` and `WebSearch` tools were denied at runtime in this sandbox. As a result, every external-platform feature claim below is drawn from training data (knowledge cutoff January 2026) for products that are widely and publicly documented (FTMO, Topstep, TopstepX, Hyperliquid, GMX, dYdX, Aevo, Galxe, Layer3, Guild.xyz). Confidence is assigned accordingly:

- **HIGH** — well-attested across multiple public sources at cutoff, mechanic is structurally stable.
- **MEDIUM** — well-known but specific numeric thresholds may have changed since cutoff; pattern is stable.
- **LOW** — single-source recall or rapidly evolving surface; verify before relying.

A pre-launch pass with live web access against the actual product pages is recommended before locking the v1 spec. Sections that most need such verification are flagged inline with `[verify].`

---

## Part 1 — Adjacent Categories Surveyed

### Category 1: Traditional Web2 Prop Firms (FTMO, Topstep, MFF, The5%ers, FundedNext, Apex)

What these products actually show a trader, abstracted from training-data recall (**MEDIUM** confidence on specifics; **HIGH** on the patterns):

**FTMO** — two-step Challenge → Verification → Funded flow.
- Dashboard widgets: account balance, equity curve, current daily-loss budget remaining, max-loss budget remaining, profit target progress bar, days-traded counter (minimum trading-days rule), open positions table, trade history.
- Rules surfaced as live widgets, not just text: a "daily loss" pill that turns amber/red as the trader approaches it; a "max loss" pill that is the hard kill.
- Typical numerics (Standard Challenge): 10% profit target on Challenge, 5% on Verification, 5% daily loss, 10% max loss, minimum 4 trading days (the 10-trading-day minimum was removed in 2023). `[verify].`
- Payout calendar: bi-weekly default after funding, configurable cadence on demand; "first payout in 14 days" badge.
- "MetaTrader Account MetriX" — a separate analytics page with metrics like average win, average loss, Sharpe-ish stats, risk-of-ruin, trading-time heatmap.
- News-event lockout: not on Standard accounts; required only on Swing variant. (Often cargo-culted into other firms.)
- Affiliate program: percentage-based, multi-tier, dedicated affiliate dashboard.
- Discord community + ticket-based support. No on-platform chat.

**Topstep** — futures prop firm, "Trading Combine."
- Dashboard widgets: P&L, current daily-loss limit, trailing max drawdown line (Topstep is famous for a *trailing* MLL that ratchets up with new equity highs), profit target progress, contract scaling restrictions surfaced as live constraints, days-traded counter.
- Consistency rule: largest winning day cannot exceed 50% of total P&L when the trader requests payout. Shown as a meter.
- Scaling plan: contract size unlocks as account grows.
- Payout: weekly cadence, first payout after 5 winning days minimum, "Express Funded" variants.
- Discord, Trade Reviews, daily live "TopstepTV" stream — community/content as retention.

**MyForexFunds (now defunct), FundedNext, The5%ers, Apex Trader Funding** — pattern matches FTMO + Topstep with variations:
- "One-step" challenge variants (no Verification phase) — popularized by FundedNext.
- "Instant funding" tiers (skip the eval entirely for a higher upfront fee).
- "Refundable fee" gimmick — the eval fee returned with the first payout.
- "Profit split" displayed as a headline number (80% / 90% / "up to 100%").
- "Scaling plan" — pass milestones inside the funded account to unlock larger allocations.
- "News trading allowed / not allowed" — major segmentation feature.
- "Weekend holding" rules.

**Funnel pattern that is consistent across all of them:**
1. Landing page with "What's the catch?" FAQ, social proof (payout proof images), profit-split headline.
2. Tier picker — account-size buttons ($10K / $25K / $50K / $100K / $200K).
3. Checkout with discount code field always visible (perpetual 10–20% off via affiliates).
4. Email + dashboard credentials issued. Trader downloads MT4/MT5/cTrader/NinjaTrader/TopstepX.
5. Dashboard becomes the home base. The trader returns daily to check rule-budget widgets.
6. Pass → automatic upgrade to next phase or funded account. Visible state change.
7. Payout request flow — KYC, payment method (often crypto for offshore firms), processing-time SLA.

**Patterns to steal for v1:**
- Rule budgets as live pills, not buried text. The pill is the dashboard's heartbeat.
- Tier picker as the primary signup CTA, not a generic "sign up" button.
- Pass = a visible, celebratory state transition. (Many web2 firms send a physical certificate + LinkedIn-ready badge.)
- Payout-proof social walls — for v1, replace with leaderboard + SBT showcase.

**Patterns to deliberately drop for v1:**
- News-event lockouts (forex-specific cargo cult; crypto has no daily 8:30am NFP).
- "Refundable fee" gimmicks (no fees in v1).
- Affiliate dashboards (invite-only beta).
- Account-size dropdowns above $50K (Pro tier is the cap in v1 by design).

---

### Category 2: Crypto-Native Trading Game-ifications (Hyperliquid, GMX, dYdX, Aevo, Polymarket, testnet rallies)

What actually retains crypto users (**MEDIUM** confidence, training-data; engagement mechanics are highly publicly documented):

**Hyperliquid** — leaderboard + HLP vault + points + airdrop.
- Public leaderboard with selectable time windows (day / week / month / all-time) and metric toggles (PnL / ROI / volume).
- Per-wallet public profile page: open positions, all-time PnL, win rate, deposit history. Anyone can paste a wallet and see it.
- "Points" program (now redeemed via $HYPE airdrop in 2024) — accrued per-trade, weighted by activity and volume. Driver of insane retention through 2024.
- HLP (Hyperliquid Liquidity Provider) vault — separate retention layer for non-traders.
- Vaults (copy-trading) — trader can publish a vault others deposit into, vault owner gets a fee.

**GMX** — referrals, esGMX vesting, "Stats" page that effectively functions as a leaderboard for top traders.

**dYdX** — historical trading rewards mechanism that distributed DYDX tokens to traders based on volume, fees paid, and open interest. Set the template that every perps DEX since has copied.

**Aevo** — Sonar competitions, Farms (points), leaderboards segmented by competition.

**Polymarket** — leaderboard with timeframes; profile pages public by wallet; "biggest winners this week" feed on the landing page is a recurring retention pull.

**Testnet rallies (Movement, Sei Atlantic-2, etc.)** — gamified testnet trading with explicit "points convert to mainnet rewards" mechanics. Drove massive participation while explicitly disclaiming any token guarantee.

**Patterns that demonstrably retain crypto users:**

| Pattern | Why it works | v1 applicability |
|---------|--------------|------------------|
| **Seasons with hard reset + cumulative all-time** | Returning users see both "I'm #14 this season" and "I'm #128 all-time" — two retention hooks per visit | High — map "season" to "cohort window" |
| **Public profile by wallet address** | Crypto users love showing off their wallet's history; shareable to X/Farcaster | High — central to soft-airdrop signal |
| **Multi-axis leaderboard (PnL / ROI / consistency)** | Different traders flex on different dimensions; one leaderboard excludes too many | High |
| **Points without explicit dollar value** | Plausible-deniability airdrop carrot; users self-impose belief | High — this is the explicit v1 strategy |
| **Time-weighted recency boost** | Forces traders to come back; punishes idlers | Medium — risk of farming behavior; defer |
| **Per-trade emission visualization ("+12 points")** | Variable-ratio reinforcement loop, dopamine | Medium — easy to add post-launch |
| **Wallet-gated invite competition** | Status-by-association; insiders feel special | High — invite-only beta does this naturally |
| **Public "biggest trade of the day" feed** | Vicarious thrill, draws lurkers | Low — defer; needs more trader volume first |

---

### Category 3: On-Chain Reputation / SBT-Based Games (Galxe, Layer3, Guild.xyz, Optimism RetroPGF, Worldcoin, Snapshot)

What's been validated about SBT design (**MEDIUM** confidence):

**Galxe** — campaign-based credential platform.
- One credential per task ("held >X tokens," "swapped on DEX Y," "voted in DAO Z").
- Credentials compose into "OATs" (proof of attendance / activity tokens — actual NFTs or SBTs).
- Public profile page aggregates all credentials.
- "Loyalty Points" that level up the profile.
- Campaigns are time-bound; many are explicitly framed as airdrop-eligibility on third-party protocols.

**Layer3** — quest-driven XP with persistent profile.
- Daily quests, weekly quests, season-long quests.
- XP and level on profile.
- "CUBE" NFTs minted per quest completion.
- "Streak" mechanic (consecutive-day engagement).
- Profile public, shareable, indexed in directory.

**Guild.xyz** — token-gated community memberships.
- Roles unlocked by on-chain conditions (held a token, owned an NFT, completed a Galxe campaign, etc.).
- The "credential is a key to a Discord role / private community" pattern.

**Optimism RetroPGF + Citizens' House** — identity tied to attestations (EAS), used to gate governance influence.

**Snapshot** — voting power tied to wallet holdings + delegations; not strictly SBT but cousin pattern.

**Worldcoin / World ID** — proof-of-personhood SBT-like; orthogonal to v1 but informs the post-v1 Sybil-resistance roadmap.

**SBT design principles drawn from these:**

1. **Mutable > immutable for active credentials.** Galxe and Layer3 both treat the profile as mutable; the immutable artifacts are individual claims/quests. v1's choice of a *mutable* cohort SBT (PROJECT.md) aligns with this.
2. **The credential's value = what it proves.** Galxe credentials with hard on-chain proofs (e.g., "swapped >$10K") are worth more than "joined Discord" credentials. v1's SBT proves something genuinely hard (passed a tier evaluation against live mainnet prices) — this is the right shape.
3. **A public profile page is the credential's distribution surface.** Without a shareable URL, the SBT doesn't compound socially.
4. **Level / tier is the legible compression** of a multidimensional reputation. Numbers like "highest_tier = Pro" are more shareable than "passed evaluation #142."
5. **Composability matters but waits.** Galxe credentials being readable from other apps is what made them valuable; v1 doesn't need to integrate anywhere else yet, but the SBT schema must not preclude this in v2.
6. **Anti-Sybil is a post-traction problem.** Layer3 and Galxe both ran for years before adding meaningful Sybil resistance. v1's invite-only model is sufficient until open access.

---

## Part 2 — v1 Feature Catalog with Verdicts

Legend: **Category** — A=table-stakes, B=differentiator, C=anti-feature. **Complexity** — S/M/L for a 3-engineer team. **Owner** — trader / operator / both / public. **Verdict** — must / should / could / won't.

### Group A: Table Stakes (must have or users leave)

| # | Feature | Description | Cat | Complexity | Dependencies | Owner | v1 Verdict |
|---|---------|-------------|-----|------------|--------------|-------|------------|
| A1 | Wallet connect (Sui) | One-click wallet sign-in via @mysten/dapp-kit, with allowlist gating | A | S | Allowlist contract/table | trader | **must** |
| A2 | Tier picker | Pre-evaluation screen lets the trader start the Starter tier (Basic/Pro locked until prior pass) | A | S | SBT read, contract entrypoint | trader | **must** |
| A3 | Live equity curve | Sub-second WebSocket-fed equity line; the heart of the dashboard | A | M | Indexer, oracle stream, fill model | trader | **must** |
| A4 | Rule-budget pills | Live "daily loss budget remaining" + "max drawdown budget remaining" + "profit target progress" pills, color-coded | A | S | Indexer derives from chain events | trader | **must** |
| A5 | Trade intent form | Order entry: pair, direction, size; quote of expected fill price & slippage shown before submit | A | M | Slippage model exposed via RPC | trader | **must** |
| A6 | Open positions table | Live unrealized PnL per position; close button | A | S | Indexer | trader | **must** |
| A7 | Trade history | Sortable, filterable trade log; CSV export | A | S | Indexer | trader | **must** |
| A8 | Pass / fail signaling | Unambiguous, celebratory pass state and unambiguous, dignified fail state. Both immutable on-chain. | A | S | Contract events | trader | **must** |
| A9 | Tier-locked state UI | Clear indication of which tiers are unlocked, current evaluation status, time-in-tier counter | A | S | SBT read | trader | **must** |
| A10 | Price feed transparency | Tooltip on every quoted price showing oracle source + confidence + last-update timestamp | A | S | Oracle adapter | trader | **must** |
| A11 | Slippage transparency | Pre-trade quote breakdown: "oracle mid = X, modeled slippage = Y bps, your fill = Z." Trader sees exactly why their fill differed. | A | M | Slippage model | trader | **must** |
| A12 | Mobile-responsive layout | Dashboard must be usable on a phone; crypto traders check positions from anywhere | A | M | UI framework choice | trader | **must** |
| A13 | Connection / sync status indicator | "Live" / "reconnecting" / "stale" indicator in the header; trust is fragile when this is hidden | A | S | WebSocket health | trader | **must** |
| A14 | Per-trader on-chain state inspector | "View this trader on Suiscan" link — every assertion in the UI must be verifiable | A | S | Block explorer URL templates | trader | **must** |
| A15 | Tier rules cheat sheet | Always-visible accordion: profit target, max DD, daily loss, min trading days. Mirrors FTMO/Topstep pattern. | A | S | Static content | trader | **must** |
| A16 | FAQ / help docs | "What is paper trading?", "How do fills work?", "What does a tier pass unlock?", "Is there a token?" (must answer this honestly, see B-features) | A | S | None | trader | **must** |
| A17 | Allowlist invite flow | Email-or-Discord-DM invite → wallet allowlist registration → first sign-in | A | S | Allowlist mechanism | trader+operator | **must** |
| A18 | Browser-side error guards | Friendly error states for stale prices, oracle outage, indexer lag, RPC dropout | A | M | All upstream services | trader | **must** |
| A19 | Discord channel | Closed-beta Discord with #announcements, #support, #leaderboard-chat. Standard for crypto products. | A | S | None | trader+operator | **must** |
| A20 | Operator admin: allowlist mgmt | Add/remove wallets from allowlist; view aggregate beta health metrics | A | M | Indexer, allowlist contract | operator | **must** |
| A21 | Operator admin: pause switch | Operator can pause new evaluations or trades; cannot reverse outcomes (per PROJECT.md success criterion) | A | S | Contract pause role | operator | **must** |

### Group B: Differentiators (the crypto-native angle; soft-airdrop retention)

| # | Feature | Description | Cat | Complexity | Dependencies | Owner | v1 Verdict |
|---|---------|-------------|-----|------------|--------------|-------|------------|
| B1 | Public leaderboard (multi-axis) | Sortable by: highest_tier reached, total_shadow_pnl, total_passes, consistency score, trades count. Time windows: this cohort / all-time. | B | M | Indexer aggregations | public | **must** |
| B2 | Per-wallet public profile page | `/profile/<wallet>` — SBT level, tier badges, evaluation history, equity curves of past evals, all-time stats. Shareable URL. | B | M | Indexer, SBT read | public | **must** |
| B3 | Mutable v1 cohort SBT | One per wallet. Fields per PROJECT.md: highest_tier, total_passes, total_shadow_pnl, total_trades, last_active_at. Non-transferable. | B | M | Contract | trader+public | **must** |
| B4 | Tier-pass mint ceremony | When a trader passes a tier, the SBT mint/level emits a beautiful, shareable moment: animated pass screen, one-click share to X/Farcaster with embedded card image | B | S | SBT events, share-card generator | trader | **must** |
| B6 | Verifiable evaluation history | Every past evaluation has a permalink with all trades, all rule-budget snapshots, all events. Anyone can audit. | B | M | Indexer + permalink routing | public | **must** |
| B7 | "Beta cohort #1" framing | The cohort itself is a credential — UI consistently brands as "v1 closed beta cohort," membership in the cohort is part of the identity | B | S | Branding, copy | trader+public | **must** |
| B8 | Soft-airdrop-signal page | A "Why we don't talk about tokens" page that *explicitly* refuses to promise an airdrop but enumerates what the SBT credibly proves and the design principles that govern future credentialing. This is the load-bearing legal and trust artifact. | B | S | Legal/comms review | public | **must** |
| B9 | Leaderboard "consistency" score | Composite metric: not just PnL but PnL-per-trade variance, max-drawdown-actual vs max-drawdown-allowed, days active. Distinguishes skill from luck. | B | M | Indexer compute job | public | **should** |
| B10 | Hall of Fame / Cohort milestones | Static page: "first trader to pass Pro," "first to pass all three on both chains," "longest active streak in cohort." Cheap but enormously sticky. | B | S | Indexer | public | **should** |
| B11 | Backtest replay viewer | Click any past evaluation → scrubbable timeline of trades + equity curve + rule-budget evolution. "Watch the trade." | B | L | Indexer time-series | trader+public | **could** |
| B12 | SBT level-up animation | Each pass visibly evolves the SBT artwork (color/badge/border level changes by tier). Strong "show off" mechanic. | B | M | Designer; on-chain or off-chain art? | trader+public | **should** |
| B14 | Public cohort-health dashboard | Site-wide stats page: how many traders in cohort, how many passed each tier, average time-to-pass, etc. Builds trust + voyeurism appeal. | B | S | Indexer aggregations | public | **should** |
| B15 | Embeddable profile card | OG-image / Farcaster-frame generator so a trader's profile page renders as a rich card when shared. | B | S | OG image service | public | **should** |
| B16 | Per-trade share | One-click share a single notable trade as a card. Mirrors Hyperliquid's social-proof loop. | B | S | OG image service | trader | **could** |
| B17 | Activity / streak counter | "Active streak: 11 days." Soft engagement hook without explicit airdrop framing. | B | S | Indexer | trader | **could** |
| B18 | Tier-pass anniversary reminders | Email or Discord webhook: "It's been 30 days since you passed Basic — Pro is waiting." | B | S | Indexer + notification service | trader | **could** |
| B19 | API/RPC for third-party readers | Public JSON endpoint exposing the leaderboard and per-wallet stats. Lets ecosystem partners pull v1 data. | B | M | Indexer query layer | public | **could** |
| B20 | Cohort SBT viewable in wallets | Ensure SBT metadata renders correctly in Sui Wallet and Suiet. Validation step, not new build. | B | S | SBT metadata schema | trader | **must** |

### Group C: Anti-features (deliberately NOT building in v1)

| # | Anti-feature | Why cut for v1 | What to do instead |
|---|--------------|-----------------|--------------------|
| C1 | News / economic-calendar widget | Cargo cult from forex prop firms; crypto has no NFP equivalent. Adds clutter. | Nothing — explicit non-feature. |
| C2 | Copy-trading / vaults | Belongs in v2 with real capital; meaningless on paper trades; introduces incentive distortion (farm-via-copying). | Document as v2 candidate. |
| C3 | News-event lockout rule | Same as C1. Solves a forex problem the platform doesn't have. | Drop entirely. |
| C4 | "Consistency rule" (Topstep-style 50% cap on largest day) | Paper-trading with no payouts; doesn't protect anything that matters in v1. Adds rule-litigation surface. | Capture "consistency" as an analytical leaderboard metric (B9), not a hard rule. |
| C5 | Affiliate / referral dashboard | Invite-only beta; affiliates incentivize spam and Sybils. | Phase 2+, after open access. |
| C6 | In-app chat / DMs | Discord owns this. Building in-app chat burns engineering time on the wrong moat. | Discord. |
| C7 | Social feed (Twitter-in-app) | Same — Twitter/X and Farcaster already exist; this platform should distribute *to* them, not replicate them. | Per-trade share (B16) + shareable profile (B2). |
| C8 | Mobile native app (iOS/Android) | A responsive web dashboard is sufficient for v1; native app has months of overhead (App Store review, wallet linking on mobile is awful). | Mobile-responsive web (A12). |
| C9 | Multi-asset categories (perps, options, prediction markets, airdrop hunting) | Per PROJECT.md §13: spot only in v1. Perps in Phase 2. | Defer. |
| C10 | KYC | Per PROJECT.md: no fiat, no fees, no payouts → no KYC required. Adding it now hurts onboarding without protecting anything. | Defer until v2 jurisdictions require it. |
| C11 | Payout calendar / payout request flow | No real capital, no payouts. Building this for v1 implies promises the product cannot keep. | Defer to v2. |
| C12 | Scaling plan (auto-increase shadow allocation past Pro) | Three tiers is the v1 ladder by design; further scaling needs real capital to mean anything. | Defer to v2. |
| C13 | Profit split UI | Same — no profits to split in v1. | Defer to v2. |
| C14 | "Refundable fee" gimmick | No fee in v1. | N/A. |
| C15 | Dispute resolution / re-adjudication portal | Success criterion: zero overrides. The whole point is that on-chain is the final word. Building a dispute portal undermines this. | Discord ticket for UX bugs only; never for outcomes. |
| C16 | Multi-currency / fiat display toggle | One unit (USD) is enough for v1. Localization is a v2 problem. | Defer. |
| C17 | Dark/light mode toggle | Dark mode only — crypto UX default, saves design + engineering time. | Single visual theme. |
| C18 | Trader-vs-trader head-to-head competitions | Tempting for engagement but spreads attention away from the tier ladder, which is the core retention mechanic. | Reconsider in Phase 2 as a seasonal event. |
| C19 | Strategy / journal note-taking on trades | TradeNote / TradeZella / web2 prop firm copycat. Distracts from the core. | Could be added in Phase 2 if traders ask. |
| C20 | DAO / governance / token | Explicitly out per PROJECT.md §13. Even building "governance lite" implies one is coming. | Silence; the soft-airdrop page (B8) handles the question honestly. |
| C21 | Achievements / badges system beyond tier passes | Layer3 / Galxe pattern is tempting but dilutes the core SBT signal. v1's credential should mean *one thing*: passing tier evaluations. | Maybe one or two milestones (B10) as static facts, never a sprawling achievement tree. |
| C22 | Per-pair leaderboards | Splits the leaderboard's social mass; v1 has too few traders to support sub-leaderboards. | Single leaderboard, multi-axis sortable. |
| C23 | Public on-chain LP / vault for traders to deposit into | No deposits in v1. | Defer to v2. |
| C24 | News / blog / content marketing CMS | Closed beta with 50–100 traders; content is Discord-native. | Discord announcements. |
| C25 | Onramp / fiat-to-crypto integration | No real money flows. | N/A. |
| C26 | Email marketing automation beyond transactional | Closed beta; over-automation reads as desperate. Manual founder-written cohort emails are better. | Manual broadcast in Discord + plain email. |

---

## Feature Dependency Graph

```
A1 wallet connect ─┬─> A2 tier picker ─> A5 intent form ─> A3 equity curve ─> A4 rule pills
                   │                                                            │
                   └─> A17 invite flow                                          │
                                                                                v
A10 price feed transparency ──> A5 (must show before A5)                     A8 pass/fail
A11 slippage transparency  ──> A5                                               │
                                                                                v
A6 positions ─> A7 history ─> A14 explorer link                              B3 SBT mint ─> B4 mint ceremony
                                                                                │
                                                                                v
                                                              B1 leaderboard <──┴── B2 profile page <── B6 verifiable history
                                                              B9 consistency score
                                                              B10 hall of fame
                                                              B14 cohort-health dashboard
                                                              B15 embed cards <── B16 per-trade share
                                                              B20 wallet display (validation, not blocking)
                                                              B12 SBT level-up art (parallel)

Operator:
A20 allowlist ─> A21 pause switch ─> (covered by indexer + admin app)

Out-of-band (non-blocking but required):
A19 Discord
A16 FAQ + B8 soft-airdrop page
```

Critical-path observation: **B1 (leaderboard), B2 (profile), B3 (SBT), and B6 (verifiable history) are mutually reinforcing and share the indexer as a backbone.** Cutting any one of them halves the retention proposition. They must ship together at launch, not as follow-ups.

---

## MVP Recommendation (Strict Cut for Timeline Risk)

If the 14–18-week timeline slips and a 50%-scope cut is forced (per PROJECT.md priority stack), the **survives-the-cut** v1 feature set is:

**Survives (Must-ship-or-no-launch):**
1. A1, A2, A3, A4, A5, A6, A7, A8, A9 — the trader can wallet-connect, pick a tier, paper-trade, see rules being enforced, and receive a verdict.
2. A10, A11 — without price/slippage transparency, traders won't trust the platform; this is the v1 essence per PROJECT.md.
3. A14, A15, A16, A18 — basic dignity for the trader (explorer link, rules, FAQ, error states).
4. A17, A19, A20, A21 — operator can run the beta.
5. B1, B2, B3, B6 — the retention engine. Per PROJECT.md priority stack, "SBT + tier ladder + leaderboard" survives 50% cut because retention is load-bearing.
6. B7, B8 — branding the cohort + handling the soft-airdrop question honestly. Both are paragraphs, not features; refusing to ship them creates trust risk far exceeding their build cost.
7. B20 — SBT must render in wallets. Validation step, not new build.

**First to slip (should but not must):**
- B4 mint ceremony (replace with a static "you passed" page)
- B9 consistency score (use raw PnL ordering)
- B10 hall of fame (later cohort cycle)
- B12 SBT level-up art (single static art per tier)
- B14 cohort-health dashboard (operator gets this in admin, public can wait)
- B15 embeddable cards (basic share text, no OG)
- A12 mobile-responsive (target desktop first, mobile-good-enough)

**Could (nice but not needed for launch):**
- B11 backtest replay
- B16 per-trade share
- B17 streak counter
- B18 anniversary reminders
- B19 public API

---

## Engagement Retention Mechanics (Special Attention)

The user's explicit goal: retain crypto traders across the multi-month v1→v2 gap by leaning into soft-airdrop psychology without making explicit promises.

**What's been proven to retain crypto users (with v1 mapping):**

| Mechanic | Proven where | v1 manifestation |
|----------|--------------|-------------------|
| **Points without dollar value** | Hyperliquid, Aevo, almost every L1 testnet rally since 2022 | Mutable SBT level + tier passes (B3). The "points" here are integer fields on an on-chain object. |
| **Public leaderboard with shareable wallet URLs** | Hyperliquid, Polymarket | B1 + B2. Public URL is the share unit. |
| **Time-bound cohort with all-time persistence** | Aevo Sonar, Layer3 quests | "v1 cohort" framing (B7); SBT is permanent, cohort window is bounded. |
| **Visible "I was early" credential** | Every successful crypto product's OG-era badges (OG Hyperliquid, OG Pudgy Penguins, etc.) | The v1 cohort SBT itself is the OG credential. Do not dilute it later by re-using the same SBT type for v2. |
| **Plausible airdrop signal without commitment** | OP airdrop 1, ARB airdrop 1, JUP airdrop, HYPE airdrop, every retroactive program | The soft-airdrop-signal page (B8) explicitly states "no token, no promise" while letting the SBT credibly accumulate value. Crypto users self-impose belief; do not feed the belief, do not deny it either. |
| **Show-off mechanics (mint ceremony, level-up art)** | NFT mints, on-chain games | B4 mint ceremony + B12 SBT level-up art. |
| **Streaks / recency** | Layer3, Duolingo, every Web2 retention playbook | B17 streak counter — defer to post-launch to avoid encouraging spam trades. |
| **Cohort identity / inside-baseball culture** | Bankless, FWB, every Discord-native crypto product | A19 Discord + B7 cohort framing + B10 hall of fame. |

**The soft-airdrop tension — how the v1 spec resolves it:**

1. **Never use the word "airdrop," "token," or "rewards" in marketing or UI.** This is non-negotiable both legally and reputationally.
2. **The SBT proves something genuinely hard.** A v1 cohort SBT proves the holder paper-traded on live mainnet prices against on-chain-enforced rules and passed evaluations. That is a real, verifiable, scarce claim about the holder's behavior. Its value rests on this — not on speculation.
3. **The leaderboard is public and immutable on chain.** This is the demonstration that records cannot be revised, deflating "this isn't real" objections.
4. **The soft-airdrop-signal page (B8) is the load-bearing comms artifact.** It says, in plain English: "We have no token, we may never have a token, we don't promise anything. Here is what the cohort SBT credibly proves about you, and here is how we plan to make it more valuable over time by making it readable by other apps." This is the script. Crypto users will read between the lines; that is the point and that is also fine.
5. **Cohort framing matters.** "v1 cohort" implies subsequent cohorts will exist and will have different (probably weaker) credentials. This anchors the v1 SBT as scarce *by structure*, not by promise.

**What kills the retention play (avoid):**

- Any explicit "rewards" framing — burns the future optionality the user is trying to preserve.
- Diluting the SBT with too many badges — Layer3 cautionary tale.
- Mutating the SBT schema mid-cohort — destroys the "I earned this exact thing" feeling.
- Operator overrides of outcomes — invalidates the credential's claim.
- Leaderboard wipes — fine to reset *seasonal* boards, never reset all-time history.

---

## Sybil-Resistance Design Notes

V1 mitigates Sybil via invite-only allowlist (~50–100 wallets). Post-v1 open access will require structural defenses.

**Patterns to keep available for post-v1:**

| Defense | When to activate | v1 cost |
|---------|------------------|---------|
| Wallet age / on-chain history requirement | Open access | 0 — schema-compatible already |
| Per-tier evaluation fee (refundable on pass) | V2 | 0 — already in PROJECT.md long-term vision |
| Proof-of-personhood (World ID, Gitcoin Passport) | When open access + leaderboard rewards exist | 0 — defer integration |
| Discord-vetted invite chains | V1.5 | 0 — natural extension of invite-only |
| Capital-at-risk (deposit forfeitable on fail) | V2 with real capital | 0 — v2 concern |
| Behavioral anomaly detection (correlated trades across wallets) | Once indexer has volume | M — useful to start collecting signals now even if not enforcing |

**v1 cost to keep these options open:** indexer should log enough per-trade and per-wallet metadata that retroactive Sybil clustering is possible (timing correlations, address co-funding patterns, trade-pattern similarity). Logging is cheap; analytics can come later. **One small adjustment recommended:** ensure the indexer captures the funding-source wallet of each trader's gas-paying account. This is the cheapest possible Sybil-clustering signal to capture now.

---

## v1 Open Questions for Roadmap / Clarify Phase

1. **SBT art strategy.** Static art per tier (cheapest) vs. procedurally-generated art with on-chain metadata (best for show-off) vs. fully on-chain SVG (most crypto-native). Recommend procedurally-generated art with metadata pointing at one of ~3 designs (one per tier).

2. **Profile-page URL surface.** `/profile/<sui-address>` — straightforward; keep it chain-native.

3. **Leaderboard refresh cadence.** Sub-second is overkill; once-per-minute is fine for a public leaderboard. But the *trader's own dashboard* must be sub-second (A3). Keep these two paths separate in the indexer.

4. **Indexer SPOF mitigation surface.** PROJECT.md flags it. Backup drill + restore SLO must be documented before beta opens; otherwise a single VM failure during beta becomes the story.

5. **What happens to v1 cohort SBT in v2?** PROJECT.md leaves this open. The features here assume v1 cohort SBT is preserved (in-place evolution or read-only persistence). Marketing copy on the soft-airdrop page must align with whatever this decision becomes.

6. **Should there be a "withdraw / quit" semantic at all in v1?** If a trader fails, the run is over. But what if they want to quit mid-evaluation cleanly? Recommend "abandon" entrypoint that marks the run failed-by-quit (distinguishable on-chain from rule-breach failure). Cheap, dignified, leaderboard-honest.

---

## Sources

Confidence on most external-product claims below is **MEDIUM** (training-data, knowledge cutoff January 2026) because live web access was not available in this research session.

- FTMO website (`ftmo.com`) — Challenge / Verification / Funded rules, MetriX analytics page, Swing variant news rules. `[verify pre-launch].`
- Topstep website (`topstep.com`) — Trading Combine rules, trailing max loss, consistency rule, scaling plan, weekly payouts. `[verify pre-launch].`
- FundedNext, The5%ers, Apex Trader Funding — public marketing pages and rule disclosures. `[verify].`
- Hyperliquid leaderboard (`app.hyperliquid.xyz/leaderboard`), HLP vault docs, points program — well-documented in public posts and the Hyperliquid docs through 2024–2025. `[verify].`
- GMX (`gmx.io`) — referral system, esGMX vesting, Stats page. `[verify].`
- dYdX historical trading rewards — well-documented in dYdX governance forums. `[verify].`
- Aevo Sonar competitions, Farms — Aevo blog + docs. `[verify].`
- Polymarket leaderboard — `polymarket.com/leaderboard`. `[verify].`
- Galxe campaigns (`galxe.com`), Layer3 quests (`layer3.xyz`), Guild.xyz roles, Optimism RetroPGF (`retrofunding.optimism.io`), Snapshot, Worldcoin / World ID — public docs and ecosystem posts through 2025. `[verify].`
- Project context: `/Users/gifted/Documents/repos/entrypoint/prop-firm/.claude/plans/Crypto-Native/PROJECT.md`, `/Users/gifted/Documents/repos/entrypoint/prop-firm/.claude/plans/Crypto-Native/STATE.md` (HIGH confidence — read directly).

**Recommendation to consumer:** before locking the v1 spec, run a live verification pass against the actual product pages of FTMO, Topstep, Hyperliquid, Galxe, and Layer3 to confirm specific numeric thresholds and feature names. The categorical patterns (A/B/C verdicts here) are stable regardless of those specifics.
