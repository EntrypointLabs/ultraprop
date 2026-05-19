#!/usr/bin/env node
import { spawnSync, execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function step(label, fn) {
  const start = Date.now();
  process.stdout.write(`${BOLD}▸${RESET} ${label} ... `);
  try {
    const result = fn();
    const ms = Date.now() - start;
    if (result === "skipped") {
      console.log(`${YELLOW}skipped${RESET} ${DIM}(${ms}ms)${RESET}`);
    } else {
      console.log(`${GREEN}ok${RESET} ${DIM}(${ms}ms)${RESET}`);
    }
  } catch (err) {
    console.log(`${YELLOW}failed${RESET}`);
    console.error(err.message || err);
    process.exit(1);
  }
}

function has(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: false, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited ${r.status}`);
}

console.log(`${BOLD}prop-firm setup${RESET}\n`);

step("toolchain check", () => {
  run("node", ["scripts/check-toolchain.mjs"]);
});

step("pnpm install", () => {
  run("pnpm", ["install"]);
});

step("build shared TS packages (events + contracts-abi)", () => {
  run("pnpm", [
    "--filter",
    "@shared/events",
    "--filter",
    "@shared/contracts-abi",
    "run",
    "build",
  ]);
});

step("cargo build --workspace", () => {
  if (!has("cargo")) return "skipped";
  run("cargo", ["build", "--workspace"]);
});

step("sui move build (contracts/sui)", () => {
  if (!has("sui")) return "skipped";
  run("sui", ["move", "build"], { cwd: resolve(ROOT, "contracts/sui") });
});

step("anchor build (contracts/solana)", () => {
  if (!has("anchor")) return "skipped";
  // Anchor currently has zero programs; this is a connectivity check.
  // run("anchor", ["build"], { cwd: resolve(ROOT, "contracts/solana") });
  return "skipped";
});

console.log(`\n${GREEN}setup complete${RESET}. Run ${BOLD}pnpm dev${RESET} to start every workspace.`);
