# Product

## Register

product

## Users

**Primary: invited crypto-native traders** (50-100 in the v1 closed beta), sourced from the founder's
networks. They already trade, already hold wallets, and are fluent in on-chain products. Their context
is in-flow and recurring: they check evaluation status and submit trade intents from desktop or phone,
often several times a day, sometimes during volatile moves. The job to be done: prove trading skill
against live mainnet prices, pass tiers, climb the leaderboard, and build a verifiable track record
that compounds over the v1->v2 window.

**Secondary: the operator** (initially the founder), who monitors beta health, the allowlist, and
risk. The operator works from a separate admin surface; the trader app is built for the trader.

## Product Purpose

A proprietary trading firm, v1 closed beta. Invited traders sign in (email/social + a wallet created
for them behind the scenes), pick a tier (Starter / Basic / Pro), and paper-trade BTC, ETH, and SOL
against live mainnet prices with a calibrated slippage and fill model. A smart contract is the
execution surface: it accepts trade intents, models fills deterministically, enforces drawdown /
daily-loss / profit-target rules, and emits pass/fail events that mint or level a non-transferable
Genesis credential. A public leaderboard and per-trader profiles turn that record into a verifiable
proof of skill.

The chain (Sui, Pyth oracle, the 7K execution aggregator, the on-chain credential) is **infrastructure**.
It makes the evaluation trustworthy and the record tamper-proof, but it is not the product's face.

Success looks like: 30+ invited traders complete a full evaluation cycle; every pass/fail is
explicable from the verifiable record alone (zero operator override); and the engagement loop
(credential + tier ladder + leaderboard) runs end-to-end without intervention. The deeper purpose is
to validate the evaluation mechanic and recruit the trader cohort that v2 (real capital) will need,
while keeping that cohort engaged through the build gap.

## Brand Personality

**Calm, institutional, restrained.** Voice is measured, exact, and evidence-led: it proves, it never
promises. The numbers are the loudest thing on screen; the chrome stays quiet. It should read like a
serious trading desk, not a crypto app, not a casino, not a hype machine. The emotional goal is trust
earned through transparency: the slippage math (market mid + size slippage + 2 bps house spread = your
fill) is shown before submit, and every claim is independently verifiable. Confidence here comes from
disclosure, not from adjectives, and never from crypto theatre.

## Anti-references

- **The crypto-app aesthetic.** Neon/lime palettes, pixel-art and checkerboard motifs, wallet
  addresses pushed to the foreground, protocol names and chain jargon as headlines, "gm/wagmi/degen"
  voice. The chain is plumbing; the surface must not advertise it. This is the primary anti-reference.
- **Degen casino UI**: flashing neon, slot-machine animation, rocket/moon iconography, jackpot energy.
- **Generic SaaS dashboard**: cream/blue palette, the hero-metric template, identical icon-card grids,
  gradient-text headings.
- **Cluttered exchange (legacy-CEX density overload)**: every pixel a widget, tiny fonts, ten panels
  competing, no breathing room.

(Not an anti-reference: serious trading terminals and prop-desk tooling. Familiarity with category-best
tools is a feature here, not a flaw.)

## Design Principles

1. **Institutional, not crypto: the chain is plumbing.** Crypto lives in the infrastructure, never in
   the UI/UX. Speak the language of a trading desk (account, balance, evaluation, credential, market
   price, execution), not of a wallet (gm, mint, SBT, gas, chain chips). On-chain verifiability is a
   quiet detail you can drill into, never the headline.
2. **Show the math, never hide it.** Slippage, the house spread, the price source, execution routing,
   and live rule state are always visible and verifiable. Trust is earned by disclosure.
3. **The data is the interface.** Equity, P&L, rule budgets, and prices are the loudest elements;
   decoration and chrome stay quiet so the trader stays in flow. When in doubt, let a number carry it.
4. **Prove, never promise.** The Genesis credential and cohort framing describe what a trader has
   demonstrably done. Never imply rewards, tokens, or allocations.
5. **Calm under pressure.** Traders open this during volatile moments. The interface stays legible,
   fast, and unflustered. Restraint over spectacle, even on win and loss moments.
6. **Every state is designed.** Loading, empty, error, paused (stale-feed halt), and the three terminal
   outcomes (passed / failed / inactive) each get a deliberate, dignified treatment.

## Accessibility & Inclusion

Target **WCAG 2.2 AA**. Body text clears 4.5:1, large/bold text 3:1; placeholder text meets body
contrast. Visible focus rings on every interactive element; modals close on Esc and trap focus;
sortable headers and toggles are real buttons. Full `prefers-reduced-motion` alternatives for every
animation (number-flash, live-pulse, confetti, reveals). Color is never the sole signal: P&L and
rule-zone state always pair the green/red with a sign or label. The product is dark-only by decision,
so muted-gray text on tinted dark surfaces must be checked against 4.5:1 rather than assumed.
