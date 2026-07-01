#!/usr/bin/env node
/**
 * In-place testnet upgrade of the propfirm package.
 *
 * Why this exists: the cross-device trade history feature adds a new
 * `log_trade_detailed` function and a richer `TradeSettled` event to
 * `user_account`. Sui upgrades can't change existing struct layouts, but ADDING
 * functions/events is compatible — so we upgrade in place rather than redeploy,
 * preserving the package identity, every existing account, and the on-chain
 * history. The active wallet must hold the recorded `UpgradeCap`.
 *
 * What changes vs. a fresh deploy: the package gets a NEW version id (used for
 * calls to the new function and for the `TradeSettled` event type tag), while the
 * ORIGINAL package id, all shared objects (registries, treasury, tier config),
 * and every struct type tag stay exactly the same. So only one new env var is
 * needed: NEXT_PUBLIC_PROPFIRM_PACKAGE_ID_LATEST.
 *
 * Prerequisites:
 *   - `sui` CLI on PATH, `sui client active-env` = testnet
 *   - active address = the deployer holding the UpgradeCap, funded with testnet SUI
 *   - contracts/sui/Published.toml records the current published-at + upgrade cap
 *
 * Usage:
 *   node scripts/upgrade-package.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const CONTRACT_DIR = process.env.CONTRACT_DIR || 'contracts/sui';
const GAS_BUDGET = process.env.GAS_BUDGET || '500000000';
const DEPLOYMENT = process.env.DEPLOYMENT || 'deployments/testnet.json';

const sui = (args) =>
  execFileSync('sui', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
const suiJson = (args) => JSON.parse(sui([...args, '--json']));

function main() {
  const deployer = sui(['client', 'active-address']);
  const network = sui(['client', 'active-env']);
  console.log(`Deployer: ${deployer}`);
  console.log(`Network:  ${network}`);
  if (!network.toLowerCase().includes('testnet')) {
    console.warn('⚠️  Active env is not testnet — Ctrl-C now if that is wrong.');
  }

  if (!existsSync(DEPLOYMENT)) {
    throw new Error(`No deployment record at ${DEPLOYMENT}.`);
  }
  const record = JSON.parse(readFileSync(DEPLOYMENT, 'utf8'));
  const upgradeCap = record.upgradeCap;
  if (!upgradeCap) {
    throw new Error(`No upgradeCap in ${DEPLOYMENT} — cannot upgrade in place.`);
  }
  console.log(`Upgrading package ${record.packageId}`);
  console.log(`Using UpgradeCap ${upgradeCap}`);

  // The CLI reads Published.toml for the published-at/original-id, builds the new
  // bytecode, runs the compatibility check (additive-only here), and publishes a
  // new package version. On success it bumps Published.toml's version + the
  // upgrade record automatically.
  const res = suiJson([
    'client', 'upgrade', CONTRACT_DIR,
    '--upgrade-capability', upgradeCap,
    '--gas-budget', GAS_BUDGET,
    '--skip-dependency-verification',
  ]);
  const changes = res.objectChanges ?? [];
  const packageIdLatest = changes.find((c) => c.type === 'published')?.packageId;
  if (!packageIdLatest) {
    throw new Error('No new packageId in the upgrade result — check the tx output above.');
  }
  console.log(`\n✅ Upgraded. New package version: ${packageIdLatest}`);

  // Record the latest version id alongside the original (kept as `packageId`).
  record.packageIdLatest = packageIdLatest;
  writeFileSync(DEPLOYMENT, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Wrote packageIdLatest to ${DEPLOYMENT}`);

  console.log('\n--- Add to apps/trader/.env.local (and Vercel/executor env) ---');
  console.log(`NEXT_PUBLIC_PROPFIRM_PACKAGE_ID_LATEST=${packageIdLatest}`);
  console.log('---------------------------------------------------------------');
  console.log('\nKeep NEXT_PUBLIC_PROPFIRM_PACKAGE_ID at the ORIGINAL id — only the');
  console.log('new function call + the TradeSettled event use the latest version.');
}

try {
  main();
} catch (err) {
  console.error('\n❌ Upgrade failed:', err.message);
  process.exit(1);
}
