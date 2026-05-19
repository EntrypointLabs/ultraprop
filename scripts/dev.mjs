#!/usr/bin/env node
import { spawnSync, execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function has(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Two parallel streams:
//   1. Turbo runs every TS workspace's `dev` script (filtered to apps + services + shared)
//   2. cargo-watch keeps the Rust workspace healthy (risk-engine + shared-slippage)
const streams = [
  {
    name: "ts",
    color: "cyan",
    command: "pnpm",
    args: ["exec", "turbo", "run", "dev"],
  },
];

if (has("cargo")) {
  const hasCargoWatch = (() => {
    try {
      execSync("cargo watch --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();
  if (hasCargoWatch) {
    streams.push({
      name: "rust",
      color: "magenta",
      command: "cargo",
      args: ["watch", "-q", "-x", "check --workspace", "-x", "test --workspace"],
    });
  } else {
    console.log("dev: cargo-watch not installed — skipping Rust watcher.");
    console.log("     install with:  cargo install cargo-watch");
  }
} else {
  console.log("dev: cargo not installed — Rust watcher skipped.");
}

const concurrentlyArgs = [
  "exec",
  "concurrently",
  "--prefix",
  "[{name}]",
  "--prefix-colors",
  streams.map((s) => s.color).join(","),
  "--names",
  streams.map((s) => s.name).join(","),
  "--kill-others-on-fail",
  ...streams.map((s) => `${s.command} ${s.args.join(" ")}`),
];

const r = spawnSync("pnpm", concurrentlyArgs, {
  cwd: ROOT,
  stdio: "inherit",
  shell: false,
});

process.exit(r.status ?? 1);
