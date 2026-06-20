import "server-only";

import { createDb, type Database } from "@shared/db";

/**
 * The app's lazy, optional Neon handle. The ledger features (position intake,
 * durable idempotency, the account mirror) are ADDITIVE — when `DATABASE_URL` is
 * unset every route falls back to its pre-ledger behavior, so the app keeps
 * working in dev / unprovisioned environments. One connection is reused across
 * invocations within a server instance.
 */

let cached: Database | null | undefined;

export function getDb(): Database | null {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL?.trim();
  // Serverless on Vercel: keep per-instance connections low and disable prepared
  // statements so a Neon pgbouncer (`-pooler`) connection string works. A direct
  // connection tolerates these settings too, so this is the safe default here.
  cached = url ? createDb(url, { max: 3, prepare: false }).db : null;
  if (!cached) {
    console.warn(
      "[db] DATABASE_URL unset; ledger features (position intake, durable dedup) are disabled.",
    );
  }
  return cached;
}
