# Trader App — Design System

The trader app is a dark, crypto-native trading terminal. Its visual language is borrowed
directly from the Ultramarkets reference (electric lime + violet on near-black, pixel/checkerboard
motif, tabular numerics, dense data tables, leverage badges, live status). This document is the
single source of truth for that look. Every screen must read like it shipped from the same studio.

## Product framing (what this app is)

A **crypto-native prop firm** v1 closed beta. Invited traders connect a wallet, pick a tier, and
paper-trade BTC/ETH/SOL against live mainnet oracle prices with a calibrated slippage + fill model.
A smart contract enforces drawdown / daily-loss / profit-target rules and emits pass/fail events
that mint or level a non-transferable **v1 Genesis cohort SBT**. A public leaderboard + profiles
drive retention across the v1→v2 gap (soft-airdrop psychology, never promised).

The load-bearing trust primitive is **slippage transparency**: the trade form shows
`oracle mid + slippage bps + house tilt (+2 bps) = your fill` *before* submit, so a fill can never
feel hidden or rigged.

### Surface mapping (Ultramarkets → prop firm)

| Ultramarkets | This app |
|---|---|
| Prediction-markets table (Long/Short, leverage badge, sparkline, countdown) | Tradeable assets BTC/ETH/SOL: live oracle price, 24h%, sparkline, Long/Short entry, leverage = tier |
| Featured-market hero carousel | Active-evaluation summary card / "Start your evaluation" hero |
| "Genesis points program is now live" banner | "v1 Genesis cohort is live" banner → `/points` |
| Points page (Season/Weekly Pool/Daily Scores/Distribution) | `/points`: Genesis cohort, tier ladder, SBT progress, weekly cohort stats |
| Leaderboard | `/leaderboard`: multi-axis (highest tier · shadow PnL · passes · consistency) |
| Public profile by wallet | `/profile/[wallet]`: SBT, tier badges, eval history, equity curves |
| Onboarding "Welcome" modal | First-visit onboarding modal |
| `● Online` status + Report-a-bug/Terms/Privacy footer | Same: connection status + footer |

## Palette (CSS variables, dark only — no light mode, per scope)

```
/* canvas */
--bg            #0A0A0C   /* app background */
--surface       #16161A   /* cards, table, nav */
--surface-2     #1F1F24   /* raised: inputs, hover, popovers */
--surface-3     #2A2A30   /* borders-as-fills, skeletons */
--border        #2A2A30   /* hairline borders */
--border-soft   #1E1E23

/* text */
--text          #F4F4F5   /* primary */
--text-muted    #A1A1AA   /* secondary / labels */
--text-faint    #6B6B73   /* tertiary / disabled */

/* brand + action */
--brand         #D4F23E   /* electric lime — logo, leverage badge, brand emphasis */
--brand-ink     #0A0A0C   /* text on lime */
--violet        #6D5DFC   /* primary actions, Sign in, key CTAs */
--violet-hover  #5B4BEA

/* P&L + state */
--up            #34D399   /* gains, Long, safe */
--down          #F87171   /* losses, Short, danger */
--warn          #F4C752   /* amber — Genesis/PENDING tags, "approaching breach" */
--info          #38BDF8

/* rule-pill thresholds */
--pill-safe     var(--up)     /* > 30% budget remaining */
--pill-warn     var(--warn)   /* within 30% of breach */
--pill-danger   var(--down)   /* within 10% of breach */
```

Use HSL/oklch or hex via Tailwind v4 `@theme` tokens. Expose as semantic Tailwind colors
(`bg-surface`, `text-muted`, `text-brand`, `bg-violet`, `text-up`, `text-down`, `text-warn`).

## Typography

- **UI / sans:** Inter (or `Geist`) via `next/font`. Weights 400/500/600/700.
- **Numerics:** a monospace with tabular figures — `Geist Mono` / `JetBrains Mono` via `next/font`.
  ALL prices, %, sizes, countdowns, ranks, addresses use `font-mono tabular-nums`. This is the
  single most recognizable trait of the reference — never render a price in the sans face.
- **Display headers:** oversized, tight tracking, optionally outlined/stroked text for hero
  section titles (e.g. a big "GENESIS COHORT" outline behind the points hero). Use sparingly.
- Scale: text-xs 12 / sm 13 / base 14 (app baseline is 14, not 16) / lg 16 / xl 18 / 2xl 22 /
  3xl 28 / 4xl 36 / display 56-72.

## Shape, spacing, motion

