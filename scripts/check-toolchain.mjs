#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function tryRun(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

const tools = [
  { name: "node", probe: "node --version", required: true },
  { name: "pnpm", probe: "pnpm --version", required: true },
  { name: "cargo", probe: "cargo --version", required: false, why: "Rust services (risk-engine) + shared-slippage" },
  { name: "rustup", probe: "rustup --version", required: false, why: "Rust toolchain channel pinning" },
  { name: "sui", probe: "sui --version", required: false, why: "Sui Move contracts (Phase 1)" },
  { name: "anchor", probe: "anchor --version", required: false, why: "Solana programs (Phase 4)" },
  { name: "solana", probe: "solana --version", required: false, why: "Solana CLI for deploys (Phase 4)" },
];

const versionsPath = resolve(ROOT, "VERSIONS.md");
const versionsTable = existsSync(versionsPath) ? readFileSync(versionsPath, "utf8") : "";

console.log(`${BOLD}toolchain check${RESET} ${DIM}(VERSIONS.md is the pin source-of-truth)${RESET}\n`);

let missingRequired = 0;
let missingOptional = 0;

for (const tool of tools) {
  const version = tryRun(tool.probe);
  if (version) {
    console.log(`  ${GREEN}✓${RESET} ${tool.name.padEnd(8)} ${DIM}${version.split("\n")[0]}${RESET}`);
  } else if (tool.required) {
    console.log(`  ${RED}✗${RESET} ${tool.name.padEnd(8)} ${RED}MISSING (required)${RESET}`);
    missingRequired++;
  } else {
    console.log(
      `  ${YELLOW}-${RESET} ${tool.name.padEnd(8)} ${YELLOW}not installed${RESET} ${DIM}— needed for: ${tool.why}${RESET}`,
    );
    missingOptional++;
  }
}

console.log();

if (missingRequired > 0) {
  console.log(`${RED}${missingRequired} required tool(s) missing.${RESET} Install before proceeding.`);
  process.exit(1);
}

if (missingOptional > 0) {
  console.log(
    `${YELLOW}${missingOptional} optional tool(s) missing.${RESET} ${DIM}pnpm setup will skip those build steps.${RESET}`,
  );
}

if (versionsTable) {
  console.log(`${DIM}See VERSIONS.md for the verified-as-of pins.${RESET}`);
}
