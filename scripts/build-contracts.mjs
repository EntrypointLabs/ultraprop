#!/usr/bin/env node
import { spawnSync, execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function has(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function run(label, cmd, args, opts = {}) {
  process.stdout.write(`▸ ${label} ... `);
  if (!has(cmd)) {
    console.log(`${YELLOW}skipped (${cmd} not installed)${RESET}`);
    return;
  }
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: false, ...opts });
  if (r.status !== 0) {
    console.log(`${YELLOW}failed${RESET}`);
    process.exit(r.status ?? 1);
  }
  console.log(`${GREEN}ok${RESET}`);
}

console.log(`${DIM}building contract packages${RESET}`);
run("sui move build", "sui", ["move", "build"], { cwd: resolve(ROOT, "contracts/sui") });
// Anchor build deferred until programs/ has members (Phase 4).
// run("anchor build", "anchor", ["build"], { cwd: resolve(ROOT, "contracts/solana") });
