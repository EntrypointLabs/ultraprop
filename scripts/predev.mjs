#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIM = "\x1b[2m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const sharedBuilt =
  existsSync(resolve(ROOT, "packages/shared/events/dist/index.js")) &&
  existsSync(resolve(ROOT, "packages/shared/contracts-abi/dist/index.js"));

const nodeModules = existsSync(resolve(ROOT, "node_modules"));

if (!nodeModules || !sharedBuilt) {
  console.log(`${YELLOW}predev: running setup first (deps or shared packages not built yet)${RESET}`);
  const r = spawnSync("pnpm", ["setup"], { cwd: ROOT, stdio: "inherit", shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
} else {
  console.log(`${DIM}predev: deps + shared packages ready${RESET}`);
}
