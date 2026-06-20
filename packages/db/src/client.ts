import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>["db"];

/**
 * Open a connection to Neon (standard Postgres wire protocol) and bind Drizzle to
 * the schema. No module-level connection — the caller (the executor process, a
 * serverless route, a migration script) owns the lifecycle and calls `close()`.
 */
export function createDb(connectionString: string, options: postgres.Options<{}> = {}) {
  const sql = postgres(connectionString, {
    max: options.max ?? 5,
    prepare: options.prepare ?? true,
  });
  const db = drizzle(sql, { schema });
  return {
    db,
    sql,
    close: () => sql.end({ timeout: 5 }),
  };
}
