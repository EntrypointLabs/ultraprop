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
  cached = url ? createDb(url).db : null;
  if (!cached) {
    console.warn(
      "[db] DATABASE_URL unset; ledger features (position intake, durable dedup) are disabled.",
    );
  }
  return cached;
}
