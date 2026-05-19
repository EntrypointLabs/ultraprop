# VERSIONS.md

Live-verified toolchain pins for the crypto-native prop-firm monorepo. Every row is sourced from the live release page or official endpoint (not from STACK.md training data). Re-verify quarterly or before any major release of the platform.

**Verified by:** executor-1 (Phase 00-foundation, swarm `starry-honking-knuth`)
**Verified-as-of:** 2026-05-19

| Tool | Version | verified-as-of | Source URL |
|------|---------|----------------|------------|
| Sui CLI (mainnet branch) | mainnet-v1.71.1 | verified-as-of: 2026-05-19 | https://github.com/MystenLabs/sui/releases/tag/mainnet-v1.71.1 |
| Anchor | 1.0.2 | verified-as-of: 2026-05-19 | https://github.com/coral-xyz/anchor/releases (tag v1.0.2, published 2026-05-02) |
| Solana / Agave CLI | 4.0.0 | verified-as-of: 2026-05-19 | https://github.com/anza-xyz/agave/releases/tag/v4.0.0 |
| Node.js LTS | 24.15.0 (Krypton — current active LTS) | verified-as-of: 2026-05-19 | https://nodejs.org/dist/index.json (filtered `lts: true`); see https://nodejs.org/en/about/previous-releases |
| pnpm | 11.1.3 | verified-as-of: 2026-05-19 | https://github.com/pnpm/pnpm/releases/tag/v11.1.3 |
| Rust stable | 1.95.0 | verified-as-of: 2026-05-19 | https://github.com/rust-lang/rust/releases/tag/1.95.0 |
| Next.js | 16.2.6 | verified-as-of: 2026-05-19 | https://github.com/vercel/next.js/releases/tag/v16.2.6 |
| Biome | 2.4.15 | verified-as-of: 2026-05-19 | https://github.com/biomejs/biome/releases/tag/%40biomejs%2Fbiome%402.4.15 |
| Turborepo | 2.9.14 | verified-as-of: 2026-05-19 | https://github.com/vercel/turborepo/releases/tag/v2.9.14 |
| Pyth Hermes endpoint | https://hermes.pyth.network (HTTP 200; /v2/price_feeds returns live feed catalog) | verified-as-of: 2026-05-19 | https://docs.pyth.network/price-feeds/api-instances-and-providers/hermes |

## Notes

- **Anchor releases:** v1.0.x release artifacts are republished under the `otter-sec/anchor` mirror in GitHub's release UI, but the tags (v1.0.0, v1.0.1, v1.0.2) are the official Anchor releases on the `coral-xyz/anchor` repository. The 0.31 → 1.0 jump landed in 2026-04; v1.0.2 is the latest stable.
- **Node LTS choice:** v24 (Krypton) is the current active LTS as of verification. v22 (Jod) is in maintenance LTS. The repo `package.json` engines field is set to `>=22` so either major satisfies; `.nvmrc` pins v24 to track active LTS.
- **Sui mainnet branch:** the tag `mainnet-v1.71.1` is the most recent release with the `mainnet-` prefix (Sui ships separate branch tags for devnet/testnet/mainnet).
- **Pyth Hermes:** the public endpoint at `hermes.pyth.network` was confirmed live; the price-feeds catalog is reachable. Phase 0.6 will subscribe to the WS stream at `/v2/updates/price/stream`.
