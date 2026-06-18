# Trader App — Design System

The trader app is a dark, crypto-native trading terminal. Its visual language is borrowed
directly from the Ultramarkets reference (electric lime + violet on near-black, pixel/checkerboard
motif, tabular numerics, dense data tables, leverage badges, live status). This document is the
single source of truth for that look. Every screen must read like it shipped from the same studio.

## Product framing (what this app is)

A **crypto-native prop firm** v1 closed beta. Invited traders connect a wallet, pick a tier, and
paper-trade the full Bluefin, DeepBook & Hyperliquid perpetual catalog against live mainnet prices with a calibrated slippage + fill model.
A smart contract enforces drawdown / daily-loss / profit-target rules and emits pass/fail events
that mint or level a non-transferable **v1 Genesis cohort SBT**. A public leaderboard + profiles
drive retention across the v1→v2 gap (soft-airdrop psychology, never promised).

The load-bearing trust primitive is **slippage transparency**: the trade form shows
`oracle mid + slippage bps + house tilt (+2 bps) = your fill` *before* submit, so a fill can never
feel hidden or rigged.

### Surface mapping (Ultramarkets → prop firm)

| Ultramarkets | This app |
|---|---|
| Prediction-markets table (Long/Short, leverage badge, sparkline, countdown) | Tradeable assets across the full Bluefin, DeepBook & Hyperliquid perpetual catalog: live price, 24h%, sparkline, Long/Short entry, leverage = tier |
| Featured-market hero carousel | Active-evaluation summary card / "Start your evaluation" hero |
| "Genesis points program is now live" banner | "v1 Genesis cohort is live" banner → `/points` |
| Points page (Season/Weekly Pool/Daily Scores/Distribution) | `/points`: Genesis cohort, tier ladder, SBT progress, weekly cohort stats |
| Leaderboard | `/leaderboard`: multi-axis (highest tier · shadow PnL · passes · consistency) |
| Public profile by wallet | `/profile/[wallet]`: SBT, tier badges, eval history, equity curves |
| Onboarding "Welcome" modal | First-visit onboarding modal |
| `● Online` status + Report-a-bug/Terms/Privacy footer | Same: connection status + footer |

## Palette (CSS variables — dual theme: Dark + Institutional Light)

The system ships **two faithful renderings of one palette**: the dark cockpit and an
institutional-white light theme. Same semantic token *names*, same brand laws; only the
values and how they resolve differ. The accent is a single confident **red** (lime/violet
were never shipped). Both themes are WCAG 2.2 AA across body, large, and placeholder text.

**Token mechanism (3 layers, Tailwind v4):**

1. **Bridge** — `@theme inline { --color-bg: var(--bg); … }` so each utility resolves to a
   value-layer var at runtime; Tailwind never bakes a static hex, so a class swap repaints
   everything.
2. **Value sets** — `:root` (and the explicit `.light` scope) hold the light values; `.dark`
   holds the dark values. `color-scheme` flips with the class so native controls follow.
3. **Static** — `@theme { … }` for theme-independent radii, type scale, and fonts.

A **System / Light / Dark** control lives in the profile/settings menu. Default follows the
OS, falling back to light. A cookie-read class on `<html>` + an inline pre-paint script make
the first paint flash-free (SSR-safe).

```
TOKEN          DARK        LIGHT       ROLE
/* canvas */
--bg           #0A0A0C     #FCFCFD     app background (chroma-0 near-white in light)
--surface      #16161A     #FFFFFF     cards, table, nav
--surface-2    #1F1F24     #F4F4F6     raised: inputs, hover, popovers
--surface-3    #2A2A30     #E9E9EE     borders-as-fills, skeletons
--border       #2A2A30     #E7E7EC     hairline borders
--border-soft  #1E1E23     #F0F0F3

/* text — AA on every surface step in both themes */
--text         #F4F4F5     #18181B     primary
--text-muted   #A1A1AA     #56565F     secondary / labels
--text-faint   #8C8C96     #71717A     tertiary / placeholders (dark lifted from #6B6B73 to clear AA)

/* accent + action — one confident red; brand aliases the action color */
--brand        #E5484D     #DC3D42     logo, primary CTA fill, brand emphasis
--brand-ink    #FFFFFF     #FFFFFF     text on the red fill
--violet       #E5484D     #DC3D42     (kept as a name for legacy CTAs; resolves to the red)
--violet-hover #D6383E     #C5343A

/* P&L + state — re-tuned for the light canvas (dark keeps its brighter set) */
--up           #34D399     #0C8051     gains, Long, safe (4.85:1 on #FCFCFD)
--down         #F87171     #D4313A     losses, Short, danger (4.76:1)
--warn         #F4C752     #B45309     amber warn (5.02:1 vs lime's 1.6:1 on white)
--info         #38BDF8     #0369A1     info (sky-400 fails on white; deepened)

/* on-tint text — deeper label colors for text on a same-hue 15-20% tint (badges/chips).
   In light the base hue can't clear 4.5:1 on its own tint; these do. In dark they equal
   the base hues, so dark badge rendering is unchanged. */
--on-up        #34D399     #085C3A
--on-down      #F87171     #A51F27
--on-warn      #F4C752     #8F4207
--on-accent    #E5484D     #9E262C

/* rule-pill thresholds (same semantic mapping in both) */
--pill-safe    var(--up)      /* > 30% budget remaining */
--pill-warn    var(--warn)    /* within 30% of breach */
--pill-danger  var(--down)    /* within 10% of breach */
```

Hex via Tailwind v4 `@theme` tokens (not OKLCH — a finite, contrast-audited set; identity
parity wins). Expose as semantic Tailwind colors (`bg-surface`, `text-muted`, `bg-brand`,
`text-up`, `text-down`, `text-warn`, `text-on-up`/`text-on-accent` for tinted chips). The
light canvas is true chroma-0 "institutional white" — never a warm cream/sand near-white,
which reads as the generic AI-SaaS default. Warmth is carried by the accent and type, never
by a tinted body.

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

- Tradeable symbols in v1: **the full Bluefin, DeepBook & Hyperliquid perpetual catalog** (perpetuals, simulated).
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
