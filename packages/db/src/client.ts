import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>["db"];

/**
 * Open a pooled connection to Neon (standard Postgres wire protocol) and bind
 * Drizzle to the schema. No module-level connection — the caller (the executor
 * process, a migration script) owns the lifecycle and calls `close()` on
 * shutdown. `max` is small because the executor is a single long-lived process,
 * not a serverless fan-out.
 */
export function createDb(connectionString: string) {
  const sql = postgres(connectionString, { max: 5 });
  const db = drizzle(sql, { schema });
  return {
    db,
    sql,
    close: () => sql.end({ timeout: 5 }),
  };
}
