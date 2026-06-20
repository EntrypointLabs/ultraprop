import { defineConfig } from "drizzle-kit";

/**
 * `db:generate` produces SQL migrations from `schema.ts` without a live database;
 * `db:migrate` applies them to the Neon instance named by `DATABASE_URL`.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
