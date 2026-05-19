#!/usr/bin/env node
import { rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const patterns = [
  "**/node_modules",
  "**/dist",
  "**/.turbo",
  "**/.next",
  "**/*.tsbuildinfo",
];

console.log("cleaning build artifacts ...");
for (const pattern of patterns) {
  try {
    // Using shell glob via find for portability across pnpm workspaces
    execSync(`find . -name "${pattern.replace(/\*\*\//g, "")}" -type d -prune -exec rm -rf {} +`, {
      cwd: ROOT,
      stdio: "ignore",
    });
  } catch {
    /* swallow — pattern may not match anything */
  }
}

// Rust target dir
try {
  rmSync(resolve(ROOT, "target"), { recursive: true, force: true });
} catch {}

console.log("done.");
