# v1 On-Chain — Redeploy + Executor Bridge Plan

_Status: planning. Last updated 2026-06-19._

## Why redeploy

The original testnet deployer wallet (`0x559ef150…72e6`) is unreachable. It owns the
`AdminCap`, `ExecutorCap`, `UpgradeCap`, and the one-time `TreasuryCreatorCap` /
`VaultCreatorCap` for the published package (`0xdea2e005…2c6677`). Without that wallet
we can neither bootstrap the Treasury nor upgrade the package, so the only clean path is
a **fresh publish from a wallet we control**. Redeploy mints new caps to the new deployer.

## v1 scope (what we are actually shipping)

On-chain-**recorded** paper evaluation. Real evaluation fee in (crypto transfer), simulated
trading against **real Hyperliquid prices**, account + balance + drawdown + trade history
**verifiable on-chain**. **No payouts, no funded real capital** in v1 ("paper trading
simulated money").

### Target flow
1. Sign in with Privy (email / Google / Apple) → Privy account only. No on-chain prompt yet.
2. Pay the evaluation fee — **crypto transfer only for v1** (defer Moonpay/Bridge/Kaoshi).
   Invite-code path skips the fee → **Starter tier only**, firm-sponsored.
3. Pick tier (paid: Starter or Basic; invite: Starter only, Basic unlocks after Starter).
4. On fee confirmation the backend **auto-creates** the on-chain account (no button).
5. Trading is gated on the on-chain account existing.
6. Every closed paper trade is recorded on-chain; balance / drawdown / status are read from
   chain, not localStorage.

## What the contracts already give us (no Move changes for v1)

- `treasury::open_account(AdminCap, …, payment: Coin<USDC>==eval_fee, owner, tier)` —
  atomic fee-collect + account-create. Admin-signed.
  - **Paid:** user transfers `eval_fee` USDC to the firm/admin address → backend confirms →
    admin calls `open_account(payment, owner=user, tier)`.
  - **Invite:** firm funds the `eval_fee` coin → same call, `tier = Starter`.
- `AccountState.equity` is on-chain, opens at `funded_size` (Starter $10k / Basic $25k),
  and is updated by `user_account::log_trade(is_win, pnl, …)` on **trade close** (realized).
  Tiers are **seeded at publish** (`tier_config` init).
- Lifecycle (executor-gated): `log_trade`, `register_dd_breach`, `pass_evaluation`,
  `fail_evaluation`.

### Balance nuance (important)
On-chain `equity` only moves on trade **close** (realized). There is **no open-position /
used-margin field on-chain**. The live trade-form "max" (e.g. $10k → open $1k → $9k) is
*buying power net of open positions* — computed by the **executor/engine** as
`on-chain equity − margin locked by open positions`. The verifiable on-chain record is
realized equity + the closed-trade journal + breaches + pass/fail. Only if the open-position
reservation itself must be on-chain do we extend the contract — **not needed for v1**.

## What we need from the operator (to one-shot the deploy)

1. `sui` CLI installed; `sui client active-env` = **testnet**.
2. `sui client active-address` = the wallet that will be the **firm/admin** (holds AdminCap +
   ExecutorCap after publish), funded with ~1–2 **testnet SUI** (faucet).
3. (Optional) `FEES_ADDRESS` / `EVAL_FUNDS_ADDRESS` — default to the deployer address.
4. Then run: `node scripts/deploy-and-bootstrap.mjs` and send back `deployments/testnet.json`.

## Open item: testnet USDC

The contract uses Circle's `usdc::usdc::USDC` type. Users need testnet USDC to pay the fee.
Decision needed: source testnet Circle USDC (faucet/swap) **or** (testnet-only) swap the import
for a firm-minted mock USDC the operator can faucet to users — the latter is a small contract
change. Tracked, not a deploy blocker.

## Task breakdown

- [ ] **Deploy:** redeploy package + bootstrap Treasury (`scripts/deploy-and-bootstrap.mjs`).
- [ ] **Wire env:** populate `NEXT_PUBLIC_PROPFIRM_*`, USDC type, `SUI_ADMIN_SECRET_KEY`,
      `PROPFIRM_ADMIN_CAP_ID`, `GATEWAY_URL`; make ExecutorCap reachable by the backend.
- [ ] **Onboarding:** fee-first → auto-create (crypto transfer); remove the firm-pays-silently
      button flow.
- [ ] **Invite codes:** Starter-only, firm-sponsored; single-use redemption store.
- [ ] **Executor backend:** service holding Admin+Executor keys; drives `open_account` +
      `log_trade` / `register_dd_breach` / `pass_evaluation` / `fail_evaluation` from the sim.
- [ ] **On-chain reads:** equity / status / drawdown from chain (not zustand); derive live
      "max" from on-chain equity − open margin.
- [ ] **Trade gating + notional balance:** block trading until account exists; "max" decrements
      as open positions consume margin.

## Notes / coordination
- Existing GH backlog (phases 1–7, #22–#51) predates this and assumes Iron Session + allowlist;
  the app actually shipped on **Privy**. This plan supersedes the on-chain/onboarding parts.
- Branches to check before building: `feat/account-onboarding`, `security/contract-hardening`,
  and root `PROGRESS-executor-*.md`.
- Redeploying supersedes PR #70 (it recorded the lost deployer's publish metadata).
