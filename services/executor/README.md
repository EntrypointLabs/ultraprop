# Executor service

The always-on settler for the on-chain evaluation. It owns the live mark feed and
the server-side position ledger, and is the browser-independent half of the
trading loop: it accrues funding, watches every open position, and closes one the
moment its take-profit / stop-loss fires or it liquidates — writing the close
on-chain with the firm executor key. It is deliberately a **separate service**
from the public feed gateway, because it holds that key.

It shares the PnL math (`@shared/sim-core`), the write ABI (`@shared/sui-propfirm`),
and the schema (`@shared/db`) with the trader app, so the live overlay, the manual
close route, and this loop can never disagree on a number.

## What it does each tick (~250 ms)

1. Accrue funding on open positions that have crossed an hourly settlement boundary.
2. Aggregate per-account equity (for cross-margin liquidation).
3. Settle any position whose bracket fired or that liquidated: recompute the net
   realized PnL (price − fees + funding), **atomically** claim the ledger row
   (so the manual-close route and this loop never double-book), write `log_trade`,
   then reconcile the account (`pass`/`fail` if a rule resolved).

Manual closes still come through the app's `POST /api/trades/close`; this loop owns
only the automatic exits the browser used to miss when it was shut.

## Provisioning

1. **Database** — a Neon Postgres (standard wire protocol). Create the schema:
   ```sh
   DATABASE_URL=postgres://… pnpm --filter @shared/db db:migrate
   ```
   Point the trader app at the same `DATABASE_URL` so its intake/close routes write
   the ledger this service reads.

2. **Executor key** — the firm keypair that holds the admin + executor caps. Until
   its env is set the service runs with a **stub writer** (logs what it would sign,
   no real writes) so you can validate the loop safely.

## Environment

| var | purpose |
| --- | --- |
| `DATABASE_URL` | Neon connection string (required) |
| `SUI_ADMIN_SECRET_KEY` | firm keypair (`suiprivkey1…` or base64) |
| `PROPFIRM_PACKAGE_ID` | deployed package id |
| `PROPFIRM_ACCOUNT_REGISTRY_ID` | shared account registry |
| `PROPFIRM_ACCESS_REGISTRY_ID` | shared access registry |
| `PROPFIRM_EXECUTOR_CAP_ID` | executor cap object id |
| `PROPFIRM_ADMIN_CAP_ID` | admin cap object id |
| `SUI_NETWORK` | `testnet` (default) / `mainnet` |
| `SUI_GRPC_URL` | optional gRPC endpoint override |
| `PORT` | health endpoint port (default 8788) |

With the Sui vars set the bootstrap logs `on-chain writer: live`; without them,
`STUB (no writes)`.

## Run

```sh
pnpm --filter @service/executor dev     # tsx watch
pnpm --filter @service/executor build && pnpm --filter @service/executor start
pnpm --filter @service/executor test    # pglite-backed settlement tests, no Docker
```

`GET /health` → `{ ok: true, service: "executor" }`.
