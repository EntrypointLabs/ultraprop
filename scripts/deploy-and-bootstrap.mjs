#!/usr/bin/env node
/**
 * One-shot testnet (re)deploy + bootstrap for the propfirm package.
 *
 * Why this exists: the original deployer wallet (holding AdminCap / ExecutorCap /
 * UpgradeCap / the creator caps) is unreachable, so the existing package can be
 * neither bootstrapped nor upgraded. This publishes a FRESH package from a wallet
 * you control, then instantiates the Treasury shared object that `open_account`
 * needs. The result is a self-contained `deployments/<network>.json` plus an env
 * snippet you can paste into the app / executor service.
 *
 * Prerequisites (see docs/V1-ONCHAIN-REDEPLOY-PLAN.md):
 *   - `sui` CLI installed and on PATH
 *   - `sui client active-env` pointing at testnet
 *   - `sui client active-address` funded with ~1-2 testnet SUI (faucet)
 *
 * Usage:
 *   node scripts/deploy-and-bootstrap.mjs
 *   FEES_ADDRESS=0x.. EVAL_FUNDS_ADDRESS=0x.. node scripts/deploy-and-bootstrap.mjs
 *
 * The deployer address becomes the AdminCap + ExecutorCap holder (the firm/admin
 * wallet). Vault is intentionally NOT created — v1 has no funded capital / LP.
 *
 * On testnet the propfirm package's `usdc` dependency is a LOCAL mock package
 * (contracts/mock-usdc), so this publishes in TWO steps: first the mock USDC
 * (which records its address in its own Published.toml), then propfirm (whose
 * `usdc` local dep now resolves to that just-published address). The mock ships
 * an open `Faucet` so beta users can self-mint testnet dollars.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, copyFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTRACT_DIR = process.env.CONTRACT_DIR || 'contracts/sui';
const MOCK_USDC_DIR = process.env.MOCK_USDC_DIR || 'contracts/mock-usdc';
const TIMELOCK_MS = process.env.TIMELOCK_MS || '86400000'; // 24h address-change timelock
const GAS_BUDGET = process.env.GAS_BUDGET || '500000000';
const CLOCK = '0x6';

const sui = (args) =>
  execFileSync('sui', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
const suiJson = (args) => JSON.parse(sui([...args, '--json']));

const createdId = (changes, suffix) =>
  changes.find((c) => c.type === 'created' && c.objectType?.endsWith(suffix))?.objectId ?? null;

// Force a fresh publish for a package dir: the CLI treats a package with no
// Published.toml as not-yet-published on the active env. Backed up first.
function resetPublished(dir) {
  const publishedToml = join(dir, 'Published.toml');
  if (existsSync(publishedToml)) {
    copyFileSync(publishedToml, `${publishedToml}.bak`);
    rmSync(publishedToml);
    console.log(`Reset prior publish record for ${dir} (backed up to ${publishedToml}.bak)`);
  }
}

function publishPackage(dir) {
  const pub = suiJson([
    'client', 'publish', dir,
    '--gas-budget', GAS_BUDGET,
    '--skip-dependency-verification',
  ]);
  const changes = pub.objectChanges ?? [];
  const packageId = changes.find((c) => c.type === 'published')?.packageId;
  if (!packageId) throw new Error(`No packageId publishing ${dir} — check the tx result above.`);
  return { packageId, changes };
}

function main() {
  // 0. Sanity: who/where are we deploying as.
  const deployer = sui(['client', 'active-address']);
  const network = sui(['client', 'active-env']);
  console.log(`Deployer: ${deployer}`);
  console.log(`Network:  ${network}`);
  if (!network.toLowerCase().includes('testnet')) {
    console.warn('⚠️  Active env is not testnet — Ctrl-C now if that is wrong.');
  }
  const feesAddress = process.env.FEES_ADDRESS || deployer;
  const evalFundsAddress = process.env.EVAL_FUNDS_ADDRESS || deployer;

  // 1. Publish the mock USDC FIRST. propfirm's `usdc` dep is `local = ../mock-usdc`,
  //    so it cannot compile until the mock has an on-chain address. Publishing it
  //    writes contracts/mock-usdc/Published.toml, which the propfirm build then
  //    reads to resolve the `usdc` named address. The shared Faucet (open mint)
  //    falls out of the mock's init().
  console.log('\nPublishing mock USDC…');
  resetPublished(MOCK_USDC_DIR);
  const { packageId: usdcPackageId, changes: usdcChanges } = publishPackage(MOCK_USDC_DIR);
  const usdcFaucet = createdId(usdcChanges, '::usdc::Faucet');
  if (!usdcFaucet) throw new Error('No ::usdc::Faucet created — check the mock USDC publish above.');
  const usdcType = `${usdcPackageId}::usdc::USDC`;
  console.log(`Published mock USDC ${usdcPackageId}`);
  console.log(`  usdcType: ${usdcType}`);
  console.log(`  usdcFaucet: ${usdcFaucet}`);

  // 2. Publish propfirm. Force a fresh publish (the recorded testnet publish
  //    belongs to the lost deployer and cannot be upgraded). init() runs for
  //    every module: mints AdminCap/ExecutorCap/creator caps to the deployer and
  //    shares AccessRegistry/AccountRegistry/TierConfig. The `usdc` local dep now
  //    resolves to the mock package published in step 1.
  console.log('\nPublishing propfirm package…');
  resetPublished(CONTRACT_DIR);
  const { packageId, changes } = publishPackage(CONTRACT_DIR);

  const ids = {
    packageId,
    adminCap: createdId(changes, '::access::AdminCap'),
    executorCap: createdId(changes, '::access::ExecutorCap'),
    accessRegistry: createdId(changes, '::access::AccessRegistry'),
    accountRegistry: createdId(changes, '::user_account::AccountRegistry'),
    tierConfig: createdId(changes, '::tier_config::TierConfig'),
    treasuryCreatorCap: createdId(changes, '::treasury::TreasuryCreatorCap'),
    vaultCreatorCap: createdId(changes, '::vault_reserve::VaultCreatorCap'),
    upgradeCap: createdId(changes, '::package::UpgradeCap'),
  };
  console.log(`Published package ${packageId}`);
  for (const [k, v] of Object.entries(ids)) console.log(`  ${k}: ${v}`);

  for (const [k, v] of Object.entries(ids)) {
    if (!v) throw new Error(`Missing ${k} in publish output — aborting before bootstrap.`);
  }

  // 3. Bootstrap the Treasury shared object (required by open_account).
  console.log('\nCreating Treasury…');
  const tre = suiJson([
    'client', 'call',
    '--package', packageId, '--module', 'treasury', '--function', 'create_treasury',
    '--args',
    ids.adminCap, ids.accessRegistry, ids.treasuryCreatorCap,
    feesAddress, evalFundsAddress, TIMELOCK_MS, CLOCK,
    '--gas-budget', GAS_BUDGET,
  ]);
  const treasuryId = createdId(tre.objectChanges ?? [], '::treasury::Treasury');
  if (!treasuryId) throw new Error('No Treasury created — check the create_treasury tx above.');
  console.log(`Treasury: ${treasuryId}`);

  // 4. Persist the deployment record + an env snippet.
  const record = {
    network,
    deployer,
    feesAddress,
    evalFundsAddress,
    treasury: treasuryId,
    ...ids,
    // Mock USDC the contract was compiled against (testnet). On mainnet this is
    // the real Circle USDC type and there is no firm-controlled faucet.
    usdcType,
    usdcPackageId,
    usdcFaucet,
  };
  mkdirSync('deployments', { recursive: true });
  const envName = network.toLowerCase().includes('testnet') ? 'testnet' : network;
  writeFileSync(`deployments/${envName}.json`, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`\nWrote deployments/${envName}.json`);

  console.log('\n--- App env snippet (apps/trader/.env.local) ---');
  console.log(`NEXT_PUBLIC_SUI_NETWORK=testnet`);
  console.log(`NEXT_PUBLIC_PROPFIRM_PACKAGE_ID=${ids.packageId}`);
  console.log(`NEXT_PUBLIC_PROPFIRM_ACCOUNT_REGISTRY_ID=${ids.accountRegistry}`);
  console.log(`NEXT_PUBLIC_PROPFIRM_ACCESS_REGISTRY_ID=${ids.accessRegistry}`);
  console.log(`NEXT_PUBLIC_PROPFIRM_TIER_CONFIG_ID=${ids.tierConfig}`);
  console.log(`NEXT_PUBLIC_PROPFIRM_TREASURY_ID=${treasuryId}`);
  console.log(`NEXT_PUBLIC_PROPFIRM_USDC_TYPE=${usdcType}`);
  console.log(`NEXT_PUBLIC_PROPFIRM_USDC_FAUCET_ID=${usdcFaucet}`);
  console.log(`PROPFIRM_ADMIN_CAP_ID=${ids.adminCap}`);
  console.log(`# executor service: ExecutorCap ${ids.executorCap} (held by deployer ${deployer})`);
  console.log('------------------------------------------------\n');
  console.log('Done. Send me deployments/' + envName + '.json and I will wire the app + executor.');
}

try {
  main();
} catch (err) {
  console.error('\n❌ Deploy failed:', err.message);
  console.error('If the publish step says the package is already published, also clear the');
  console.error('testnet entry from contracts/sui/Move.lock and re-run. Share the full output.');
  process.exit(1);
}
