# Deploying the backend on Fly.io

The platform splits across two homes:

- **Vercel** — the Next.js trader app (UI **and** all API routes: onboard, pay-verify, trades/close, positions/open, pass/fail/breach/reactivate).
- **Fly.io** — two small always-on services that Vercel can't host:
  - **`ultraprop-gateway`** — public venue-feed proxy (catalog, SSE marks feed, candles). Holds **no secrets**.
  - **`ultraprop-executor`** — the always-on settler. Holds the **firm key**; runs as a worker (no public port). Kept separate so the key never sits on the public box.

Neon (the ledger DB) and the Sui contracts are already provisioned.

## Prerequisites

```sh
brew install flyctl        # or: curl -L https://fly.io/install.sh | sh
fly auth login
```

All commands below run from the **repo root** (the Docker build context is the whole monorepo, so turbo can build the shared packages).

## 1. Gateway (public, no secrets)

```sh
fly apps create ultraprop-gateway
fly deploy --config fly.gateway.toml
```

> The config lives at the **repo root** (`fly.gateway.toml`) on purpose: flyctl
> resolves the Dockerfile path **and** the build context relative to the config
> file's folder. With the config at the root, the context is the whole monorepo
> (so the Dockerfile's `COPY . .` works) and `dockerfile = "services/…"` resolves
> correctly. Don't move it into the service folder or pass `--dockerfile`.

Gives you `https://ultraprop-gateway.fly.dev`. Verify:

```sh
curl -s https://ultraprop-gateway.fly.dev/api/catalog | head -c 200
```

## 2. Executor (worker, holds the keys)

```sh
fly apps create ultraprop-executor

# Secrets — use the DIRECT (unpooled) Neon host here (long-lived process).
fly secrets set --app ultraprop-executor \
  DATABASE_URL='postgres://…direct.neon.tech/db' \
  SUI_ADMIN_SECRET_KEY='suiprivkey1…' \
  PROPFIRM_PACKAGE_ID='0x…' \
  PROPFIRM_ACCOUNT_REGISTRY_ID='0x…' \
  PROPFIRM_ACCESS_REGISTRY_ID='0x…' \
  PROPFIRM_EXECUTOR_CAP_ID='0x…' \
  PROPFIRM_ADMIN_CAP_ID='0x…'

fly deploy --config fly.executor.toml

# EXACTLY ONE settler — the ExecutorCap is an owned object (serial writes).
fly scale count 1 --app ultraprop-executor
```

Confirm it came up live (not stubbed):

```sh
fly logs --app ultraprop-executor
# look for: [executor] on-chain writer: live (firm executor key)
#           [settlement] started; … markets, 250ms tick
```

The coordinate ids are in `deployments/testnet.json`.

## 3. Point the Vercel app at the gateway

On the trader app's Vercel project, set:

```
GATEWAY_URL = https://ultraprop-gateway.fly.dev
```

Redeploy the app. The app's `DATABASE_URL` stays the **pooled** (`-pooler`) Neon host.

## Notes & gotchas

- **One executor only.** Never `fly scale count 2` — two signers would contend on the owned `ExecutorCap`.
- **Always-on.** Both apps are configured not to scale to zero; the gateway keeps one shared HL socket warm, the executor must run 24/7 to settle while browsers are closed.
- **Direct vs pooled Postgres.** Executor → direct host; app → pooled (`-pooler`) host. Migrations also use the direct host.
- **Cost.** Two `shared-cpu-1x` 512 MB machines ≈ a few dollars/month. Drop to 256 MB if memory headroom allows.
- **Updating.** Re-run the same `fly deploy …` after pushing changes. Fly rebuilds the image from the monorepo.
