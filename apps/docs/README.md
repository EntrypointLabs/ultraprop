# @app/docs

User-facing documentation for Ultraprop, served at **docs.ultraprop.xyz**. Built with
[Vocs](https://vocs.dev). This is the *trader's* manual — tiers, rules, evaluations,
the funded phase, and how the platform works underneath — not a developer reference.

## Develop

```bash
pnpm --filter @app/docs dev      # dev server on http://localhost:3100
pnpm --filter @app/docs build    # static build → docs/dist
pnpm --filter @app/docs preview  # serve the production build
```

## Structure

```
apps/docs/
├── vocs.config.ts        # title, sidebar, top nav, brand theme
└── docs/
    ├── pages/            # every page is one .mdx file; the URL mirrors the path
    │   ├── index.mdx                 # /
    │   ├── getting-started.mdx
    │   ├── how-it-works.mdx
    │   ├── evaluations/              # tiers, rules, markets, trading, outcomes, payment
    │   ├── record/                   # credential, leaderboard, profile
    │   ├── funded/                   # overview, splits, payouts (v2)
    │   ├── transparency/             # enforcement, fill-model, prices, verifiability
    │   ├── roadmap.mdx
    │   └── reference/                # glossary, faq
    └── public/           # logo + favicon assets
```

The sidebar and top nav are defined in [`vocs.config.ts`](./vocs.config.ts). Add a page
by creating an `.mdx` file under `docs/pages/` and adding a sidebar entry.

## Voice & guardrails

The docs follow the product's brand law — **calm, institutional, restrained; prove,
never promise.** Two hard rules when editing:

- **No token / airdrop / allocation language.** The Genesis credential is proof of
  trading skill, never a claim on future value. Never imply rewards beyond the funded
  profit splits.
- **Mark v2 clearly.** v1 (the live closed beta) is paper-trading with no real capital
  and no payouts. Anything in the funded phase is the forward plan and must be labeled
  as such.

## Deployment

Vocs emits a static site to `docs/dist`. The Vercel project for this app uses
`apps/docs` as its root directory; build command and output dir are set in
[`vercel.json`](./vercel.json).