- Radii: `--r-sm 6px`, `--r 10px` (cards/buttons), `--r-lg 14px` (modals/hero), `--r-full`.
- Borders: 1px hairlines `--border`; cards = `bg-surface` + hairline, no heavy shadows. Elevation
  comes from surface steps, not big shadows. Subtle shadow only on modals/popovers.
- Density: tables are dense (row height ~44px, px-3). Generous outer page padding (px-4 sm:px-6).
- Motion: fast and restrained. 120-180ms ease-out for hover/press; number changes flash briefly
  (green on up-tick, red on down-tick) then settle. Equity curve + sparklines animate on update.
  Pass screen: confetti + SBT level-up reveal. Respect `prefers-reduced-motion`.

## Signature motifs (do these — they make it read as "that product")

1. **Pixel/checkerboard top border** — a thin purple/violet pixelated checkerboard strip pinned to
   the very top of the viewport, above the nav. Implement as a repeating CSS background or tiny SVG.
2. **Leverage badge** — small lime pill, mono, e.g. `10X` / `8X` / tier name. Appears on market
   rows and tier cards.
3. **Long/Short paired buttons** — green `Long` + red `Short`, inline on market rows and as the
   trade-form side toggle.
4. **Live status dot** — green `● Live` (pulsing) / amber `● Reconnecting` / red `● Stale` in the
   footer strip and header.
5. **Tabular mono numerics everywhere**, with up/down color + sign.
6. **Genesis amber tag** — `GENESIS` / `PENDING` small amber chips.

## Component language

- **Cards**: `bg-surface` + hairline border + `rounded-[--r]`. Section header = small uppercase
  `text-muted` label + value/content.
- **Rule pills**: compact chip with label + remaining-budget value + a thin progress track; color
  ramps safe→warn→danger by threshold. Clicking opens a modal with the rule text + current state.
- **Stat tiles**: label (xs uppercase muted) over big mono value, optional delta.
- **Tables**: sticky header, sortable columns (caret on active sort), zebra-free, hairline row
  separators, hover = `bg-surface-2`. Right-align numerics.
- **Tier cards**: 3-up. Each shows tier name + leverage/allocation, profit target, max DD, daily
  loss, intent cap, and a primary CTA. Locked tiers show a lock state + "pass {prev} to unlock".
- **Drawdown gauge**: radial gauge, current DD as % of max DD, color by proximity to limit.
- **Equity curve**: TradingView Lightweight Charts area series; annotation lines at the max-DD floor
  (`peak*(1-maxDd)`) and profit-target ceiling (`start*(1+target)`). Dark theme matching tokens.
- **Onboarding modal**: lime pixel banner image/block + "Welcome to {brand}" + 2 lines + primary
  (filled) "Get started" + ghost "Learn more". Dismiss persists (mock store).
- **Stale-feed banner**: site-wide amber/red bar when `divergenceHalt` is true; copy:
  "Oracle feeds diverged; trading paused to protect your evaluation. Resumes automatically."

## Tier ladder (authoritative numbers — use these in tier cards & rule pills)

| Tier | Profit target | Max DD | Daily loss | Shadow allocation | Intent cap |
|---|---|---|---|---|---|
| Starter | 8% | 10% | (derive ~5%) | $10,000 | 200 |
| Basic | 8% | 8% | (derive ~5%) | $25,000 | 200 |
| Pro | 10% | 8% | (derive ~5%) | $50,000 | 200 |

Pass tier N → unlock N+1. Higher tier = stronger SBT level + better leaderboard position.
Daily reset is **00:00 UTC for everyone**; dashboard shows "Daily reset in Xh Ym".

## Copy rules (non-negotiable)

- Tradeable symbols in v1: **BTC, ETH, SOL only** (spot).
- Slippage tilt is **+2 bps against the trader**, always shown pre-submit.
- Terminal states are three distinct things: **Passed**, **Failed**, **Inactive** (7-day idle
  auto-terminate; never framed as punishment). Failure copy is dignified, never "You lost!".
- **Never** use the words "token", "airdrop", "allocation", or "rewards" anywhere. The SBT is
  described as verifiable, non-transferable proof of trading skill earned in the closed beta.
- Every on-chain assertion gets a "View on Sui Explorer" affordance.

## Accessibility & responsive

- Mobile-first responsive: the markets table collapses to stacked cards (asset + price + spark +
  Long/Short), the cockpit stacks (curve → pills → trade form → positions). Test at 390px and 1280px.
- AA contrast on text. Lime is a brand/emphasis color on dark — never lime text on white.
- Keyboard-operable: focus rings (violet), Esc closes modals, sortable headers are buttons.
